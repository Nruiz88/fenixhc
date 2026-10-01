'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MANUAL, type TareaManual } from '@/lib/manual';
import { tieneModulo, ROL_LABEL } from '@/lib/roles';
import { puede as tieneCapacidad } from '@/lib/capacidades';
import { getCurrentUser } from '@/lib/auth-client';
import { useEffect } from 'react';
import {
  PageHeader, Panel, EmptyState, Hint, Toolbar, StatusPill,
} from '@/components/admin/ui';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search, ChevronRight, ArrowLeft, BookOpen, AlertTriangle, MapPin,
} from 'lucide-react';

// Manual de uso del panel.
//
// POR QUÉ ESTÁ DENTRO DE LA APLICACIÓN Y NO EN UN PDF
//
// Tres razones.
//
// La primera es que no se desactualiza. Cada tarea declara contra qué pantalla
// habla y contra qué permiso, y se filtra con `tieneModulo` y `tieneCapacidad`.
// Si a alguien no le corresponde una tarea, no la ve: es mejor que leer "cargá
// un comunicado" y encontrarse con que no puede.
//
// La segunda es que se puede mantener el enlace. El botón «Ir a la pantalla» manda a
// la ruta real. Si la pantalla se movió, el enlace se mueve con ella, y el test
// `manual.test.ts` avisa si alguna pantalla del panel quedó sin tarea en él.
//
// La tercera es el buscador. Un manual que hay que leer entero para encontrar
// una cosa no se usa cuando la necesitás.

interface TareaVisible extends TareaManual {
  clave: string;
}

export default function AdminManual() {
  const router = useRouter();
  const [rol, setRol] = useState<string | undefined>(undefined);
  const [busqueda, setBusqueda] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      setRol(me?.rol);
    })();
  }, []);

  // El rol tarda en llegar. Mientras tanto no se calcula nada, para no mostrar
  // de menos y pegar un salto cuando cargue.
  const secciones = useMemo(() => {
    if (!rol) return [];

    return MANUAL.map((s) => {
      const tareas = s.tareas
        .filter((t) => !t.modulo || tieneModulo(rol as any, t.modulo))
        .filter((t) => !t.capacidad || tieneCapacidad(rol as any, t.capacidad))
        .filter((t) => {
          const q = busqueda.trim().toLowerCase();
          if (!q) return true;
          const texto = [
            t.titulo,
            t.resumen,
            ...t.pasos.map((p) => p.texto),
            ...(t.avisos ?? []),
          ]
            .join(' ')
            .toLowerCase();
          return texto.includes(q);
        })
        .map((t) => ({ ...t, clave: `${s.titulo}::${t.id}` }));

      return { ...s, tareas };
    }).filter((s) => s.tareas.length > 0);
  }, [rol, busqueda]);

  const total = secciones.reduce((n, s) => n + s.tareas.length, 0);

  // ── Vista de una tarea ────────────────────────────────────────────────
  if (abierta) {
    const tarea = secciones.flatMap((s) => s.tareas).find((t) => t.clave === abierta);

    if (!tarea) {
      // La tarea dejó de estar visible, por ejemplo porque cambió el filtro.
      // Volver al índice es mejor que mostrar una pantalla vacía.
      setAbierta(null);
      return null;
    }

    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setAbierta(null)}>
          <ArrowLeft className="h-4 w-4" />Volver al manual
        </Button>

        <div>
          <h1 className="text-xl font-bold text-main">{tarea.titulo}</h1>
          <p className="mt-1 text-sm text-muted">{tarea.resumen}</p>
        </div>

        <Panel title="Cómo hacerlo">
          <ol className="space-y-3">
            {tarea.pasos.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-main">{p.texto}</p>
                  {p.nota && <p className="mt-0.5 text-xs leading-relaxed text-dim">{p.nota}</p>}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-5 border-t border-line pt-4">
            <Button variant="outline" size="sm" onClick={() => router.push(tarea.ruta)}>
              <MapPin className="h-4 w-4" />
              Ir a la pantalla
            </Button>
          </div>
        </Panel>

        {tarea.avisos && tarea.avisos.length > 0 && (
          <Panel
            title="Ojo con esto"
            className="border-warn/30"
          >
            <ul className="space-y-2.5">
              {tarea.avisos.map((a, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-muted">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    );
  }

  // ── Vista del índice ──────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="Manual del panel"
        description="Cómo se usa cada parte. Buscá lo que necesitás hacer."
      />

      <Hint>
        Este manual muestra solo las tareas que te corresponden. Si algo que hacés
        vos no está, es que todavía no está escrito:{' '}
        <strong className="text-main">decile a quien administra el sistema</strong>.
        {rol && (
          <>
            {' '}
            Vos entrás como <StatusPill tone="info">{ROL_LABEL[rol as keyof typeof ROL_LABEL]}</StatusPill>.
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
          <p className="shrink-0 text-xs text-dim">
            {busqueda ? `${total} resultado${total === 1 ? '' : 's'}` : `${total} tareas`}
          </p>
        </Toolbar>
      </Panel>

      {!rol ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-2" />
          ))}
        </div>
      ) : total === 0 ? (
        <Panel>
          <EmptyState
            icon={<BookOpen className="h-6 w-6" />}
            title="No hay resultados"
            description={`Nada en el manual coincide con «${busqueda.trim()}». Probá con una palabra más general, como "pago" o "socio".`}
            action={
              busqueda ? (
                <Button variant="outline" size="sm" onClick={() => setBusqueda('')}>
                  Ver todas las tareas
                </Button>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        secciones.map((s) => (
          <section key={s.titulo}>
            <Panel title={s.titulo} description={s.intro} bodyClassName="p-0">
              <ul className="divide-y divide-line">
                {s.tareas.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setAbierta(t.clave)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-main">{t.titulo}</p>
                        <p className="mt-0.5 truncate text-xs text-dim">{t.resumen}</p>
                      </div>
                      {(t.avisos?.length ?? 0) > 0 && (
                        <AlertTriangle
                          className="h-4 w-4 shrink-0 text-warn"
                          aria-label="Tiene advertencias"
                        />
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-dim" />
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          </section>
        ))
      )}
    </div>
  );
}