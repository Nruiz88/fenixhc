'use client';
import { db } from '@/lib/adminQuery';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, Users, DollarSign, Calendar } from 'lucide-react';

export default function AdminReportes() {
  function downloadCSV(rows: any[], name: string) {
    if (!rows.length) { toast.error('Sin datos para exportar'); return; }
    const h = Object.keys(rows[0]);
    const csv = [h.join(','), ...rows.map(r => h.map(k => '"' + String(r[k] ?? '') + '"').join(','))].join('\n');
    const b = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b);
    a.download = name + '_' + new Date().toISOString().split('T')[0] + '.csv'; a.click();
    toast.success(`${name} exportado correctamente`);
  }
  async function exportPagos() { const { data } = await db.select('cuotas', 'mes, anio, monto, estado'); downloadCSV((data || []).map((c: any) => ({ Mes: c.mes, Anio: c.anio, Monto: c.monto, Estado: c.estado })), 'pagos'); }
  async function exportFinanzas() { const { data } = await db.select('finanzas', 'tipo, concepto, monto, fecha'); downloadCSV((data || []).map((f: any) => ({ Tipo: f.tipo, Concepto: f.concepto, Monto: f.monto, Fecha: f.fecha })), 'finanzas'); }
  async function exportSocios() { const { data } = await db.select('perfiles', '*', { rol: 'padre' }); downloadCSV((data || []).map((s: any) => ({ Nombre: s.nombre, Apellido: s.apellido, DNI: s.dni, Correo: s.correo, Telefono: s.telefono })), 'socios'); }
  async function exportJugadores() { const { data } = await db.select('deportistas', '*, perfiles(nombre, apellido, dni, correo)'); downloadCSV((data || []).map((j: any) => ({ Nombre: j.perfiles?.nombre, Apellido: j.perfiles?.apellido, DNI: j.perfiles?.dni, Activo: j.club_activo, Inscripcion: j.fecha_inscripcion })), 'jugadores'); }

  const reports = [
    { title: 'Pagos de Cuotas', desc: 'Historial de cuotas pagadas y pendientes', icon: DollarSign, color: 'from-[#DC2626] to-[#7F1D1D]', export: exportPagos },
    { title: 'Finanzas', desc: 'Ingresos y egresos del club', icon: FileSpreadsheet, color: 'from-violet-500 to-purple-600', export: exportFinanzas },
    { title: 'Socios', desc: 'Lista completa de padres', icon: Users, color: 'from-blue-500 to-indigo-600', export: exportSocios },
    { title: 'Jugadores', desc: 'Listado de deportistas activos', icon: Calendar, color: 'from-amber-500 to-orange-600', export: exportJugadores },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Reportes</h1><p className="text-gray-400 text-sm mt-1">Exportar datos del club a CSV</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {reports.map((r) => (
          <Card key={r.title} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors group">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${r.color} flex items-center justify-center text-white shadow-lg`}><r.icon className="h-5 w-5" /></div>
                  <div><h3 className="font-semibold text-white">{r.title}</h3><p className="text-sm text-gray-400 mt-0.5">{r.desc}</p></div>
                </div>
                <Button onClick={r.export} variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 group-hover:border-[#DC2626]/30 group-hover:text-[#DC2626] transition-all">
                  <Download className="h-4 w-4 mr-1" />CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
