'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search, ChevronRight, ArrowLeft, BookOpen, AlertTriangle, MapPin,
  Lightbulb, Sparkles, Users, DollarSign, PieChart, CalendarDays,
  Megaphone, Landmark, ShieldCheck,
} from 'lucide-react';
import { PageHeader, Panel, EmptyState, Hint, Toolbar } from '@/components/admin/ui';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Paginacion } from '@/components/admin/paginacion';
import { MANUAL, type TareaManual } from '@/lib/manual';
import { tieneModulo, ROL_LABEL, type Rol } from '@/lib/roles';
import { puede } from '@/lib/capacidades';
import { getCurrentUser } from '@/lib/auth-client';

// Manual de uso del panel.
//
// POR QUÉ ESTÁ DENTRO DE LA APLICACIÓN Y NO EN UN PDF
//
// Tres razones.
//
// La primera es que no se desactualiza. Cada tarea declara contra qué pantalla
// habla y contra qué permiso, y se filtra con `tieneModulo` y `puede`. Si a
// alguien no le corresponde una tarea, no la ve: es mejor que leer "cargá un
// comunicado" y encontrarse con que no puede.
//
// La segunda es que se puede mantener el enlace. El botón «Ir a la pantalla»
// manda a la ruta real. Si la pantalla se movió, el enlace se mueve con ella, y
// el test `manual.test.ts` avisa si alguna pantalla del panel quedó sin tarea.
//
// La tercera es el buscador. Un manual que hay que leer entero para encontrar
// una cosa no se usa cuando la necesitás.
//
// CÓMO SE ORDENA
//
// Por temas, no por menú. El menú del panel está ordenado por dónde vive cada
// cosa, que es lo que importa cuando ya sabés qué pantalla buscás. Acá está
// ordenado por qué querés hacer algo, que es lo que importa el primer día.

/** Los íconos que la sección declara, resueltos acá para no guardar JSX en datos. */
const ICONOS: Record<string, typeof Users> = {
  Sparkles, Users, DollarSign, PieChart, CalendarDays, Megaphone, Landmark, ShieldCheck,
};

const POR_PAGINA = 6;

/** Índice y tema, para que la barra de temas sepa qué marcar. */
interface ItemIndice {
  tarea: TareaManual;
  seccion: string;
  icono: string;
}

