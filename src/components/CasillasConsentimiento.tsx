'use client';

import { FINALIDADES, type Finalidad } from '@/lib/consentimientos';
import { cn } from '@/lib/utils';

// Casillas de consentimiento.
//
// DISEÑO — POR QUÉ NO ES "ACEPTO EL AVISO DE PRIVACIDAD"
//
// Un solo checkbox que dice que sí a todo no es consentimiento expreso: es un
// atajo. Y funciona bien para el adulto que quiere usar el portal, pero
// justo para lo que más importa —la foto del DNI de un chico— no alcanza.
//
// Por eso cada finalidad es su propia casilla, sin marcar, con el detalle de
// qué dato cae adentro y qué pasa si se dice que no. Que sea un poco más
// largo es el punto: la longitud ES la información.

export function CasillasConsentimiento({
  marcadas,
  onCambio,
  /** Versión del texto, para que quede claro cuál se está firmando. */
  version,
  className,
}: {
  marcadas: Finalidad[];
  onCambio: (f: Finalidad, marcada: boolean) => void;
  version: string;
  className?: string;
}) {
  const finales = Object.values(FINALIDADES);
  const revocables = finales.filter((f) => f.baseLegal === 'consentimiento');
  const obligatorias = finales.filter((f) => f.baseLegal !== 'consentimiento');

  return (
    <div className={cn('space-y-2.5', className)}>
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold text-gray-300">¿Para qué autorizás que el club use tus datos?</p>
        <span className="font-mono text-[10px] text-gray-600">{version}</span>
      </div>

      {revocables.map((f) => {
        const marcada = marcadas.includes(f.id);
        return (
          <label
            key={f.id}
            className={cn(
              'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors',
              marcada ? 'border-[#DC2626]/60 bg-[#DC2626]/10' : 'border-gray-700 bg-gray-800/40 hover:border-gray-600'
            )}
          >
            <input
              type="checkbox"
              checked={marcada}
              onChange={(e) => onCambio(f.id, e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#DC2626]"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-white">
                {f.etiqueta}
                {f.expreso && (
                  <span className="ml-2 rounded bg-[#DC2626]/20 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-[#DC2626]">
                    expreso
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-gray-400">{f.datos}</span>
              <span className="mt-1 block text-[11px] leading-relaxed text-gray-500 italic">
                Si no: {f.siNo}
              </span>
            </span>
          </label>
        );
      })}

      {/* Lo que el club guarda aunque no marques nada. Se muestra sin casilla
          a propósito: esconderlo daría la impresión de que es opcional, y
          no lo es. */}
      {obligatorias.map((f) => (
        <div
          key={f.id}
          className="rounded-lg border border-gray-700 border-dashed bg-gray-900/60 p-3"
        >
          <p className="text-[13px] font-medium text-gray-300">
            {f.etiqueta}
            <span className="ml-2 rounded bg-gray-700 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-gray-300">
              por obligación legal
            </span>
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-gray-400">{f.datos}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500 italic">{f.siNo}</p>
        </div>
      ))}
    </div>
  );
}
