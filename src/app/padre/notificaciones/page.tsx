'use client';
import { useState, useEffect } from 'react';
import { udb } from '@/lib/userQuery';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, AlertTriangle, Zap, Info } from 'lucide-react';

export default function PadreNotificaciones() {
  const [notifs, setNotifs] = useState<any[]>([]);
  useEffect(() => {
    udb.select('notificaciones', '*').then(({ data }) => {
      setNotifs((data || []).filter((n: any) => n.destinatario_rol === 'padre' || n.destinatario_rol === 'todos'));
    });
  }, []);
  const tipoIcons: Record<string, any> = { urgente: AlertTriangle, pago: Zap, deportivo: Info, general: Bell };
  const tipoColors: Record<string, string> = { urgente: 'bg-red-500/10 text-red-400', pago: 'bg-amber-500/10 text-amber-400', deportivo: 'bg-blue-500/10 text-blue-400', general: 'bg-gray-500/10 text-gray-400' };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Notificaciones</h1><p className="text-gray-400 text-sm mt-1">Avisos importantes para vos</p></div>
      {notifs.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800"><CardContent className="py-16 text-center"><Bell className="h-12 w-12 text-gray-700 mx-auto mb-3" /><p className="text-gray-500">No hay notificaciones</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {notifs.map((n) => {
            const Icon = tipoIcons[n.tipo] || Bell;
            return (
              <Card key={n.id} className="bg-gray-900 border-gray-800">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tipoColors[n.tipo] || tipoColors.general}`}><Icon className="h-5 w-5" /></div>
                    <div className="flex-1">
                      <p className="font-medium text-white">{n.titulo}</p>
                      <p className="text-sm text-gray-400 mt-1">{n.mensaje}</p>
                      <p className="text-[10px] text-gray-600 mt-2">{new Date(n.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
