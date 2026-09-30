'use client';

import { useState } from 'react';
import { ConfiguracionCuenta } from '@/components/ConfiguracionCuenta';
import AdminConfiguracionCuotas from './cuotas/page';
import { PageHeader } from '@/components/admin/ui';
import { User, Coins } from 'lucide-react';

// Configuración del panel con pestañas en vez de una sola pantalla larga.
//
// Con dos secciones, dos botones que cambian la vista usan menos espacio que
// dos formularios apilados, y no hay que scrollear para llegar al segundo.

const PESTANAS = [
  { clave: 'cuotas', etiqueta: 'Cuotas y vencimientos', icono: Coins },
  { clave: 'cuenta', etiqueta: 'Mi cuenta', icono: User },
] as const;

type Clave = (typeof PESTANAS)[number]['clave'];

export default function AdminConfiguracion() {
  const [pestana, setPestana] = useState<Clave>('cuotas');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Precios de la cuota y tus datos de acceso."
      />

      <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
        {PESTANAS.map((p) => (
          <button
            key={p.clave}
            type="button"
            onClick={() => setPestana(p.clave)}
            className={
              pestana === p.clave
                ? 'flex items-center gap-1.5 rounded-md bg-surface-3 px-3 py-1.5 text-sm font-medium text-main transition-colors'
                : 'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:text-main'
            }
          >
            <p.icono className="h-4 w-4" />
            {p.etiqueta}
          </button>
        ))}
      </div>

      {pestana === 'cuotas' ? <AdminConfiguracionCuotas /> : <ConfiguracionCuenta />}
    </div>
  );
}
