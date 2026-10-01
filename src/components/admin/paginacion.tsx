'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Paginación del manual.
//
// POR QUÉ NO ES UN COMPONENTE DE UN `<select>` DE PÁGINAS
//
// El manual se lee, no se escanea: nadie va directo a la página 6. Va a
// recorrer los temas que le interesan y seguir leyendo. Por eso el control es
//una fila de números con contexto —"Mostrando 9 de 34"— y no un desplegable
//que obliga a saber cuántas páginas hay.
//
// Además, el manual se filtra por permisos: el total que ve la persona depende
//de su cargo. Por eso el total se calcula sobre lo visible, no sobre el manual
//completo. Un "página 3 de 5" que promete cinco páginas y después muestra dos es
//peor que no paginar.

const VENTANA = 2; // cuántas páginas aparecen a cada lado de la actual

export function Paginacion({
  pagina,
  totalPaginas,
  total,
  porPagina,
  onCambiar,
  etiqueta = 'tareas',
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  porPagina: number;
  onCambiar: (p: number) => void;
  etiqueta?: string;
}) {
  if (totalPaginas <= 1) {
    return (
      <p className="px-1 text-xs text-dim">
        {total} {etiqueta}
        {total === 1 ? '' : 's'}
      </p>
    );
  }

  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);

  /** Páginas a mostrar: 1, … alrededor de la actual, … última. */
  const numeros: (number | '…')[] = [];
  for (let i = 1; i <= totalPaginas; i++) {
    if (i === 1 || i === totalPaginas || Math.abs(i - pagina) <= VENTANA) {
      numeros.push(i);
    } else if (numeros[numeros.length - 1] !== '…') {
      numeros.push('…');
    }
  }

  return (
    <nav
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Paginación del manual"
    >
      <p className="text-xs text-dim">
        Mostrando <span className="tabular text-muted">{desde}</span>–
        <span className="tabular text-muted">{hasta}</span> de{' '}
        <span className="tabular text-muted">{total}</span> {etiqueta}
        {total === 1 ? '' : 's'}
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onCambiar(pagina - 1)}
          disabled={pagina === 1}
          aria-label="Página anterior"
          className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition-colors hover:border-line-strong hover:text-main disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {numeros.map((n, i) =>
          n === '…' ? (
            <span key={`gap-${i}`} className="px-1 text-xs text-dim">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onCambiar(n)}
              aria-current={n === pagina ? 'page' : undefined}
              className={cn(
                'h-8 min-w-8 rounded-lg border px-2 text-xs font-medium tabular transition-colors',
                n === pagina
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-line text-muted hover:border-line-strong hover:text-main'
              )}
            >
              {n}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onCambiar(pagina + 1)}
          disabled={pagina === totalPaginas}
          aria-label="Página siguiente"
          className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition-colors hover:border-line-strong hover:text-main disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}