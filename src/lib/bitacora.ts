// Bitácora de accesos a documentos sensibles.
//
// Por qué existe: el club guarda DNI, fotos de documento y comprobantes
// bancarios de personas que en su mayoría son menores. La Ley 25.326 pide
// que el tratamiento sea trazable, y la pregunta que un padre hace en la
// práctica es "¿quién abrió el DNI de mi hijo?". Sin registro, esa pregunta
// no tiene respuesta.
//
// Qué se registra y qué no:
//
//   SÍ  -> quién accedió, cuándo, a qué ficha, qué tipo de documento, con
//          qué propósito declarado.
//   NO  -> el contenido del documento ni su ruta. La bitácora no puede
//          terminar siendo una segunda copia del padrón: guardaría el mismo
//          dato sensible que intenta proteger.
//
// Cuándo se registra: cuando alguien que NO es el dueño abre un documento.
// Ver el propio DNI no se registra; no es un acceso de terceros y llenaría la
// tabla de ruido que después no sirve para nada.

import { execute, uuid } from './db';
import { clientIp } from './rateLimit';
import type { NextRequest } from 'next/server';

export type TipoDocumento = 'dni' | 'comprobante';

/** Mapea el bucket del archivo al tipo de dato sensible que representa. */
export function tipoDeBucket(bucket: string): TipoDocumento | null {
  switch (bucket) {
    case 'fotos-dni':
      return 'dni';
    case 'comprobantes':
      return 'comprobante';
    default:
      return null;
  }
}

/**
 * Registra un acceso. Nunca debe romper la lectura del documento: si la
 * bitácora falla, el tesorero igual tiene que poder ver el comprobante que
 * está revisando. Se loguea el fallo y se sigue.
 */
export async function registrarAcceso(
  request: NextRequest,
  datos: {
    usuarioId: string;
    perfilDestinoId: string;
    tipo: TipoDocumento;
    proposito?: string;
  }
) {
  try {
    await execute(
      `INSERT INTO accesos_datos_sensibles
         (id, usuario_id, perfil_destino_id, tipo_documento, proposito, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid(),
        datos.usuarioId,
        datos.perfilDestinoId,
        datos.tipo,
        datos.proposito ?? null,
        // `clientIp` devuelve un string; el límite de la columna es 45 (IPv6).
        String(clientIp(request)).slice(0, 45),
        String(request.headers.get('user-agent') ?? '').slice(0, 255),
      ]
    );
  } catch (err) {
    // La tabla todavía puede no existir si la migración 07 no corrió. Se avisa
    // por log y la lectura continúa.
    console.warn('No se pudo registrar el acceso a datos sensibles:', err);
  }
}
