import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { puede, ETIQUETA_CAPACIDAD, type Capacidad } from '@/lib/capacidades';
import * as db from '@/lib/junta-db';
import { FECHA_RE, parsearFecha, parsearMonto } from '@/lib/junta-validacion';

// API de la sección de junta directiva.
//
// EL CHEQUEO DE CAPACIDAD ESTÁ EN CADA RAMA, NO AL PRINCIPIO
//
// Podría hacer un `switch` con la capacidad al principio de cada rama, y es lo
// que hace. Lo que NO hace es un chequeo único arriba: "si puede ver
// comunicaciones, puede escribirlas". Esa es exactamente la diferencia entre el
// vocal que lee la nota interna y el que no la escribe, y un chequeo único la
// borra.
//
// OTRA COSA QUE ESTÁ EN CADA RAMA: LA LISTA DE CAMPOS
//
// Cada `insert`/`update` escribe columnas nombradas una por una. Un `body` que
// se pasa entero al SQL parece más corto y es la forma habitual de que aparezca
// un `rol = 'admin'` por accidente.

// ---------------------------------------------------------------------------

const CAPACIDADES_VALIDAS: Capacidad[] = [
  'ver_comunicacion_interna', 'publicar_comunicacion_interna',
  'ver_parte_administrativo', 'ver_parte_financiero', 'publicar_parte',
  'ver_documentos_legajo', 'descargar_documentos_legajo', 'cargar_documentos_legajo',
  'comunicar_padres', 'ver_vencimientos', 'adherentes_seguro', 'gestionar_seguro',
  'cargar_facturas', 'emitir_recibos', 'ver_inventario', 'gestionar_inventario',
  'gestionar_prestamos',
];

