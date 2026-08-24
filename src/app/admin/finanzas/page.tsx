'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/adminQuery';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MESES } from '@/lib/constants';
import {
  TrendingUp, TrendingDown, DollarSign, Plus, Trash2,
  Receipt, Wallet, CreditCard, Building2, Truck, Wrench, Gift
} from 'lucide-react';

const CATEGORIAS_EGRESO = [
  { value: 'alquiler', label: 'Alquiler / Mantenimiento', icon: Building2 },
  { value: 'servicios', label: 'Servicios (luz, gas, agua)', icon: Wrench },
  { value: 'equipamiento', label: 'Equipamiento / Indumentaria', icon: Truck },
  { value: 'viajes', label: 'Viajes / Competencias', icon: Truck },
  { value: 'arbitraje', label: 'Árbitros / Campeonatos', icon: Receipt },
  { value: 'sueldos', label: 'Sueldos / Honorarios', icon: Wallet },
  { value: 'seguros', label: 'Seguros / ART', icon: CreditCard },
  { value: 'otros', label: 'Otros Gastos', icon: Receipt },
];

const CATEGORIAS_INGRESO = [
  { value: 'cuota_social', label: 'Cuota Social' },
  { value: 'cuota_deportiva', label: 'Cuota Deportista' },
  { value: 'cuota_unificada', label: 'Cuota Unificada' },
  { value: 'donacion', label: 'Donación' },
  { value: 'sponsor', label: 'Sponsor' },
  { value: 'evento', label: 'Evento / Torneo' },
  { value: 'mercado_canchas', label: 'Mercado de Canchas' },
  { value: 'otros', label: 'Otros Ingresos' },
];

