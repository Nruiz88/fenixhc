'use client';

import { useMemo, useState } from 'react';
import { Panel, EmptyState, StatusPill, Hint, Toolbar } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { fecha } from '@/lib/format';
import { useJunta, accionJunta } from '../use-junta';
import { FolderOpen, Download, Search } from 'lucide-react';

// Documentos de los legajos: fichas, certificados, evaluaciones.
//
// Lo que se guarda acá es lo que el club necesita para acreditar identidad y
// antecedentes. No es galería: por eso hay una pestaña sola y no cuelga de la
// de fotos.
//
// LO PRIVADO
//
// `visibilidad: privado` es para lo que no debería circular entre toda la junta
// —una evaluación, una situación de salud—. La API lo filtra por rol, así que
// no es una casilla en la interfaz: es una fila que no llega.

interface Doc {
  id: string;
  perfil_id: string;
  nombre: string;
  tipo: string;
  url: string;
  visibilidad: string;
  notas: string | null;
  fecha: string;
  subido_por_nombre: string | null;
  jugador_nombre: string | null;
  jugador_apellido: string | null;
  jugador_dni: string | null;
}

const TIPOS = [
  ['ficha', 'Ficha'],
  ['certificado_estudios', 'Certificado de estudios'],
  ['copia_dni', 'Copia del DNI'],
  ['evaluacion', 'Evaluación'],
  ['planilla', 'Planilla'],
  ['otro', 'Otro'],
] as const;

const ETIQUETA: Record<string, string> = Object.fromEntries(TIPOS);

export function TabDocumentos() {
  const { datos, cargando, fallo, recargar } = useJunta<{
    lista: Doc[];
    puedeCargar: boolean;
    puedeDescargar: boolean;
  }>('documentos');
  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState('');

  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    return (datos?.lista ?? []).filter((d) => {
      if (tipo && d.tipo !== tipo) return false;
      if (!t) return true;
      return [d.nombre, d.jugador_nombre, d.jugador_apellido, d.jugador_dni]
        .some((v) => String(v ?? '').toLowerCase().includes(t));
    });
  }, [datos, busqueda, tipo]);

  return (
    <>
      <Panel
        title="Documentos de los legajos"
        description={`${filtrados.length} ${filtrados.length === 1 ? 'documento' : 'documentos'}`}
        bodyClassName="p-0"
      >
        <div className="border-b border-line p-3">
          <Toolbar>
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por jugador o nombre…"
                className="h-9 w-full rounded-lg border border-line bg-surface-2 pl-8 pr-3 text-sm text-main placeholder:text-dim"
              />
            </div>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="h-9 rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-main"
            >
              <option value="">Todos los tipos</option>
              {TIPOS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Toolbar>
        </div>

        {cargando ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : fallo ? (
          <p className="px-4 py-8 text-center text-sm text-danger">{fallo}</p>
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="h-6 w-6" />}
            title="No hay documentos"
            description="Se cargan desde la ficha del jugador, en Jugadores."
          />
        ) : (
          <ul className="divide-y divide-line">
            {filtrados.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-main">
                    <span className="font-medium">{d.nombre}</span>
                    <span className="ml-2 font-mono text-xs text-dim">{d.jugador_dni}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <StatusPill tone="neutral">{ETIQUETA[d.tipo] ?? d.tipo}</StatusPill>
                    <span className="text-[11px] text-dim">
                      {d.jugador_nombre} {d.jugador_apellido} · {fecha(d.fecha)}
                    </span>
                    {d.visibilidad === 'privado' && (
                      <StatusPill tone="warn">Privado</StatusPill>
                    )}
                  </div>
                </div>
                {datos?.puedeDescargar && (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-muted transition-colors hover:border-line-strong hover:text-main"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Abrir
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {!datos?.puedeDescargar && (
        <Hint>
          Podés ver que hay documentos, pero bajarlos es del cargo de presidencia
          o secretaría. Son copias de identidad de menores.
        </Hint>
      )}
    </>
  );
}
