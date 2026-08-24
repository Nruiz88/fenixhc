'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/adminQuery';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Send, Bell, AlertTriangle, Info, Zap } from 'lucide-react';

export default function AdminNotificaciones() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [form, setForm] = useState({ titulo: '', mensaje: '', tipo: 'general', destinatario_rol: 'todos' });
  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await db.select('notificaciones', '*', undefined, { order: { column: 'created_at', ascending: false }, limit: 20 });
    setNotifs(data || []);
  }
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo || !form.mensaje) return;
    await db.insert('notificaciones', { titulo: form.titulo, mensaje: form.mensaje, tipo: form.tipo, destinatario_rol: form.destinatario_rol });
    toast.success('Notificación enviada');
    setForm({ titulo: '', mensaje: '', tipo: 'general', destinatario_rol: 'todos' });
    load();
  };

  const tipoColors: Record<string, string> = { urgente: 'bg-red-500/10 text-red-400 border-red-500/20', pago: 'bg-amber-500/10 text-amber-400 border-amber-500/20', deportivo: 'bg-blue-500/10 text-blue-400 border-blue-500/20', general: 'bg-gray-500/10 text-gray-400 border-gray-500/20' };
  const tipoIcons: Record<string, any> = { urgente: AlertTriangle, pago: Zap, deportivo: Info, general: Bell };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Notificaciones</h1><p className="text-gray-400 text-sm mt-1">Enviar avisos a socios y deportistas</p></div>

      {/* Send Form */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="border-b border-gray-800 pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2"><Send className="h-4 w-4 text-[#DC2626]" /> Nueva Notificación</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSend} className="space-y-4">
            <div className="space-y-2"><Label className="text-gray-400 text-sm">Título</Label><Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ej: Próximo partido..." className="bg-gray-800 border-gray-700 text-white" required /></div>
            <div className="space-y-2"><Label className="text-gray-400 text-sm">Mensaje</Label><Textarea value={form.mensaje} onChange={e => setForm({ ...form, mensaje: e.target.value })} rows={3} placeholder="Descripción del aviso..." className="bg-gray-800 border-gray-700 text-white resize-none" required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-gray-400 text-sm">Tipo</Label><Select value={form.tipo} onValueChange={(v) => v && setForm({ ...form, tipo: v })}><SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pago">💰 Pago</SelectItem><SelectItem value="deportivo">🏑 Deportivo</SelectItem><SelectItem value="general">📢 General</SelectItem><SelectItem value="urgente">🚨 Urgente</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label className="text-gray-400 text-sm">Para</Label><Select value={form.destinatario_rol} onValueChange={(v) => v && setForm({ ...form, destinatario_rol: v })}><SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">👥 Todos</SelectItem><SelectItem value="padre">👨‍👦 Padres</SelectItem><SelectItem value="deportista">🏃 Deportistas</SelectItem></SelectContent></Select></div>
            </div>
            <Button type="submit" className="bg-[#DC2626] hover:bg-[#B91C1C]"><Send className="h-4 w-4 mr-1" />Enviar Notificación</Button>
          </form>
        </CardContent>
      </Card>

      {/* History */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="border-b border-gray-800 pb-3">
          <CardTitle className="text-white text-base">Historial ({notifs.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {notifs.length > 0 ? (
            <div className="divide-y divide-gray-800">
              {notifs.map((n) => {
                const Icon = tipoIcons[n.tipo] || Bell;
                return (
                  <div key={n.id} className="px-6 py-4 hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${tipoColors[n.tipo] || tipoColors.general}`}><Icon className="h-4 w-4" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2"><p className="text-sm font-medium text-white">{n.titulo}</p><span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${tipoColors[n.tipo] || tipoColors.general}`}>{n.tipo}</span><span className="text-[10px] text-gray-600">→ {n.destinatario_rol}</span></div>
                        <p className="text-xs text-gray-400 mt-1">{n.mensaje}</p>
                        <p className="text-[10px] text-gray-600 mt-1">{new Date(n.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-12 text-center"><Bell className="h-10 w-10 text-gray-700 mx-auto mb-3" /><p className="text-gray-500 text-sm">No hay notificaciones enviadas</p></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