export default function AdminFinanzas() {
  const [finanzas, setFinanzas] = useState<any[]>([]);
  const [cuotas, setCuotas] = useState<any[]>([]);
  const [filterAnio, setFilterAnio] = useState(String(new Date().getFullYear()));
  const [showForm, setShowForm] = useState<'ingreso' | 'egreso'>('egreso');
  const [form, setForm] = useState({
    tipo: 'egreso',
    concepto: '',
    monto: '',
    categoria: '',
    fecha: new Date().toISOString().split('T')[0],
    descripcion: '',
    metodo_pago: 'efectivo',
  });
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: f } = await db.select('finanzas', '*', undefined, { order: { column: 'fecha', ascending: false } });
    setFinanzas(f || []);
    const { data: c } = await db.select('cuotas');
    setCuotas(c || []);
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.concepto || !form.monto) {
      toast.error('Completá concepto y monto');
      return;
    }
    await db.insert('finanzas', {
      tipo: form.tipo,
      concepto: form.concepto,
      monto: Number(form.monto),
      categoria: form.categoria || null,
      fecha: form.fecha,
      descripcion: form.descripcion || null,
      metodo_pago: form.metodo_pago,
    });
    toast.success(form.tipo === 'egreso' ? 'Gasto registrado' : 'Ingreso registrado');
    setForm({
      tipo: showForm,
      concepto: '',
      monto: '',
      categoria: '',
      fecha: new Date().toISOString().split('T')[0],
      descripcion: '',
      metodo_pago: 'efectivo',
    });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este movimiento?')) return;
    setDeleting(id);
    await db.delete('finanzas', { id });
    toast.success('Movimiento eliminado');
    setDeleting(null);
    load();
  };

  // Stats por año
  const finAnio = finanzas.filter(f => new Date(f.fecha).getFullYear() === Number(filterAnio));
  const cuotAnio = cuotas.filter(c => c.anio === Number(filterAnio) && c.estado === 'pagada');

  const totalCuotas = cuotAnio.reduce((s: number, c: any) => s + Number(c.monto), 0);
  const totalIngresosExtra = finAnio.filter((f: any) => f.tipo === 'ingreso').reduce((s: number, f: any) => s + Number(f.monto), 0);
  const totalIngresos = totalCuotas + totalIngresosExtra;
  const totalEgresos = finAnio.filter((f: any) => f.tipo === 'egreso').reduce((s: number, f: any) => s + Number(f.monto), 0);
  const balance = totalIngresos - totalEgresos;

  // Balance mensual
  const balanceMensual = MESES.map((mes, i) => {
    const m = i + 1;
    const ingCuotas = cuotAnio.filter((c: any) => c.mes === m).reduce((s: number, c: any) => s + Number(c.monto), 0);
    const ingExtra = finAnio.filter((f: any) => f.tipo === 'ingreso' && new Date(f.fecha).getMonth() === i).reduce((s: number, f: any) => s + Number(f.monto), 0);
    const egr = finAnio.filter((f: any) => f.tipo === 'egreso' && new Date(f.fecha).getMonth() === i).reduce((s: number, f: any) => s + Number(f.monto), 0);
    return { mes, mesNum: m, ingCuotas, ingExtra, ing: ingCuotas + ingExtra, egr, total: ingCuotas + ingExtra - egr };
  });

  const maxVal = Math.max(...balanceMensual.map(b => Math.max(b.ing, b.egr)), 1);

  // Egresos por categoría
  const egresosPorCategoria = CATEGORIAS_EGRESO.map(cat => {
    const total = finAnio.filter((f: any) => f.tipo === 'egreso' && f.categoria === cat.value).reduce((s: number, f: any) => s + Number(f.monto), 0);
    return { ...cat, total };
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Finanzas del Club</h1>
          <p className="text-gray-400 text-sm mt-1">Ingresos, egresos y balance anual</p>
        </div>
        <Select value={filterAnio} onValueChange={(v) => v && setFilterAnio(v)}>
          <SelectTrigger className="w-28 bg-gray-800 border-gray-700 text-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="2025">2025</SelectItem>
            <SelectItem value="2026">2026</SelectItem>
            <SelectItem value="2027">2027</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 border-emerald-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-400/80">Ingresos Totales</p>
                <p className="text-lg font-bold text-emerald-400">${totalIngresos.toLocaleString('es-AR')}</p>
                <p className="text-[10px] text-gray-500">Cuotas: ${totalCuotas.toLocaleString('es-AR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-900/40 to-red-950/40 border-red-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-red-400/80">Egresos Totales</p>
                <p className="text-lg font-bold text-red-400">${totalEgresos.toLocaleString('es-AR')}</p>
                <p className="text-[10px] text-gray-500">{finAnio.filter((f: any) => f.tipo === 'egreso').length} movimientos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${balance >= 0 ? 'from-[#DC2626]/20 to-red-950/40 border-[#DC2626]/30' : 'from-gray-900/40 to-gray-950/40 border-gray-800/30'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${balance >= 0 ? 'bg-[#DC2626]/20' : 'bg-gray-700/30'}`}>
                <DollarSign className={`h-5 w-5 ${balance >= 0 ? 'text-[#DC2626]' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="text-xs text-gray-400">Balance {filterAnio}</p>
                <p className={`text-lg font-bold ${balance >= 0 ? 'text-[#DC2626]' : 'text-red-400'}`}>${balance.toLocaleString('es-AR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-900/40 to-blue-950/40 border-blue-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-blue-400/80">Cuotas Cobradas</p>
                <p className="text-lg font-bold text-blue-400">{cuotAnio.length}</p>
                <p className="text-[10px] text-gray-500">de {cuotas.filter(c => c.anio === Number(filterAnio)).length} totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Balance Mensual Chart */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="border-b border-gray-800 pb-3">
          <CardTitle className="text-white text-base">Balance Mensual {filterAnio}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-3">
            {balanceMensual.map((b) => (
              <div key={b.mes} className="flex items-center gap-4">
                <span className="text-sm text-gray-400 w-12 shrink-0">{b.mes.slice(0, 3)}</span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-6 bg-gray-800 rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-500 rounded-l-full transition-all duration-500" style={{ width: `${maxVal > 0 ? (b.ing / maxVal) * 100 : 0}%` }} />
                  </div>
                  <div className="flex-1 h-6 bg-gray-800 rounded-full overflow-hidden flex justify-end">
                    <div className="h-full bg-red-500 rounded-r-full transition-all duration-500" style={{ width: `${maxVal > 0 ? (b.egr / maxVal) * 100 : 0}%` }} />
                  </div>
                </div>
                <div className="w-24 text-right">
                  <span className={`text-sm font-medium ${b.total >= 0 ? 'text-[#DC2626]' : 'text-red-400'}`}>
                    {b.total >= 0 ? '+' : ''}{b.total.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-800">
            <div className="flex items-center gap-2 text-xs text-gray-400"><div className="w-3 h-3 rounded-full bg-emerald-500" />Ingresos (cuotas + extras)</div>
            <div className="flex items-center gap-2 text-xs text-gray-400"><div className="w-3 h-3 rounded-full bg-red-500" />Egresos (gastos del club)</div>
          </div>
        </CardContent>
      </Card>

      {/* Egresos por Categoría */}
      {egresosPorCategoria.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="border-b border-gray-800 pb-3">
            <CardTitle className="text-white text-base">Gastos por Categoría</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {egresosPorCategoria.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div key={cat.value} className="p-3 rounded-xl bg-gray-800/50 border border-gray-700/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4 text-gray-400" />
                      <span className="text-xs text-gray-400">{cat.label}</span>
                    </div>
                    <p className="text-lg font-bold text-white">${cat.total.toLocaleString('es-AR')}</p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${totalEgresos > 0 ? (cat.total / totalEgresos) * 100 : 0}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">{totalEgresos > 0 ? Math.round((cat.total / totalEgresos) * 100) : 0}% del total</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulario de Carga */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="border-b border-gray-800 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Plus className="h-4 w-4 text-[#DC2626]" />
              Registrar Movimiento
            </CardTitle>
            <div className="flex gap-2">
              <button onClick={() => { setShowForm('egreso'); setForm({ ...form, tipo: 'egreso' }); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${showForm === 'egreso' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                📉 Egreso / Gasto
              </button>
              <button onClick={() => { setShowForm('ingreso'); setForm({ ...form, tipo: 'ingreso' }); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${showForm === 'ingreso' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                📈 Ingreso Extra
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Concepto */}
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Concepto *</Label>
                <Input
                  value={form.concepto}
                  onChange={e => setForm({ ...form, concepto: e.target.value })}
                  placeholder={showForm === 'egreso' ? 'Ej: Pago luz salle, Indumentaria nueva...' : 'Ej: Donación empresa XYZ...'}
                  className="bg-gray-800 border-gray-700 text-white"
                  required
                />
              </div>

              {/* Monto */}
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Monto ($) *</Label>
                <Input
                  type="number"
                  value={form.monto}
                  onChange={e => setForm({ ...form, monto: e.target.value })}
                  placeholder="0"
                  className="bg-gray-800 border-gray-700 text-white"
                  required
                  min="0"
                />
              </div>

              {/* Categoría */}
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Categoría</Label>
                <Select value={form.categoria || ''} onValueChange={(v) => v && setForm({ ...form, categoria: v })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {showForm === 'egreso' ? (
                      CATEGORIAS_EGRESO.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))
                    ) : (
                      CATEGORIAS_INGRESO.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Fecha */}
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Fecha</Label>
                <Input
                  type="date"
                  value={form.fecha}
                  onChange={e => setForm({ ...form, fecha: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>

              {/* Método de pago (para egresos) */}
              {showForm === 'egreso' && (
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Método de Pago</Label>
                  <Select value={form.metodo_pago || 'efectivo'} onValueChange={(v) => v && setForm({ ...form, metodo_pago: v })}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">💵 Efectivo</SelectItem>
                      <SelectItem value="transferencia">🏦 Transferencia</SelectItem>
                      <SelectItem value="debito">💳 Débito</SelectItem>
                      <SelectItem value="credito">💳 Crédito</SelectItem>
                      <SelectItem value="cheque">📄 Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Descripción */}
              <div className="space-y-2 md:col-span-2">
                <Label className="text-gray-400 text-sm">Descripción / Detalle</Label>
                <Input
                  value={form.descripcion}
                  onChange={e => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Observaciones adicionales (opcional)"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            <Button type="submit" className={`${showForm === 'egreso' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white`}>
              <Plus className="h-4 w-4 mr-2" />
              {showForm === 'egreso' ? 'Registrar Gasto' : 'Registrar Ingreso'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Historial de Movimientos */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="border-b border-gray-800 pb-3">
          <CardTitle className="text-white text-base">Historial de Movimientos ({finAnio.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {finAnio.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay movimientos registrados en {filterAnio}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {finAnio.map((f) => (
                <div key={f.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${f.tipo === 'ingreso' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                      {f.tipo === 'ingreso' ? <TrendingUp className="h-5 w-5 text-emerald-400" /> : <TrendingDown className="h-5 w-5 text-red-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{f.concepto}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-gray-500">{new Date(f.fecha).toLocaleDateString('es-AR')}</p>
                        {f.categoria && (
                          <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-400">{f.categoria}</Badge>
                        )}
                        {f.metodo_pago && f.metodo_pago !== 'efectivo' && (
                          <Badge variant="outline" className="text-[10px] border-gray-700 text-gray-400 capitalize">{f.metodo_pago}</Badge>
                        )}
                      </div>
                      {f.descripcion && <p className="text-xs text-gray-500 mt-0.5">{f.descripcion}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${f.tipo === 'ingreso' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {f.tipo === 'ingreso' ? '+' : '-'}${Number(f.monto).toLocaleString('es-AR')}
                    </span>
                    <button
                      onClick={() => handleDelete(f.id)}
                      disabled={deleting === f.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
