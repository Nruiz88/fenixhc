'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/adminQuery';
import { toast } from 'sonner';
import { fechaHora } from '@/lib/format';
import { ROL_LABEL, type Rol } from '@/lib/roles';
import { PageHeader, Panel, EmptyState, StatusPill, Hint } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Bell, AlertTriangle, Info, Zap, Trophy } from 'lucide-react';

const TIPOS = [
  { value: 'general', label: 'General', ayuda: 'Aviso común para todos.' },
  { value: 'pago', label: 'Pago', ayuda: 'Recordatorio de cuotas.' },
  { value: 'deportivo', label: 'Deportivo', ayuda: 'Entrenamientos, partidos, citaciones.' },
  { value: 'urgente', label: 'Urgente', usa: true, ayuda: 'Solo para lo que no puede esperar.' },
] as const;

const TONO: Record<string, { tone: 'danger' | 'warn' | 'info' | 'neutral'; icon: any }> = {
  urgente: { tone: 'danger', icon: AlertTriangle },
  pago: { tone: 'warn', icon: Zap },
  deportivo: { tone: 'info', icon: Trophy },
  general: { tone: 'neutral', icon: Info },
};

const FORM_VACIO = { titulo: '', mensaje: '', tipo: 'general', destinatario_rol: 'todos' };

export default function AdminNotificaciones() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState({ ...FORM_VACIO });

  async function cargar() {
    setCargando(true);
    const { data } = await db.select<any>('notificaciones', '*', undefined, {
      order: { column: 'created_at', ascending: false },
      limit: 30,
    });
    setNotifs(data ?? []);
    setCargando(false);
  }

  useEffect(() => { cargar(); }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim() || !form.mensaje.trim()) {
      toast.error('Completá el título y el mensaje');
      return;
    }

    setEnviando(true);
    const { error } = await db.insert('notificaciones', {
      titulo: form.titulo.trim(),
      mensaje: form.mensaje.trim(),
      tipo: form.tipo,
      destinatario_rol: form.destinatario_rol,
    });
    setEnviando(false);

    if (error) { toast.error(error); return; }

    toast.success('Notificación publicada');
    setForm({ ...FORM_VACIO });
    await cargar();
  }

  const tipoElegido = TIPOS.find((t) => t.value === form.tipo);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificaciones"
        description="Avisos que aparecen en el portal de las personas destinatarias."
      />

      <Hint>
        Las notificaciones se muestran dentro del sistema, en la campana de cada
        portal. No se envían por email. Para avisos por correo usá la página de
        Comunicados.
      </Hint>

      {/* Formulario */}
      <Panel
        title="Publicar una notificación"
        description={tipoElegido?.ayuda}
      >
        <form onSubmit={enviar} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm({ ...form, tipo: t.value })}
                  className={
                    form.tipo === t.value
                      ? 'rounded-lg border border-brand bg-brand/10 px-3 py-1.5 text-sm font-medium text-brand transition-colors'
                      : 'rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-main'
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ej: Cuotas de octubre"
                maxLength={255}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="destinatario">Quién la recibe</Label>
              <Select
                value={form.destinatario_rol}
                onValueChange={(v) => v && setForm({ ...form, destinatario_rol: v })}
              >
                <SelectTrigger id="destinatario"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los socios</SelectItem>
                  {(['socio_benefactor', 'socio_cadete'] as Rol[]).map((r) => (
                    <SelectItem key={r} value={r}>{ROL_LABEL[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mensaje">Mensaje *</Label>
            <Textarea
              id="mensaje"
              value={form.mensaje}
              onChange={(e) => setForm({ ...form, mensaje: e.target.value })}
              placeholder="Escribí el aviso completo. Los socios lo leen tal cual, sin formato."
              rows={5}
              required
            />
          </div>

          <Button type="submit" disabled={enviando} variant={form.tipo === 'urgente' ? 'destructive' : 'default'}>
            <Send className="h-4 w-4" />
            {enviando ? 'Publicando…' : 'Publicar notificación'}
          </Button>
        </form>
      </Panel>

      {/* Historial */}
      <Panel title="Notificaciones publicadas" description={`${notifs.length} recientes`} bodyClassName="p-0">
        {cargando ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : notifs.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-6 w-6" />}
            title="Todavía no publicaste ninguna"
            description="Usá el formulario de arriba para mandar el primer aviso a los socios."
          />
        ) : (
          <ul className="divide-y divide-line">
            {notifs.map((x) => {
              const tono = TONO[x.tipo] ?? TONO.general;
              const Icono = tono.icon;
              return (
                <li key={x.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={
                        tono.tone === 'danger' ? 'grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-danger/10 text-danger'
                        : tono.tone === 'warn' ? 'grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-warn/10 text-warn'
                        : tono.tone === 'info' ? 'grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-info/10 text-info'
                        : 'grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-muted'
                      }
                    >
                      <Icono className="h-4 w-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-main">{x.titulo}</p>
                        <StatusPill tone={tono.tone}>{x.tipo}</StatusPill>
                      </div>
                      {/* break-words: los avisos suelen incluir correos y
                          links sin espacios, y reventaban la columna. */}
                      <p className="mt-0.5 break-words text-xs leading-relaxed text-muted">{x.mensaje}</p>
                      <p className="mt-1 text-[11px] text-dim">
                        {fechaHora(x.created_at)} · para{' '}
                        {x.destinatario_rol === 'todos' ? 'todos' : ROL_LABEL[x.destinatario_rol as Rol] ?? x.destinatario_rol}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
