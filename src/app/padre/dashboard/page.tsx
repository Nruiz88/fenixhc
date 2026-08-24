'use client';
import { useState, useEffect } from 'react';
import { udb } from '@/lib/userQuery';
import { Card, CardContent } from '@/components/ui/card';
import { Users, DollarSign, Clock, CheckCircle, AlertCircle, Calendar, Image } from 'lucide-react';
import Link from 'next/link';

export default function PadreDashboard() {
  const [perfil, setPerfil] = useState<any>(null);
  const [hijos, setHijos] = useState<any[]>([]);
  const [cuotas, setCuotas] = useState<any[]>([]);
  const [notifs, setNotifs] = useState<any[]>([]);

  useEffect(() => {
    udb.select('perfiles', '*', undefined, { single: true }).then(({ data }) => setPerfil(data));
    udb.select('familias', '*, perfiles!deportista_perfil_id(nombre, apellido, dni)').then(({ data }) => setHijos(data || []));
    udb.select('cuotas', '*, familias(perfiles!deportista_perfil_id(nombre, apellido))').then(({ data }) => setCuotas(data || []));
    udb.select('notificaciones', '*').then(({ data }) => {
      setNotifs((data || []).filter((n: any) => n.destinatario_rol === 'padre' || n.destinatario_rol === 'todos').slice(0, 3));
    });
  }, []);

  const cuotasPendientes = cuotas.filter(c => c.estado === 'pendiente');
  const cuotasPagadas = cuotas.filter(c => c.estado === 'pagada');
  const totalPagado = cuotasPagadas.reduce((s: number, c: any) => s + Number(c.monto), 0);
  const totalPendiente = cuotasPendientes.reduce((s: number, c: any) => s + Number(c.monto), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Hola, {perfil?.nombre || '...'}</h1>
        <p className="text-gray-400 mt-1">Resumen de tu cuenta</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white shadow-lg shadow-blue-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
          <Users className="h-6 w-6 mb-2 text-blue-200" />
          <p className="text-sm text-blue-200">Mis Hijos</p>
          <p className="text-3xl font-extrabold mt-1">{hijos.length}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white shadow-lg shadow-[#DC2626]/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
          <CheckCircle className="h-6 w-6 mb-2 text-emerald-200" />
          <p className="text-sm text-emerald-200">Pagadas</p>
          <p className="text-3xl font-extrabold mt-1">{cuotasPagadas.length}</p>
          <p className="text-xs text-[#DC2626] mt-1">${totalPagado.toLocaleString('es-AR')}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-white shadow-lg shadow-amber-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
          <AlertCircle className="h-6 w-6 mb-2 text-amber-200" />
          <p className="text-sm text-amber-200">Pendientes</p>
          <p className="text-3xl font-extrabold mt-1">{cuotasPendientes.length}</p>
          <p className="text-xs text-amber-300 mt-1">${totalPendiente.toLocaleString('es-AR')}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 p-5 text-white shadow-lg shadow-violet-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
          <DollarSign className="h-6 w-6 mb-2 text-violet-200" />
          <p className="text-sm text-violet-200">Total Cuotas</p>
          <p className="text-3xl font-extrabold mt-1">{cuotas.length}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pagos', href: '/padre/pagos', icon: DollarSign, color: 'bg-[#DC2626]/10 text-[#DC2626]' },
          { label: 'Mis Hijos', href: '/padre/hijos', icon: Users, color: 'bg-blue-500/10 text-blue-400' },
          { label: 'Fotos', href: '/padre/fotos', icon: Image, color: 'bg-violet-500/10 text-violet-400' },
          { label: 'Reservas', href: '/padre/reservas', icon: Calendar, color: 'bg-amber-500/10 text-amber-400' },
        ].map((a) => (
          <Link key={a.href} href={a.href}>
            <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-all cursor-pointer group">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${a.color} group-hover:scale-110 transition-transform`}>
                  <a.icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-white">{a.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Children & Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="bg-gray-900 border-gray-800">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Users className="h-4 w-4 text-blue-400" /> Mis Hijos</h2>
          </div>
          <CardContent className="p-0">
            {hijos.length > 0 ? (
              <div className="divide-y divide-gray-800">
                {hijos.map((h: any) => (
                  <div key={h.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-800/50 transition-colors">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">{h.perfiles?.nombre?.[0]}{h.perfiles?.apellido?.[0]}</div>
                    <div>
                      <p className="text-sm font-medium text-white">{h.perfiles?.nombre} {h.perfiles?.apellido}</p>
                      <p className="text-xs text-gray-500">{h.tipo_vinculo} • DNI: {h.perfiles?.dni}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="px-6 py-8 text-center text-gray-500 text-sm">Sin hijos vinculados</div>}
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2"><AlertCircle className="h-4 w-4 text-amber-400" /> Notificaciones</h2>
          </div>
          <CardContent className="p-0">
            {notifs.length > 0 ? (
              <div className="divide-y divide-gray-800">
                {notifs.map((n: any) => (
                  <div key={n.id} className="px-6 py-4 hover:bg-gray-800/50 transition-colors">
                    <p className="text-sm font-medium text-white">{n.titulo}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{n.mensaje}</p>
                  </div>
                ))}
              </div>
            ) : <div className="px-6 py-8 text-center text-gray-500 text-sm">Sin notificaciones</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
