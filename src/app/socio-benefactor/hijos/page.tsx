export const dynamic = 'force-dynamic';

import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { tieneConsentimiento, opinionVigente } from '@/lib/consentimientos-db';
import { opinionVeda } from '@/lib/consentimientos';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Mail, Phone } from 'lucide-react';
import { SubirDocumentacion } from '@/components/SubirDocumentacion';

/** Una fila de `familias` con el perfil del jugador y su ficha. */
interface FilaHijo {
  id: string;
  tipo_vinculo: string;
  perfil_id: string | null;
  nombre: string | null;
  apellido: string | null;
  dni: string | null;
  telefono: string | null;
  correo: string | null;
  deportista_id: string | null;
  club_activo: number | null;
  dni_frente_url: string | null;
  dni_fondo_url: string | null;
}

export default async function SocioBenefactorHijos() {
  const user = await getCurrentUser();
  if (!user) return null;

  const rows = await query<FilaHijo>(
    `SELECT f.id, f.tipo_vinculo,
            p.id AS perfil_id, p.nombre, p.apellido, p.dni, p.telefono, p.correo,
            d.id AS deportista_id, d.club_activo,
            d.dni_frente_url, d.dni_fondo_url
     FROM familias f
     LEFT JOIN perfiles p ON p.id = f.deportista_perfil_id
     LEFT JOIN deportistas d ON d.perfil_id = f.deportista_perfil_id
     WHERE f.padre_perfil_id = ?
     ORDER BY p.nombre`,
    [user.id]
  );

  // El estado del consentimiento se consulta por hijo con las MISMAS funciones que
  // usa la puerta del servidor, y no con una consulta propia.
  //
  // Importa por la regla de la opinión: si el menor un día habló desde su
  // portal, esa es la que vale y el representante no la pisa. Si esta pantalla
  // calculara el estado por su cuenta y se equivocara al elegir entre la propia
  // y la transmitida, mostraría "puede subir" y el rechazo llegaría un segundo
  // después, en el mejor caso. La regla de la que depende el veto del menor vive
  // en un solo lugar y esta pantalla la usa, no la reimplementa.
  const hijos = await Promise.all(
    rows.map(async (r) => {
      const perfilId = r.perfil_id as string | null;
      const nombreCompleto = `${r.nombre ?? ''} ${r.apellido ?? ''}`.trim();

      const [consentido, opinion] = perfilId
        ? await Promise.all([
            tieneConsentimiento(perfilId, 'documentacion_dni'),
            opinionVigente(perfilId, 'documentacion_dni'),
          ])
        : [false, null];

      // El veto del menor gana siempre. Es la parte más incómoda del diseño y
      // la más importante: el padre firmó, pero el chico no está de acuerdo.
      const bloqueadoPorOpinion = opinionVeda(opinion);
      const puedeSubir = Boolean(consentido) && !bloqueadoPorOpinion && Boolean(r.deportista_id);

      const motivoBloqueo = bloqueadoPorOpinion
        ? `${nombreCompleto} dijo que no autoriza que el club guarde su documentación. Su opinión prevalece aunque vos la autorices: si cambia de idea, lo hace desde su propio portal.`
        : !consentido
          ? 'Falta el consentimiento vigente para guardar la documentación. Pedilo en la secretaría del club.'
          : !r.deportista_id
            ? 'Todavía no hay ficha de jugador.'
            : null;

      return {
        id: r.id,
        tipo_vinculo: r.tipo_vinculo,
        perfiles: {
          nombre: r.nombre,
          apellido: r.apellido,
          dni: r.dni,
          telefono: r.telefono,
          correo: r.correo,
        },
        deportistas: r.deportista_id ? { club_activo: r.club_activo } : null,
        documentacion: {
          perfilId,
          nombre: nombreCompleto,
          dniFrenteUrl: r.dni_frente_url,
          dniFondoUrl: r.dni_fondo_url,
          tieneFicha: Boolean(r.deportista_id),
          puedeSubir,
          motivoBloqueo,
        },
      };
    })
  );

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Mis Hijos</h1><p className="text-gray-400 text-sm mt-1">Información de tus hijos deportistas</p></div>
      {hijos && hijos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hijos.map((h) => (
            <Card key={h.id} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shrink-0">{h.perfiles?.nombre?.[0]}{h.perfiles?.apellido?.[0]}</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white text-lg">{h.perfiles?.nombre} {h.perfiles?.apellido}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-xs">{h.tipo_vinculo}</Badge>
                      {h.deportistas && (
                        <Badge variant={h.deportistas.club_activo ? 'default' : 'secondary'} className={h.deportistas.club_activo ? 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/30' : 'bg-gray-500/10 text-gray-400 border-gray-500/30'}>
                          {h.deportistas.club_activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 space-y-1.5 text-sm text-gray-400">
                      <p className="flex items-center gap-2">DNI: {h.perfiles?.dni}</p>
                      {h.perfiles?.telefono && <p className="flex items-center gap-2"><Phone className="h-3 w-3" />{h.perfiles.telefono}</p>}
                      {h.perfiles?.correo && <p className="flex items-center gap-2"><Mail className="h-3 w-3" />{h.perfiles.correo}</p>}
                    </div>
                  </div>
                </div>
              </CardContent>

              {/* La documentación va fuera de la tarjeta: `Panel` trae su propio
                  borde y su propio título, y anidarlo dentro de una `Card`
                  dejaba dos cajas compitiendo por el mismo espacio. */}
              {h.documentacion.perfilId && (
                <div className="px-6 pb-6">
                  <SubirDocumentacion
                    perfilId={h.documentacion.perfilId}
                    nombre={h.documentacion.nombre}
                    dniFrenteUrl={h.documentacion.dniFrenteUrl}
                    dniFondoUrl={h.documentacion.dniFondoUrl}
                    tieneFicha={h.documentacion.tieneFicha}
                    puedeSubir={h.documentacion.puedeSubir}
                    motivoBloqueo={h.documentacion.motivoBloqueo}
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No tenés hijos vinculados</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}