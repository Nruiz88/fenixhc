'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/adminQuery';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ExternalLink, CheckCircle, Clock, DollarSign, XCircle,
  Eye, Search, Filter, UserCheck, AlertTriangle, FileText
} from 'lucide-react';
import { MESES } from '@/lib/constants';

export default function AdminPagos() {
  const [cuotas, setCuotas] = useState<any[]>([]);
  const [familias, setFamilias] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'pagada' | 'pendiente' | 'rechazada'>('all');
  const [search, setSearch] = useState('');
  const [selectedCuota, setSelectedCuota] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);

  // Form para asignar pago manual
  const [showAssign, setShowAssign] = useState(false);
  const [assignForm, setAssignForm] = useState({
    familia_id: '',
    mes: '',
    anio: String(new Date().getFullYear()),
    monto: '',
    metodo: 'transferencia',
  });

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await db.select('cuotas', `*, familias!inner(id, perfiles!padre_perfil_id(id, nombre, apellido, email), perfiles!deportista_perfil_id(id, nombre, apellido))`);
    setCuotas(data || []);
    const { data: f } = await db.select('familias', 'id, perfiles!padre_perfil_id(nombre, apellido, email), perfiles!deportista_perfil_id(nombre, apellido)');
    setFamilias(f || []);
  }

  const handleApprove = async (id: string) => {
    setApproving(id);
    await db.update('cuotas', {
      estado: 'pagada',
      fecha_pago: new Date().toISOString(),
    }, { id });
    toast.success('✅ Cuota aprobada y registrada');
    setApproving(null);
    setShowModal(false);
    load();
  };

  const handleReject = async (id: string) => {
    if (!confirm('¿Rechazar este comprobante? Se marcará como pendiente.')) return;
    setRejecting(id);
    await db.update('cuotas', {
      estado: 'pendiente',
      comprobante_url: null,
      fecha_pago: null,
    }, { id });
    toast.success('Comprobante rechazado');
    setRejecting(null);
    setShowModal(false);
    load();
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.familia_id || !assignForm.mes || !assignForm.monto) {
      toast.error('Completá todos los campos obligatorios');
      return;
    }
    // Verificar si ya existe cuota para ese mes/año/familia
    const existente = cuotas.find(c =>
      c.familia_id === assignForm.familia_id &&
      c.mes === Number(assignForm.mes) &&
      c.anio === Number(assignForm.anio)
    );
    if (existente) {
      toast.error('Ya existe una cuota para ese mes/año de esta familia');
      return;
    }
    await db.insert('cuotas', {
      familia_id: assignForm.familia_id,
      mes: Number(assignForm.mes),
      anio: Number(assignForm.anio),
      monto: Number(assignForm.monto),
      estado: 'pagada',
      fecha_pago: new Date().toISOString(),
      tipo_socio: 'benefactor',
      comprobante_url: null,
    });
    toast.success('Pago asignado correctamente');
    setAssignForm({ familia_id: '', mes: '', anio: String(new Date().getFullYear()), monto: '', metodo: 'transferencia' });
    setShowAssign(false);
    load();
  };

  // Stats
  const pagadas = cuotas.filter(c => c.estado === 'pagada');
  const pendientes = cuotas.filter(c => c.estado === 'pendiente');
  const totalCobrado = pagadas.reduce((s: number, c: any) => s + Number(c.monto), 0);
  const totalPendiente = pendientes.reduce((s: number, c: any) => s + Number(c.monto), 0);
  const conComprobante = pendientes.filter(c => c.comprobante_url).length;

  // Filter
  const filtered = cuotas
    .filter(c => filter === 'all' || c.estado === filter)
    .filter(c => {
      if (!search) return true;
      const s = search.toLowerCase();
      const padre = c.familias?.perfiles;
      const hijo = c.familias?.perfiles;
      return (
        padre?.nombre?.toLowerCase().includes(s) ||
        padre?.apellido?.toLowerCase().includes(s) ||
        padre?.email?.toLowerCase().includes(s) ||
        `${MESES[c.mes - 1]} ${c.anio}`.toLowerCase().includes(s)
      );
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Control de Pagos</h1>
          <p className="text-gray-400 text-sm mt-1">Validar comprobantes, aprobar pagos y asignar cuotas</p>
        </div>
        <Button onClick={() => setShowAssign(!showAssign)} className="bg-[#DC2626] hover:bg-[#B91C1C] text-white">
          <DollarSign className="h-4 w-4 mr-2" /> Asignar Pago
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 border-emerald-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-emerald-400/80">Pagadas</p>
                <p className="text-lg font-bold text-emerald-400">{pagadas.length}</p>
                <p className="text-[10px] text-gray-500">${totalCobrado.toLocaleString('es-AR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-900/40 to-amber-950/40 border-amber-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-amber-400/80">Pendientes</p>
                <p className="text-lg font-bold text-amber-400">{pendientes.length}</p>
                <p className="text-[10px] text-gray-500">${totalPendiente.toLocaleString('es-AR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-900/40 to-blue-950/40 border-blue-800/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-blue-400/80">Con Comprobante</p>
                <p className="text-lg font-bold text-blue-400">{conComprobante}</p>
                <p className="text-[10px] text-gray-500">Requieren revisión</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#DC2626]/20 to-red-950/40 border-[#DC2626]/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#DC2626]/20 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-[#DC2626]" />
              </div>
              <div>
                <p className="text-xs text-[#DC2626]/80">Total Cuotas</p>
                <p className="text-lg font-bold text-[#DC2626]">{cuotas.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerta: Pagos con comprobante pendiente */}
      {conComprobante > 0 && (
        <Card className="bg-amber-900/20 border-amber-700/30">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-300">
                {conComprobante} pago{conComprobante > 1 ? 's' : ''} con comprobante{conComprobante > 1 ? 's' : ''} esperando revisión
              </p>
              <p className="text-xs text-amber-400/70">Los padres subieron comprobantes que necesitan tu validación</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulario Asignar Pago */}
      {showAssign && (
        <Card className="bg-gray-900 border-[#DC2626]/30">
          <CardHeader className="border-b border-gray-800 pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-[#DC2626]" />
              Asignar Pago Manual
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleAssign} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Familia / Padre *</Label>
                <Select value={assignForm.familia_id || ''} onValueChange={(v) => {
                  if (!v) return;
                  setAssignForm({
                    ...assignForm,
                    familia_id: v,
                    monto: assignForm.monto || '75000',
                  });
                }}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Seleccionar padre..." />
                  </SelectTrigger>
                  <SelectContent>
                    {familias.map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.perfiles?.nombre} {f.perfiles?.apellido} → {f.perfiles?.nombre} {f.perfiles?.apellido}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Mes *</Label>
                <Select value={assignForm.mes || ''} onValueChange={(v) => v && setAssignForm({ ...assignForm, mes: v })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Mes..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Monto ($) *</Label>
                <Input type="number" value={assignForm.monto} onChange={e => setAssignForm({ ...assignForm, monto: e.target.value })} placeholder="75000" className="bg-gray-800 border-gray-700 text-white" required />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Año</Label>
                <Input type="number" value={assignForm.anio} onChange={e => setAssignForm({ ...assignForm, anio: e.target.value })} className="bg-gray-800 border-gray-700 text-white" />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Método</Label>
                <Select value={assignForm.metodo || 'transferencia'} onValueChange={(v) => v && setAssignForm({ ...assignForm, metodo: v })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transferencia">🏦 Transferencia</SelectItem>
                    <SelectItem value="efectivo">💵 Efectivo</SelectItem>
                    <SelectItem value="debito">💳 Débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end gap-2">
                <Button type="submit" className="bg-[#DC2626] hover:bg-[#B91C1C] text-white">
                  <CheckCircle className="h-4 w-4 mr-2" /> Asignar
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAssign(false)} className="border-gray-700 text-gray-400 hover:text-white">
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-1">
          {(['all', 'pendiente', 'pagada'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f ? 'bg-[#DC2626] text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {f === 'all' ? `Todas (${cuotas.length})` : f === 'pagada' ? `Pagadas (${pagadas.length})` : `Pendientes (${pendientes.length})`}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o mes..."
            className="pl-9 bg-gray-800 border-gray-700 text-white w-full sm:w-72"
          />
        </div>
      </div>

      {/* Lista de cuotas */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No se encontraron cuotas</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filtered.map((c) => {
                const padre = c.familias?.perfiles;
                const tieneComprobante = !!c.comprobante_url;
                return (
                  <div key={c.id} className="px-6 py-4 hover:bg-gray-800/30 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                          c.estado === 'pagada' ? 'bg-emerald-500/10' :
                          tieneComprobante ? 'bg-blue-500/10' : 'bg-amber-500/10'
                        }`}>
                          {c.estado === 'pagada' ? <CheckCircle className="h-5 w-5 text-emerald-400" /> :
                           tieneComprobante ? <FileText className="h-5 w-5 text-blue-400" /> :
                           <Clock className="h-5 w-5 text-amber-400" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {MESES[c.mes - 1]} {c.anio}
                          </p>
                          <p className="text-xs text-gray-500">
                            {padre?.nombre} {padre?.apellido} ({padre?.email})
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className={`text-[10px] border-gray-700 ${
                              c.estado === 'pagada' ? 'text-emerald-400' : 'text-amber-400'
                            }`}>
                              {c.estado}
                            </Badge>
                            {tieneComprobante && c.estado === 'pendiente' && (
                              <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400">
                                📎 Comprobante subido
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-15 sm:ml-0">
                        <span className="text-sm font-bold text-white w-28 text-right">
                          ${Number(c.monto).toLocaleString('es-AR')}
                        </span>

                        {/* Ver comprobante */}
                        {tieneComprobante && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedCuota(c); setShowModal(true); }}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                          >
                            <Eye className="h-4 w-4 mr-1" /> Ver
                          </Button>
                        )}

                        {/* Aprobar */}
                        {c.estado === 'pendiente' && (
                          <Button
                            size="sm"
                            onClick={() => handleApprove(c.id)}
                            disabled={approving === c.id}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            {approving === c.id ? '...' : <><CheckCircle className="h-4 w-4 mr-1" /> Aprobar</>}
                          </Button>
                        )}

                        {/* Rechazar */}
                        {c.estado === 'pendiente' && tieneComprobante && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleReject(c.id)}
                            disabled={rejecting === c.id}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Ver Comprobante */}
      {showModal && selectedCuota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Comprobante de Pago</h2>
                <p className="text-sm text-gray-400">{MESES[selectedCuota.mes - 1]} {selectedCuota.anio} — ${Number(selectedCuota.monto).toLocaleString('es-AR')}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-6">
              {selectedCuota.comprobante_url ? (
                <div className="rounded-xl overflow-hidden border border-gray-700 bg-gray-800">
                  {selectedCuota.comprobante_url.endsWith('.pdf') ? (
                    <iframe src={selectedCuota.comprobante_url} className="w-full h-96" title="Comprobante" />
                  ) : (
                    <img src={selectedCuota.comprobante_url} alt="Comprobante" className="w-full object-contain max-h-96" />
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No se adjuntó comprobante</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-800 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                <p>Padre: <span className="text-white">{selectedCuota.familias?.perfiles?.nombre} {selectedCuota.familias?.perfiles?.apellido}</span></p>
              </div>
              <div className="flex gap-2">
                {selectedCuota.estado === 'pendiente' && (
                  <>
                    <Button
                      onClick={() => handleApprove(selectedCuota.id)}
                      disabled={approving === selectedCuota.id}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" /> Aprobar Pago
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleReject(selectedCuota.id)}
                      disabled={rejecting === selectedCuota.id}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <XCircle className="h-4 w-4 mr-2" /> Rechazar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