export default function AdminManual() {
  const router = useRouter();
  const [rol, setRol] = useState<Rol | undefined>(undefined);
  const [listo, setListo] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [tema, setTema] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [abierta, setAbierta] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      if (me?.rol) setRol(me.rol as Rol);
      setListo(true);
    })();
  }, []);

  // ── Filtrado ──────────────────────────────────────────────────────────
  //
  // El filtro depende del rol, así que no se calcula hasta que llegó. Antes de
  // eso no se muestra nada: mostrar de menos y pegar un salto cuando carga es
  // peor que mostrar un esqueleto.
  const secciones = useMemo(() => {
    if (!rol) return [];

    return MANUAL.map((s) => ({
      ...s,
      tareas: s.tareas.filter((t) => {
        if (t.modulo && !tieneModulo(rol, t.modulo)) return false;
        if (t.capacidad && !puede(rol, t.capacidad)) return false;
        return true;
      }),
    })).filter((s) => s.tareas.length > 0);
  }, [rol]);

  /** Todas las tareas visibles, en aplanada, con el tema al que pertenecen. */
  const items: ItemIndice[] = useMemo(
    () =>
      secciones.flatMap((s) =>
        s.tareas.map((tarea) => ({ tarea, seccion: s.titulo, icono: s.icono }))
      ),
    [secciones]
  );

  /** Lo que se muestra: por tema elegido y por lo que se buscó. */
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    return items.filter((i) => {
      if (tema && i.seccion !== tema) return false;
      if (!q) return true;
      return (
        [
          i.tarea.titulo,
          i.tarea.resumen,
          i.tarea.ejemplo ?? '',
          ...i.tarea.pasos.map((p) => p.texto),
          ...i.tarea.pasos.map((p) => p.nota ?? ''),
          ...(i.tarea.avisos ?? []),
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    });
  }, [items, tema, busqueda]);

  // Cambiar el filtro puede dejar la persona en una página que ya no existe.
  // Vuelve a la primera siempre: es lo que uno espera al cambiar algo.
  useEffect(() => {
    setPagina(1);
  }, [busqueda, tema]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const visibles = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const tareaAbierta = abierta ? items.find((i) => i.tarea.id === abierta)?.tarea : null;

  // ── Vista de una tarea ────────────────────────────────────────────────
  if (abierta && !tareaAbierta) {
    // La tarea dejó de estar visible, por ejemplo porque cambió el filtro.
    // Volver al índice es mejor que una pantalla vacía sin explicación.
    setAbierta(null);
    return null;
  }

  if (tareaAbierta) {
    const lasDeMas = items.filter(
      (i) =>
        i.seccion === items.find((x) => x.tarea.id === tareaAbierta.id)!.seccion &&
        i.tarea.id !== tareaAbierta.id
    );

    return (
      <div className="space-y-5">
        <nav aria-label="Ruta" className="flex items-center gap-1.5 text-xs text-dim">
          <button
            type="button"
            onClick={() => setAbierta(null)}
            className="hover:text-muted"
          >
            Manual
          </button>
          <ChevronRight className="h-3 w-3" />
          <span className="text-muted">
            {items.find((x) => x.tarea.id === tareaAbierta.id)!.seccion}
          </span>
        </nav>

        <div>
          <h1 className="text-xl font-bold tracking-tight text-main">{tareaAbierta.titulo}</h1>
          <p className="mt-1 text-sm text-muted">{tareaAbierta.resumen}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="space-y-4">
            <Panel title="Cómo hacerlo">
              {/* Los pasos van numerados y unidos por una línea. El paso que
                  estás haciendo tiene que ser el que estás mirando: sin esa
                  línea, el "3 de 4" flotando es difícil de ubicar. */}
              <ol className="relative space-y-4">
                <span
                  aria-hidden
                  className="absolute left-[11px] top-3 bottom-3 w-px bg-line"
                />
                {tareaAbierta.pasos.map((p, i) => (
                  <li key={i} className="relative flex gap-3.5">
                    <span className="z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white ring-4 ring-surface">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 pb-0.5">
                      <p className="text-sm leading-relaxed text-main">{p.texto}</p>
                      {p.nota && (
                        <p className="mt-1 border-l-2 border-line pl-3 text-xs leading-relaxed text-dim">
                          {p.nota}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-5 border-t border-line pt-4">
                <Button variant="outline" size="sm" onClick={() => router.push(tareaAbierta.ruta)}>
                  <MapPin className="h-4 w-4" />
                  Ir a la pantalla
                </Button>
              </div>
            </Panel>

            {tareaAbierta.ejemplo && (
              <Panel title="Ejemplo" className="border-info/25">
                {/* El ejemplo va en su propia caja y no mezclado con los pasos:
                    es otra cosa. Uno es lo que hay que hacer, el otro es cómo
                    se ve cuando salió bien. */}
                <div className="flex gap-3">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                  <p className="text-sm leading-relaxed text-muted">{tareaAbierta.ejemplo}</p>
                </div>
              </Panel>
            )}

            {tareaAbierta.avisos && tareaAbierta.avisos.length > 0 && (
              <Panel title="Ojo con esto" className="border-warn/30">
                <ul className="space-y-2.5">
                  {tareaAbierta.avisos.map((a, i) => (
                    <li key={i} className="flex gap-2.5">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
                      <span className="text-sm leading-relaxed text-muted">{a}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>

          {/* Columna lateral: el tema al que pertenece y qué más hay adentro.
              Alguien que llegó buscando una tarea probablemente va a querer
              otra del mismo tema sin volver al índice. */}
          <aside className="space-y-4">
            <Panel title="En el mismo tema">
              {lasDeMas.length === 0 ? (
                <p className="text-xs text-dim">Es la única tarea de este tema.</p>
              ) : (
                <ul className="space-y-1.5">
                  {lasDeMas.map((i) => (
                    <li key={i.tarea.id}>
                      <button
                        type="button"
                        onClick={() => setAbierta(i.tarea.id)}
                        className="flex w-full items-start gap-1.5 rounded-lg px-1.5 py-1 text-left text-xs text-muted transition-colors hover:bg-surface-2 hover:text-main"
                      >
                        <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-dim" />
                        <span>{i.tarea.titulo}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setAbierta(null)}
            >
              <ArrowLeft className="h-4 w-4" />Volver al manual
            </Button>
          </aside>
        </div>
      </div>
    );
  }

  // ── Vista del índice ──────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <PageHeader
        title="Manual del panel"
        description="Cómo se usa cada parte. Buscá lo que necesitás hacer."
      />

      <Hint>
        Acá vas a encontrar solo las tareas que te corresponden. Si algo que hacés
        vos no está, es que todavía no está escrito:{' '}
        <strong className="text-main">decile a quien administra el sistema</strong>.
        {rol && (
          <>
            {' '}
            Vos entrás como <strong className="text-main">{ROL_LABEL[rol]}</strong>.
          </>
        )}
      </Hint>

      <Panel bodyClassName="p-3">
        <Toolbar>
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar una tarea…"
              className="pl-8"
              aria-label="Buscar en el manual"
            />
          </div>
          {!listo ? null : (
            <p className="shrink-0 text-xs text-dim">
              {busqueda
                ? `${filtrados.length} resultado${filtrados.length === 1 ? '' : 's'}`
                : `${items.length} tarea${items.length === 1 ? '' : 's'}`}
            </p>
          )}
        </Toolbar>
      </Panel>

      {!listo ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-2" />
          ))}
        </div>
      ) : (
        <>
          {/* Temas. No es solo decoración: es el índice real del manual.
              Alguien que quiere "cobrar" va directo ahí sin recorrer las 34
              tareas buscando. */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => setTema(null)}
              className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                tema === null
                  ? 'border-brand bg-brand/5'
                  : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2'
              }`}
            >
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-main">Todos los temas</p>
                <p className="text-xs text-dim">{items.length} tareas</p>
              </div>
            </button>

            {secciones.map((s) => {
              const Icono = ICONOS[s.icono] ?? BookOpen;
              const activo = tema === s.titulo;
              return (
                <button
                  key={s.titulo}
                  type="button"
                  onClick={() => setTema(activo ? null : s.titulo)}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                    activo
                      ? 'border-brand bg-brand/5'
                      : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2'
                  }`}
                >
                  <Icono className="mt-0.5 h-4 w-4 shrink-0 text-dim" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-main">{s.titulo}</p>
                    <p className="text-xs text-dim">
                      {s.tareas.length} tarea{s.tareas.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* El tema elegido, con su introducción. */}
          {tema && (
            <div className="rounded-xl border border-line bg-surface px-4 py-3">
              <p className="text-sm font-medium text-main">{tema}</p>
              <p className="mt-0.5 text-xs text-dim">
                {secciones.find((s) => s.titulo === tema)?.intro}
              </p>
            </div>
          )}

          {filtrados.length === 0 ? (
            <Panel>
              <EmptyState
                icon={<Search className="h-6 w-6" />}
                title="No hay resultados"
                description={
                  tema
                    ? `Ninguna tarea de «${tema}» coincide con «${busqueda.trim()}».`
                    : `Nada coincide con «${busqueda.trim()}». Probá con una palabra más general, como "pago" o "socio".`
                }
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBusqueda('');
                      setTema(null);
                    }}
                  >
                    Ver todas las tareas
                  </Button>
                }
              />
            </Panel>
          ) : (
            <>
              <ul className="space-y-2">
                {visibles.map(({ tarea, seccion: sec, icono }) => {
                  const Icono = ICONOS[icono] ?? BookOpen;
                  return (
                    <li key={tarea.id}>
                      <button
                        type="button"
                        onClick={() => setAbierta(tarea.id)}
                        className="group flex w-full items-center gap-3.5 rounded-xl border border-line bg-surface p-3.5 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2">
                          <Icono className="h-4 w-4 text-dim" />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-x-2">
                            <span className="text-sm font-medium text-main">
                              {tarea.titulo}
                            </span>
                            <span className="text-[11px] text-dim">{sec}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-dim">
                            {tarea.resumen}
                          </span>
                        </span>

                        {(tarea.avisos?.length ?? 0) > 0 && (
                          <AlertTriangle
                            className="h-4 w-4 shrink-0 text-warn"
                            aria-label="Tiene advertencias"
                          />
                        )}
                        <ChevronRight className="h-4 w-4 shrink-0 text-dim transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>

              <Paginacion
                pagina={pagina}
                totalPaginas={totalPaginas}
                total={filtrados.length}
                porPagina={POR_PAGINA}
                onCambiar={setPagina}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}