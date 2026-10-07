'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { udb } from '@/lib/userQuery';
import { uploadDni } from '@/lib/upload';
import { Panel, Hint } from '@/components/admin/ui';
import { Upload, Loader2, FileCheck2, Lock, RefreshCw } from 'lucide-react';

/**
 * Subir la foto del DNI de un jugador desde el portal del padre.
 *
 * POR QUÉ ESTO EXISTE Y NO ESTABA
 *
 * El padre es quien tiene el documento en la mano. Antes el único lugar para
 * subirlo era el portal del propio cadete: un pibe de 8 años no entra a su
 * cuenta a subir una foto, así que la documentación del club se completaba
 *printed en papel y la foto nunca llegaba. El backend YA lo autorizaba —la
 * condición de propiedad del benefactor incluye a sus hijos y la puerta de
 * consentimiento mira al titular del dato, no a quien escribe—, pero no había
 * ningún botón. Un permiso sin botón detrás.
 *
 * DOS COSAS QUE NO SON COSMETICAS
 *
 * 1) El nombre del archivo lleva el id del JUGADOR, no el del padre. Los
 *    archivos cuelgan de la carpeta de quien sube, así que un nombre fijo
 *    (`dni-frente.jpg`) haría que el segundo hijo pise al primero.
 *
 * 2) Se mira el resultado del UPDATE. Si el archivo se sube pero la escritura
 *    es rechazada —porque falta el consentimiento o porque el jugador dijo que
 *    no—, la pantalla tiene que decirlo. Si solo avisáramos "listo", el club le
 *    diría a una familia que tiene la documentación cuando en realidad no la
 *    tiene guardada.
 */

const MAX_MB = 10;

const CARAS = [
  { id: 'frente' as const, titulo: 'Frente', ayuda: 'La cara con el foto y los datos.' },
  { id: 'fondo' as const, titulo: 'Dorso', ayuda: 'La cara de atrás, con el código.' },
];

export function SubirDocumentacion({
  perfilId,
  nombre,
  dniFrenteUrl,
  dniFondoUrl,
  tieneFicha,
  puedeSubir,
  motivoBloqueo,
}: {
  perfilId: string;
  nombre: string;
  dniFrenteUrl?: string | null;
  dniFondoUrl?: string | null;
  tieneFicha: boolean;
  puedeSubir: boolean;
  motivoBloqueo?: string | null;
}) {
  const [urls, setUrls] = useState<Record<'frente' | 'fondo', string | null>>({
    frente: dniFrenteUrl ?? null,
    fondo: dniFondoUrl ?? null,
  });
  const [subiendo, setSubiendo] = useState<'frente' | 'fondo' | null>(null);
  // El <input> real queda oculto detrás de un label. Guardar el elemento es lo
  // único que permite volver a abrirlo para reemplazar una foto ya subida.
  const inputs = useRef<Partial<Record<'frente' | 'fondo', HTMLInputElement | null>>>({});

  const completa = Boolean(urls.frente && urls.fondo);

  async function subir(lado: 'frente' | 'fondo', file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Tiene que ser una imagen', { description: 'El DNI se sube como foto o escaneo.' });
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error('La imagen es muy grande', {
        description: `Pesá más de ${MAX_MB} MB. Bajala de resolución o sacale los metadatos y volvé a intentar.`,
      });
      return;
    }

    setSubiendo(lado);
    try {
      const url = await uploadDni(perfilId, file, lado);
      if (!url) {
        toast.error('No pudimos subir el archivo');
        return;
      }

      const columna = lado === 'frente' ? 'dni_frente_url' : 'dni_fondo_url';
      const { error } = await udb.update('deportistas', { [columna]: url }, { perfil_id: perfilId });

      if (error) {
        // El mensaje del servidor es el que vale: distingue "no hay ficha" de
        // "falta consentimiento" de "el jugador dijo que no", y los tres se
        // resuelven de forma distinta.
        toast.error('Guardamos el archivo pero no pudimos anotarlo', {
          description: error,
          duration: 12000,
        });
        return;
      }

      setUrls((prev) => ({ ...prev, [lado]: url }));
      toast.success(`${lado === 'frente' ? 'Frente' : 'Dorso'} del DNI de ${nombre} guardado`);
    } finally {
      setSubiendo(null);
      // Se limpia el input para que elegir el MISMO archivo otra vez dispare el
      // onChange: sin esto, reemplazar una foto por otra igual no hace nada.
      if (inputs.current[lado]) inputs.current[lado]!.value = '';
    }
  }

  return (
    <Panel
      title="Documentación del DNI"
      description={completa ? 'Completa' : 'Falta una de las dos caras'}
      actions={
        completa ? (
          <FileCheck2 className="h-4 w-4 text-ok" />
        ) : (
          <Upload className="h-4 w-4 text-dim" />
        )
      }
    >
      {!tieneFicha ? (
        <Hint>
          {nombre} todavía no tiene ficha de jugador en el club, así que no hay
          dónde guardar la documentación. Hablá con la secretaría para regularizar
          la inscripción.
        </Hint>
      ) : !puedeSubir ? (
        <div className="rounded-lg border border-danger/50 bg-danger/10 p-3">
          <p className="flex items-start gap-2 text-[13px] font-medium text-danger">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            No se puede guardar la documentación de {nombre}
          </p>
          <p className="mt-1 pl-5.5 text-[11px] leading-relaxed text-muted">
            {motivoBloqueo ??
              'Falta el consentimiento vigente para guardar la documentación.'}
          </p>
        </div>
      ) : (
        <Hint>
          El club usa estas fotos solo para verificar la identidad de {nombre} como
          jugador. No se publican en ningún lado.
        </Hint>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        {CARAS.map(({ id, titulo, ayuda }) => {
          const url = urls[id];
          const cargando = subiendo === id;
          const habilitada = tieneFicha && puedeSubir && !cargando;

          return (
            <div key={id} className="rounded-lg border border-line bg-surface-2 p-3">
              <p className="text-[13px] font-medium text-main">{titulo}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-dim">{ayuda}</p>

              <div className="mt-2.5">
                {url ? (
                  <div className="space-y-2">
                    <div className="relative overflow-hidden rounded-md border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`DNI de ${nombre}, ${titulo.toLowerCase()}`}
                        className="h-32 w-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!habilitada}
                      onClick={() => inputs.current[id]?.click()}
                      className="flex w-full items-center justify-center gap-1.5 rounded border border-line px-2 py-1.5 text-[11px] font-medium text-muted transition-colors hover:border-line-strong hover:text-main disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {cargando ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      Reemplazar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!habilitada}
                    onClick={() => inputs.current[id]?.click()}
                    className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-line text-dim transition-colors hover:border-line-strong hover:text-muted disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {cargando ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                    <span className="text-[11px] font-medium">
                      {cargando ? 'Subiendo...' : 'Elegir foto'}
                    </span>
                  </button>
                )}
              </div>

              <input
                ref={(el) => {
                  inputs.current[id] = el;
                }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) subir(id, file);
                }}
              />
            </div>
          );
        })}
      </div>
    </Panel>
  );
}