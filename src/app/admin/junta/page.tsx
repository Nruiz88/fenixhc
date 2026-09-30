'use client';

import { useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from '@/lib/auth-client';
import { puede, ETIQUETA_CAPACIDAD, type Capacidad } from '@/lib/capacidades';
import { PageHeader, Panel, Hint } from '@/components/admin/ui';
import { cn } from '@/lib/utils';
import { TabComunicaciones } from './tabs/comunicaciones';
import { TabPartes } from './tabs/partes';
import { TabDocumentos } from './tabs/documentos';
import { TabSeguros } from './tabs/seguros';
import { TabRecibos } from './tabs/recibos';
import { TabInventario } from './tabs/inventario';

// La puerta a la sección.
//
// POR QUÉ LAS PESTAÑAS SE CALCULAN EN EL CLIENTE Y NO VIENEN FIJAS
//
// Un vocal que entra ve "Comunicaciones" y "Fotos". Si las pestañas fueran las
// mismas para todos, tendría seis tabs de los que cinco le dicen "no tenés
// permiso". Peor: si una está visible pero el botón dentro no, la persona
// descubre la restricción clickeando, y lo que tiene que comunicar es que no
// la tiene.
//
// Igual el chequeo NO está solamente acá. La API vuelve a aplicar la capacidad
// en cada rama: esconder un tab es una cortesía, y una cortesía no es un
// control de acceso.

interface Tab {
  clave: string;
  etiqueta: string;
  capacidad: Capacidad;
  icono: typeof PageHeader;
  Componente: React.ComponentType;
}

const TABS: Tab[] = [
  {
    clave: 'comunicaciones',
    etiqueta: 'Comunicaciones internas',
    capacidad: 'ver_comunicacion_interna',
    icono: PageHeader,
    Componente: TabComunicaciones,
  },
  {
    clave: 'partes',
    etiqueta: 'Partes',
    capacidad: 'ver_parte_administrativo',
    icono: PageHeader,
    Componente: TabPartes,
  },
  {
    clave: 'documentos',
    etiqueta: 'Documentos de legajos',
    capacidad: 'ver_documentos_legajo',
    icono: PageHeader,
    Componente: TabDocumentos,
  },
  {
    clave: 'seguros',
    etiqueta: 'Seguro',
    capacidad: 'adherentes_seguro',
    icono: PageHeader,
    Componente: TabSeguros,
  },
  {
    clave: 'recibos',
    etiqueta: 'Recibos',
    capacidad: 'emitir_recibos',
    icono: PageHeader,
    Componente: TabRecibos,
  },
  {
    clave: 'inventario',
    etiqueta: 'Equipos',
    capacidad: 'ver_inventario',
    icono: PageHeader,
    Componente: TabInventario,
  },
];

export default function JuntaDirectiva() {
  const [rol, setRol] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [pestana, setPestana] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      setRol(user?.rol ?? null);
      setCargando(false);
    })();
  }, []);

  // Solo las pestañas que el cargo puede abrir. La de partes tiene dos: si el
  // cargo no puede ver la administrativa pero sí la financiera, no se oculta
  // entera.
  const visibles = useMemo(
    () =>
      TABS.filter((t) => {
        if (rol === 'tesorero' && t.clave === 'partes') {
          return puede(rol, 'ver_parte_financiero');
        }
        return puede(rol, t.capacidad);
      }),
    [rol]
  );

  // Si la pestaña elegida deja de estar disponible —porque el usuario cambió o
  // porque se recarga—, se vuelve a la primera que se pueda.
  const activa = pestana && visibles.some((t) => t.clave === pestana) ? pestana : visibles[0]?.clave;

  if (cargando) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-surface" />
        <div className="h-80 animate-pulse rounded-xl bg-surface" />
      </div>
    );
  }

  if (visibles.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Junta directiva" />
        <Hint tone="warn">
          Tu cargo no tiene ninguna sección habilitada. Si te corresponde ver algo,
          hablá con la presidencia.
        </Hint>
      </div>
    );
  }

  const Actual = visibles.find((t) => t.clave === activa)?.Componente;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Junta directiva"
        description="Lo del club por dentro. No sale de acá."
      />

      <nav className="flex flex-wrap gap-1 border-b border-line">
        {visibles.map((t) => (
          <button
            key={t.clave}
            type="button"
            onClick={() => setPestana(t.clave)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
              t.clave === activa
                ? 'border-brand font-medium text-main'
                : 'border-transparent text-muted hover:border-line-strong hover:text-main'
            )}
          >
            {t.etiqueta}
          </button>
        ))}
      </nav>

      {Actual && <Actual />}

      {/* Para qué son las cosas, en una sola línea. La matriz de capacidades es
          larga y cuando algo no aparece lo natural es pensar que es un error. */}
      <p className="text-[11px] leading-relaxed text-dim">
        {visibles
          .map((t) => ETIQUETA_CAPACIDAD[t.capacidad])
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(' · ')}
      </p>
    </div>
  );
}
