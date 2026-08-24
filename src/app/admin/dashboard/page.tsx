export const dynamic = 'force-dynamic';

import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, DollarSign, TrendingUp, TrendingDown, Calendar, AlertCircle, CheckCircle } from 'lucide-react';

export default async function AdminDashboard() {
  const supabase = createAdminClient();
  const [socios, jugadores, cuotas, finanzas, reservas, notifs] = await Promise.all([
    supabase.from('perfiles').select('id', { count: 'exact' }).eq('rol', 'padre'),
    supabase.from('deportistas').select('id', { count: 'exact' }),
    supabase.from('cuotas').select('*'),
    supabase.from('finanzas').select('*'),
    supabase.from('reservas').select('*, canchas(nombre)').order('fecha', { ascending: false }).limit(5),
    supabase.from('notificaciones').select('*').order('created_at', { ascending: false }).limit(5),
  ]);

  const cuotasPagadas = cuotas.data?.filter((c: any) => c.estado === 'pagada') || [];
  const cuotasPendientes = cuotas.data?.filter((c: any) => c.estado === 'pendiente') || [];
  const totalIngresos = cuotasPagadas.reduce((s: number, c: any) => s + Number(c.monto), 0);
  const ingresos = finanzas.data?.filter((f: any) => f.tipo === 'ingreso') || [];
  const egresos = finanzas.data?.filter((f: any) => f.tipo === 'egreso') || [];
  const totalExtra = ingresos.reduce((s: number, f: any) => s + Number(f.monto), 0);
  const totalEgresos = egresos.reduce((s: number, f: any) => s + Number(f.monto), 0);
  const balance = totalIngresos + totalExtra - totalEgresos;
  const cobroMensual = 75000 * (socios.count || 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Panel del Club</h1>
        <p className="text-gray-400 mt-1">Resumen general del club deportivo</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 text-white shadow-lg shadow-[#DC2626]/20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <Users className="h-8 w-8 mb-3 text-emerald-200" />
          <p className="text-sm text-emerald-200 font-medium">Socios (Padres)</p>
          <p className="text-4xl font-extrabold mt-1">{socios.count || 0}</p>
          <p className="text-xs text-[#DC2626] mt-2">Cuota mensual: ${cobroMensual.toLocaleString('es-AR')}</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white shadow-lg shadow-blue-500/20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <UserCheck className="h-8 w-8 mb-3 text-blue-200" />
          <p className="text-sm text-blue-200 font-medium">Jugadores Activos</p>
          <p className="text-4xl font-extrabold mt-1">{jugadores.count || 0}</p>
          <p className="text-xs text-blue-300 mt-2">Categoría Cadete</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white shadow-lg shadow-amber-500/20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <AlertCircle className="h-8 w-8 mb-3 text-amber-200" />
          <p className="text-sm text-amber-200 font-medium">Cuotas Pendientes</p>
          <p className="text-4xl font-extrabold mt-1">{cuotasPendientes.length}</p>
          <p className="text-xs text-amber-300 mt-2">${(cuotasPendientes.length * 75000).toLocaleString('es-AR')} a cobrar</p>
        </div>

        <div className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-lg ${balance >= 0 ? 'bg-gradient-to-br from-violet-600 to-purple-700 shadow-violet-500/20' : 'bg-gradient-to-br from-red-600 to-red-700 shadow-red-500/20'}`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <TrendingUp className="h-8 w-8 mb-3 text-white/60" />
          <p className="text-sm text-white/80 font-medium">Balance Total</p>
          <p className="text-4xl font-extrabold mt-1">${balance.toLocaleString('es-AR')}</p>
          <p className="text-xs text-white/60 mt-2">Ingresos + Cuotas - Egresos</p>
        </div>
      </div>

      {/* Second Row Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Ingresos Totales</p>
                <p className="text-2xl font-bold text-[#DC2626] mt-1">${(totalIngresos + totalExtra).toLocaleString('es-AR')}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-[#DC2626]/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-[#DC2626]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Egresos Totales</p>
                <p className="text-2xl font-bold text-red-400 mt-1">${totalEgresos.toLocaleString('es-AR')}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Cuotas al Día</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">{cuotasPagadas.length}/{cuotas.data?.length || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity & Reservas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Próximas Reservas */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="border-b border-gray-800">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-[#DC2626]" />
              Próximas Reservas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {reservas.data && reservas.data.length > 0 ? (
              <div className="divide-y divide-gray-800">
                {reservas.data.map((r: any) => (
                  <div key={r.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-white">{r.canchas?.nombre || 'Cancha'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{r.fecha} • {r.hora_inicio} - {r.hora_fin}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${r.estado === 'confirmada' ? 'bg-[#DC2626]/10 text-[#DC2626]' : 'bg-gray-500/10 text-gray-400'}`}>
                      {r.estado}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-8 text-center text-gray-500 text-sm">Sin reservas próximas</div>
            )}
          </CardContent>
        </Card>

        {/* Últimas Notificaciones */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="border-b border-gray-800">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              Últimas Notificaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {notifs.data && notifs.data.length > 0 ? (
              <div className="divide-y divide-gray-800">
                {notifs.data.map((n: any) => (
                  <div key={n.id} className="px-6 py-4 hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{n.titulo}</p>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{n.mensaje}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${n.tipo === 'urgente' ? 'bg-red-500/10 text-red-400' : n.tipo === 'pago' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>
                        {n.tipo}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-8 text-center text-gray-500 text-sm">Sin notificaciones</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
