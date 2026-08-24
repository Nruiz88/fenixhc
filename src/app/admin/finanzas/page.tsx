'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/adminQuery';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MESES } from '@/lib/constants';
import { TrendingUp, TrendingDown, DollarSign, Plus } from 'lucide-react';

export default function AdminFinanzas() {
  const [finanzas, setFinanzas] = useState<any[]>([]);
  const [cuotas, setCuotas] = useState<any[]>([]);
  const [form, setForm] = useState({ tipo: 'ingreso', concepto: '', monto: '', categoria: '' });
  const [filterAnio, setFilterAnio] = useState(String(new Date().getFullYear()));
  useEffect(() => { load(); }, []);
  async function load() {
    const { data: f } = await db.select('finanzas', '*', undefined, { order: { column: 'fecha', ascending: false } });
    setFinanzas(f || []);
    const { data: c } = await db.select('cuotas');
    setCuotas(c || []);
  }
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.concepto || !form.monto) return;
    await db.insert('finanzas', { tipo: form.tipo, concepto: form.concepto, monto: Number(form.monto), categoria: form.categoria || null });
    toast.success('Agregado correctamente');
    setForm({ tipo: 'ingreso', concepto: '', monto: '', categoria: '' });
    load();
  };

  const mesFinanzas = finanzas.filter(f => new Date(f.fecha).getFullYear() === Number(filterAnio));
  const mesCuotas = cuotas.filter(c => c.anio === Number(filterAnio) && c.estado === 'pagada');
  const balance = MESES.map((mes, i) => {
    const m = i + 1;
    const ing = mesCuotas.filter((c: any) => c.mes === m).reduce((s: number, c: any) => s + Number(c.monto), 0) + mesFinanzas.filter((f: any) => f.tipo === 'ingreso' && new Date(f.fecha).getMonth() === i).reduce((s: number, f: any) => s + Number(f.monto), 0);
    const egr = mesFinanzas.filter((f: any) => f.tipo === 'egreso' && new Date(f.fecha).getMonth() === i).reduce((s: number, f: any) => s + Number(f.monto), 0);
    return { mes, mesNum: m, ing, egr, total: ing - egr };
  });
  const totalIng = balance.reduce((s, b) => s + b.ing, 0);
  const totalEgr = balance.reduce((s, b) => s + b.egr, 0);
  const maxVal = Math.max(...balance.map(b => Math.max(b.ing, b.egr)), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Finanzas</h1>
        <p className="text-gray-400 text-sm mt-1">Control de ingresos y egresos del club</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-400">Ingresos {filterAnio}</p><p className="text-2xl font-bold text-[#DC2626] mt-1">${totalIng.toLocaleString('es-AR')}</p></div>
              <div className="h-11 w-11 rounded-xl bg-[#DC2626]/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-[#DC2626]" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-400">Egresos {filterAnio}</p><p className="text-2xl font-bold text-red-400 mt-1">${totalEgr.toLocaleString('es-AR')}</p></div>
              <div className="h-11 w-11 rounded-xl bg-red-500/10 flex items-center justify-center"><TrendingDown className="h-5 w-5 text-red-400" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-400">Balance</p><p className={`text-2xl font-bold mt-1 ${totalIng - totalEgr >= 0 ? 'text-[#DC2626]' : 'text-red-400'}`}>${(totalIng - totalEgr).toLocaleString('es-AR')}</p></div>
              <div className="h-11 w-11 rounded-xl bg-violet-500/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-violet-400" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="border-b border-gray-800 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-base">Balance Mensual {filterAnio}</CardTitle>
            <Select value={filterAnio} onValueChange={(v) => v && setFilterAnio(v)}>
              <SelectTrigger className="w-28 bg-gray-800 border-gray-700 text-white"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem><SelectItem value="2027">2027</SelectItem></SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-3">
            {balance.map((b) => (
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
                <div className="w-20 text-right">
                  <span className={`text-sm font-medium ${b.total >= 0 ? 'text-[#DC2626]' : 'text-red-400'}`}>
                    {b.total >= 0 ? '+' : ''}{b.total.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-800">
            <div className="flex items-center gap-2 text-xs text-gray-400"><div className="w-3 h-3 rounded-full bg-emerald-500" />Ingresos</div>
            <div className="flex items-center gap-2 text-xs text-gray-400"><div className="w-3 h-3 rounded-full bg-red-500" />Egresos</div>
          </div>
        </CardContent>
      </Card>

      {/* Add Form */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="border-b border-gray-800 pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-[#DC2626]" />
            Agregar Movimiento
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2"><Label className="text-gray-400 text-sm">Tipo</Label><Select value={form.tipo} onValueChange={(v) => v && setForm({ ...form, tipo: v })}><SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ingreso">📈 Ingreso</SelectItem><SelectItem value="egreso">📉 Egreso</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label className="text-gray-400 text-sm">Concepto</Label><Input value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })} placeholder="Ej: Donación..." className="bg-gray-800 border-gray-700 text-white" required /></div>
            <div className="space-y-2"><Label className="text-gray-400 text-sm">Monto ($)</Label><Input type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} placeholder="0" className="bg-gray-800 border-gray-700 text-white" required /></div>
            <div className="space-y-2"><Label className="text-gray-400 text-sm">Categoría</Label><Input value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} placeholder="Opcional" className="bg-gray-800 border-gray-700 text-white" /></div>
            <Button type="submit" className="self-end bg-[#DC2626] hover:bg-[#B91C1C]"><Plus className="h-4 w-4 mr-1" />Agregar</Button>
          </form>
        </CardContent>
      </Card>

      {/* Recent Movements */}
      {finanzas.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="border-b border-gray-800 pb-3">
            <CardTitle className="text-white text-base">Últimos Movimientos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-800">
              {finanzas.slice(0, 10).map((f) => (
                <div key={f.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${f.tipo === 'ingreso' ? 'bg-[#DC2626]/10' : 'bg-red-500/10'}`}>
                      {f.tipo === 'ingreso' ? <TrendingUp className="h-4 w-4 text-[#DC2626]" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{f.concepto}</p>
                      <p className="text-xs text-gray-500">{new Date(f.fecha).toLocaleDateString('es-AR')}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${f.tipo === 'ingreso' ? 'text-[#DC2626]' : 'text-red-400'}`}>
                    {f.tipo === 'ingreso' ? '+' : '-'}${Number(f.monto).toLocaleString('es-AR')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
