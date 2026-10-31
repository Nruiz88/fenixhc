'use client';

import { useEffect, useState } from 'react';
import { ConfiguracionCuenta } from '@/components/ConfiguracionCuenta';
import AdminConfiguracionCuotas from './cuotas/page';
import AdminMercadoPago from './mercadopago/page';
import SolicitudesBaja from '@/app/admin/privacidad/solicitudes/page';
import Consentimientos from '@/app/admin/privacidad/consentimientos/page';
import { PageHeader } from '@/components/admin/ui';
import { getCurrentUser } from '@/lib/auth-client';
import { rolesDeUsuario, tieneRol } from '@/lib/roles';
import { User, Coins, Inbox, ShieldCheck, CreditCard } from 'lucide-react';

// Configuración del panel con pestañas en vez de una sola pantalla larga.
//
// Con varias secciones, unos botones que cambian la vista usan menos espacio
// que todo apilado, y no hay que scrollear para llegar a lo último.
//
// "Solicitudes de baja" es la primera porque es lo urgente: la ley obliga a
// responder en 10 días hábiles y la bandeja se llena sola, sin que nadie
// tenga que acordarse de mirarla.

const PESTANAS = [
  { clave: 'consentimientos', etiqueta: 'Consentimientos y menores', icono: ShieldCheck },
  { clave: 'solicitudes', etiqueta: 'Solicitudes de baja', icono: Inbox },
  { clave: 'cuotas', etiqueta: 'Cuotas y vencimientos', icono: Coins },
  // Solo el admin ve esta pestaña. La API también lo exige: esconder el
  // botón no alcanza, porque la ruta se puede abrir escribiendo la dirección.
  { clave: 'mercadopago', etiqueta: 'Cobros online', icono: CreditCard, soloAdmin: true },
  { clave: 'cuenta', etiqueta: 'Mi cuenta', icono: User },
] as const;

type Clave = (typeof PESTANAS)[number]['clave'];

export default function AdminConfiguracion() {
  const [pestana, setPestana] = useState<Clave>('consentimientos');
  const [esAdmin, setEsAdmin] = useState(false);

  useEffect(() => {
    getCurrentUser().then((user) => {
      setEsAdmin(!!user && tieneRol(rolesDeUsuario(user), 'admin'));
    });
  }, []);

  const visibles = PESTANAS.filter((p) => !('soloAdmin' in p) || !p.soloAdmin || esAdmin);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Consentimientos, pedidos de baja, precios de la cuota, cobros online y tus datos de acceso."
      />

      <div className="inline-flex flex-wrap rounded-lg border border-line bg-surface p-0.5">
        {visibles.map((p) => (
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

      {pestana === 'cuotas' && <AdminConfiguracionCuotas />}
      {pestana === 'mercadopago' && esAdmin && <AdminMercadoPago />}
      {pestana === 'cuenta' && <ConfiguracionCuenta />}
      {pestana === 'consentimientos' && <Consentimientos />}
      {pestana === 'solicitudes' && <SolicitudesBaja />}
    </div>
  );
}