export async function GET(request: NextRequest, ctx: { params: Promise<{ area: string }> }) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;
    const { area } = await ctx.params;
    const url = new URL(request.url);

    // --- Comunicaciones internas: lectura ----------------------------------
    if (area === 'comunicaciones') {
      if (!puede(user.rol, 'ver_comunicacion_interna')) return sinPermiso(user.rol, 'ver_comunicacion_interna');

      // Los borradores solo los ve quien puede escribir. Si no, un borrador se
      // filtra por la pantalla a cualquiera que esté en la sección.
      const quienEscribe = puede(user.rol, 'publicar_comunicacion_interna');
      const estados = url.searchParams.get('todo') === '1' && quienEscribe
        ? ['borrador', 'publicado', 'archivado']
        : ['publicado'];

      return NextResponse.json({
        data: {
          lista: await db.listarComunicaciones(estados),
          puedeEscribir: quienEscribe,
        },
      });
    }

    // --- Partes ------------------------------------------------------------
    if (area === 'partes') {
      const tipo = url.searchParams.get('tipo') === 'financiero' ? 'financiero' : 'administrativo';
      const cap: Capacidad = tipo === 'financiero' ? 'ver_parte_financiero' : 'ver_parte_administrativo';
      if (!puede(user.rol, cap)) return sinPermiso(user.rol, cap);

      return NextResponse.json({
        data: {
          tipo,
          lista: await db.listarPartes(tipo),
          puedeCargar: puede(user.rol, 'publicar_parte'),
        },
      });
    }

    // --- Documentos de legajo ---------------------------------------------
    if (area === 'documentos') {
      if (!puede(user.rol, 'ver_documentos_legajo')) return sinPermiso(user.rol, 'ver_documentos_legajo');

      const lista = await db.listarDocumentosLegajo({
        perfilId: url.searchParams.get('perfil') ?? undefined,
        tipo: url.searchParams.get('tipo') ?? undefined,
      });

      // El filtro de visibilidad va ACÁ y no en la consulta: depende de quién
      // pregunta, y si se queda en el SQL hay que acordarse de pasarlo siempre.
      const sinPrivados = !puede(user.rol, 'descargar_documentos_legajo');
      const visible = sinPrivados ? lista.filter((d) => d.visibilidad !== 'privado') : lista;

      return NextResponse.json({
        data: {
          lista: visible,
          puedeCargar: puede(user.rol, 'cargar_documentos_legajo'),
          puedeDescargar: puede(user.rol, 'descargar_documentos_legajo'),
        },
      });
    }

    // --- Recibos -----------------------------------------------------------
    if (area === 'recibos') {
      if (!puede(user.rol, 'emitir_recibos')) return sinPermiso(user.rol, 'emitir_recibos');

      return NextResponse.json({
        data: {
          lista: await db.listarRecibos({
            estado: url.searchParams.get('estado') ?? undefined,
            limite: Number(url.searchParams.get('limite')) || undefined,
          }),
          puedeEmitir: true,
        },
      });
    }

    // --- Seguros -----------------------------------------------------------
    if (area === 'seguros') {
      if (!puede(user.rol, 'adherentes_seguro')) return sinPermiso(user.rol, 'adherentes_seguro');

      return NextResponse.json({
        data: {
          lista: await db.listarSeguros({ estado: url.searchParams.get('estado') ?? undefined }),
          config: await db.configSeguro(),
          puedeGestionar: puede(user.rol, 'gestionar_seguro'),
        },
      });
    }

    // --- Inventario --------------------------------------------------------
    if (area === 'inventario') {
      if (!puede(user.rol, 'ver_inventario')) return sinPermiso(user.rol, 'ver_inventario');

      return NextResponse.json({
        data: {
          items: await db.listarInventario(),
          prestamos: await db.listarPrestamos(true),
          puedeGestionar: puede(user.rol, 'gestionar_inventario'),
          puedePrestar: puede(user.rol, 'gestionar_prestamos'),
        },
      });
    }

    return NextResponse.json({ error: 'Área desconocida' }, { status: 404 });
  } catch (err: any) {
    console.error('Junta GET:', err);
    return NextResponse.json({ error: 'No se pudo cargar la información' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ area: string }> }) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;
    const { area } = await ctx.params;

    const leido = await leerJson<Record<string, unknown>>(request);
    if (!leido.ok) return RESP_BAD_JSON();
    const b = leido.data;
    const accion = String(b.accion ?? '');

    // --- Comunicaciones internas -------------------------------------------
    if (area === 'comunicaciones') {
      if (!puede(user.rol, 'publicar_comunicacion_interna')) {
        return sinPermiso(user.rol, 'publicar_comunicacion_interna');
      }

      if (accion === 'crear') {
        const titulo = texto(b.titulo, 200);
        const contenido = texto(b.contenido, 20000);
        if (!titulo || !contenido) {
          return NextResponse.json({ error: 'Falta el título o el texto' }, { status: 400 });
        }

        const id = await db.crearComunicacion({
          titulo,
          contenido,
          categoria: unoDe(b.categoria, ['general', 'reunion', 'deportivo', 'administrativo', 'urgente'], 'general'),
          fijado: b.fijado === true,
          adjunto_nombre: texto(b.adjunto_nombre, 200) || null,
          adjunto_url: texto(b.adjunto_url, 500) || null,
          autorId: user.id,
          estado: unoDe(b.estado, ['borrador', 'publicado'], 'borrador'),
        });
        return NextResponse.json({ success: true, id }, { status: 201 });
      }

      if (accion === 'actualizar' || accion === 'publicar' || accion === 'archivar') {
        const id = texto(b.id, 36);
        if (!id) return NextResponse.json({ error: 'Falta la comunicación' }, { status: 400 });

        const cambios: Record<string, any> = {};
        if (b.titulo !== undefined) cambios.titulo = texto(b.titulo, 200);
        if (b.contenido !== undefined) cambios.contenido = texto(b.contenido, 20000);
        if (b.categoria !== undefined) cambios.categoria = unoDe(b.categoria, ['general', 'reunion', 'deportivo', 'administrativo', 'urgente'], 'general');
        if (b.fijado !== undefined) cambios.fijado = b.fijado === true;
        if (accion !== 'actualizar') cambios.estado = accion === 'publicar' ? 'publicado' : 'archivado';

        await db.actualizarComunicacion(id, cambios);
        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

    // --- Partes ------------------------------------------------------------
    if (area === 'partes') {
      if (!puede(user.rol, 'publicar_parte')) return sinPermiso(user.rol, 'publicar_parte');
      if (accion !== 'crear') return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });

      // El tipo decide qué parte se está escribiendo, y con eso qué parte se
      // está viendo. Alguien sin `ver_parte_financiero` no puede escribir un
      // parte financiero que después no va a poder leer.
      const tipo = b.tipo === 'financiero' ? 'financiero' : 'administrativo';
      const capLectura: Capacidad = tipo === 'financiero' ? 'ver_parte_financiero' : 'ver_parte_administrativo';
      if (!puede(user.rol, capLectura)) return sinPermiso(user.rol, capLectura);

      const fecha = parsearFecha(b.fecha_reunion);
      const titulo = texto(b.titulo, 200);
      const contenido = texto(b.contenido, 20000);
      if (!fecha || !titulo || !contenido) {
        return NextResponse.json({ error: 'Falta la fecha, el título o el texto del parte' }, { status: 400 });
      }

      const id = await db.crearParte({
        tipo, titulo, fechaReunion: fecha, contenido,
        asistentes: texto(b.asistentes, 2000) || null,
        decisiones: texto(b.decisiones, 5000) || null,
        autorId: user.id,
      });
      return NextResponse.json({ success: true, id }, { status: 201 });
    }

    // --- Documentos de legajo ---------------------------------------------
    if (area === 'documentos') {
      if (accion === 'crear') {
        if (!puede(user.rol, 'cargar_documentos_legajo')) return sinPermiso(user.rol, 'cargar_documentos_legajo');

        const perfilId = texto(b.perfil_id, 36);
        const url = texto(b.url, 500);
        const nombre = texto(b.nombre, 200);
        if (!perfilId || !url || !nombre) {
          return NextResponse.json({ error: 'Falta el jugador, el nombre o el archivo' }, { status: 400 });
        }

        const id = await db.crearDocumentoLegajo({
          perfilId, nombre, url,
          tipo: unoDe(b.tipo, ['ficha', 'certificado_estudios', 'copia_dni', 'evaluacion', 'planilla', 'otro'], 'otro'),
          // Solo el que puede verlos todos baja documentos marcados como privados.
          visibilidad:
            b.visibilidad === 'privado' && !puede(user.rol, 'descargar_documentos_legajo')
              ? 'directiva'
              : unoDe(b.visibilidad, ['directiva', 'privado'], 'directiva'),
          notas: texto(b.notas, 2000) || null,
          subidoPor: user.id,
        });
        return NextResponse.json({ success: true, id }, { status: 201 });
      }
      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

    // --- Recibos -----------------------------------------------------------
    if (area === 'recibos') {
      if (!puede(user.rol, 'emitir_recibos')) return sinPermiso(user.rol, 'emitir_recibos');

      if (accion === 'emitir') {
        const monto = parsearMonto(b.monto);
        if (monto === null || monto <= 0) {
          return NextResponse.json({ error: 'El monto tiene que ser un número mayor que cero' }, { status: 400 });
        }

        const r = await db.emitirRecibo({
          cuotaId: texto(b.cuota_id, 36) || null,
          familiaId: texto(b.familia_id, 36) || null,
          monto,
          formaPago: unoDe(b.forma_pago, ['efectivo', 'transferencia', 'debito', 'credito', 'cheque'], 'efectivo'),
          concepto: texto(b.concepto, 255) || null,
          emitidoPor: user.id,
          reemplazaId: texto(b.reemplaza_id, 36) || null,
        });

        return NextResponse.json({ success: true, ...r }, { status: 201 });
      }

      if (accion === 'anular') {
        const id = texto(b.id, 36);
        const motivo = texto(b.motivo, 500);
        if (!id || !motivo) {
          return NextResponse.json({ error: 'Falta el recibo o el motivo de la anulación' }, { status: 400 });
        }
        await db.anularRecibo(id, motivo, user.id);
        return NextResponse.json({
          success: true,
          mensaje: 'Recibo anulado. El registro no se borra: se conserva para poder conciliar.',
        });
      }

      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

    // --- Seguros -----------------------------------------------------------
    if (area === 'seguros') {
      if (accion === 'config') {
        if (!puede(user.rol, 'gestionar_seguro')) return sinPermiso(user.rol, 'gestionar_seguro');
        const monto = parsearMonto(b.monto_base);
        const vigencia = Number(b.meses_vigencia);
        const aviso = Number(b.dias_aviso);
        if (monto === null || !Number.isFinite(vigencia) || vigencia < 1 || !Number.isFinite(aviso)) {
          return NextResponse.json({ error: 'Revisá el monto, la vigencia y los días de aviso' }, { status: 400 });
        }
        await db.guardarConfigSeguro({
          montoBase: monto,
          mesesVigencia: Math.min(vigencia, 60),
          diasAviso: Math.min(Math.max(aviso, 0), 365),
          diaCorte: b.dia_corte === null || b.dia_corte === '' ? null : Number(b.dia_corte),
        });
        return NextResponse.json({ success: true });
      }

      if (accion === 'guardar') {
        if (!puede(user.rol, 'gestionar_seguro')) return sinPermiso(user.rol, 'gestionar_seguro');

        const jugadorId = texto(b.jugador_perfil_id, 36);
        if (!jugadorId) return NextResponse.json({ error: 'Falta el jugador' }, { status: 400 });

        const estado = unoDe(b.estado, ['pendiente', 'adherido', 'renovado', 'baja'], 'pendiente');

        await db.guardarSeguro({
          jugadorPerfilId: jugadorId,
          estado,
          fechaAdhesion: parsearFecha(b.fecha_adhesion),
          fechaVencimiento: parsearFecha(b.fecha_vencimiento),
          monto: parsearMonto(b.monto),
          pagado: b.pagado === true,
          fechaPago: parsearFecha(b.fecha_pago),
          comprobanteUrl: texto(b.comprobante_url, 500) || null,
          notas: texto(b.notas, 1000) || null,
          registradoPor: user.id,
        });

        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

    // --- Inventario --------------------------------------------------------
    if (area === 'inventario') {
      if (accion === 'guardar-item') {
        if (!puede(user.rol, 'gestionar_inventario')) return sinPermiso(user.rol, 'gestionar_inventario');

        const nombre = texto(b.nombre, 150);
        const cantidad = Number(b.cantidad_total);
        if (!nombre || !Number.isFinite(cantidad) || cantidad < 0) {
          return NextResponse.json({ error: 'Falta el nombre o la cantidad no es válida' }, { status: 400 });
        }

        const id = await db.guardarItem({
          id: texto(b.id, 36) || null,
          nombre,
          descripcion: texto(b.descripcion, 2000) || null,
          categoria: unoDe(b.categoria, ['sticks', 'tickets', 'pads', 'porterias', 'balones', 'indumentaria', 'otros'], 'otros'),
          cantidadTotal: Math.floor(cantidad),
          estado: unoDe(b.estado, ['activo', 'baja', 'reparacion'], 'activo'),
          ubicacion: texto(b.ubicacion, 120) || null,
          valorUnitario: parsearMonto(b.valor_unitario),
          notas: texto(b.notas, 2000) || null,
          actualizadoPor: user.id,
        });
        return NextResponse.json({ success: true, id }, { status: 201 });
      }

      if (accion === 'prestar') {
        if (!puede(user.rol, 'gestionar_prestamos')) return sinPermiso(user.rol, 'gestionar_prestamos');

        const itemId = texto(b.item_id, 36);
        const persona = texto(b.persona_nombre, 150);
        const cantidad = Number(b.cantidad);
        if (!itemId || !persona || !Number.isFinite(cantidad) || cantidad < 1) {
          return NextResponse.json({ error: 'Falta el equipo, la persona o la cantidad' }, { status: 400 });
        }

        try {
          await db.registrarPrestamo({
            itemId,
            personaNombre: persona,
            usuarioId: texto(b.usuario_id, 36) || null,
            cantidad: Math.floor(cantidad),
            fechaEstimadaDevolucion: parsearFecha(b.fecha_estimada_devolucion),
            notas: texto(b.notas, 1000) || null,
            registradoPor: user.id,
          });
        } catch (err: any) {
          return NextResponse.json({ error: err.message }, { status: 400 });
        }

        return NextResponse.json({ success: true }, { status: 201 });
      }

      if (accion === 'cerrar-prestamo') {
        if (!puede(user.rol, 'gestionar_prestamos')) return sinPermiso(user.rol, 'gestionar_prestamos');

        const id = texto(b.id, 36);
        const resultado = b.resultado === 'perdido' ? 'perdido' : 'devuelto';
        if (!id) return NextResponse.json({ error: 'Falta el préstamo' }, { status: 400 });

        try {
          await db.cerrarPrestamo(id, resultado);
        } catch (err: any) {
          return NextResponse.json({ error: err.message }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          mensaje:
            resultado === 'perdido'
              ? 'Anotado como perdido. El equipo salió del inventario: revisá si hay que darlo de baja.'
              : 'Devuelto. Volvió al inventario.',
        });
      }

      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Área desconocida' }, { status: 404 });
  } catch (err: any) {
    console.error('Junta POST:', err);
    return NextResponse.json(
      { error: 'No se pudo completar la operación' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------

function sinPermiso(rol: string, capacidad: Capacidad) {
  return NextResponse.json(
    {
      error: `Tu cargo no tiene permiso para ${ETIQUETA_CAPACIDAD[capacidad].toLowerCase()}.`,
      capacidad,
      rol,
    },
    { status: 403 }
  );
}

/** Recorta y exige que no quede vacío. */
function texto(v: unknown, max: number): string {
  return String(v ?? '').trim().slice(0, max);
}

/** Un valor de una lista blanca, o el default. Nunca pasa lo que venga. */
function unoDe(v: unknown, opciones: string[], porDefecto: string): string {
  const s = String(v ?? '');
  return opciones.includes(s) ? s : porDefecto;
}

export { FECHA_RE };
