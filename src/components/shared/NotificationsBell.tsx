'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Bell, Check, AlertTriangle, DollarSign, Megaphone, Info } from 'lucide-react';

const TIPO_ICONS: Record<string, typeof Bell> = {
  pago: DollarSign,
  deportivo: AlertTriangle,
  general: Info,
  urgente: AlertTriangle,
};

const TIPO_COLORS: Record<string, string> = {
  pago: 'text-[#DC2626]',
  deportivo: 'text-blue-400',
  general: 'text-gray-400',
  urgente: 'text-amber-400',
};

interface NotificationsBellProps {
  userId: string;
}

export function NotificationsBell({ userId }: NotificationsBellProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, [userId]);

  async function loadNotifications() {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) return;

      const supabase = createClient(url, key);
      const { data } = await supabase
        .from('notificaciones')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) setNotifications(data);
    } catch {}
    setLoading(false);
  }

  const unread = notifications.length;
  const now = new Date();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-[#DC2626] text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="p-3 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Notificaciones</h3>
              {unread > 0 && (
                <span className="text-xs text-[#DC2626]">{unread} nuevas</span>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center">
                  <div className="h-5 w-5 border-2 border-[#DC2626]/30 border-t-[#DC2626] rounded-full animate-spin mx-auto" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin notificaciones</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const Icon = TIPO_ICONS[n.tipo] || Info;
                  const color = TIPO_COLORS[n.tipo] || 'text-gray-400';
                  const created = new Date(n.created_at);
                  const diffHours = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
                  const timeStr = diffHours < 1 ? 'Ahora' : diffHours < 24 ? `Hace ${diffHours}h` : `Hace ${Math.floor(diffHours / 24)}d`;

                  return (
                    <div key={n.id} className="px-4 py-3 hover:bg-white/5 transition-colors border-b border-gray-800/50 last:border-0">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 ${color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{n.titulo}</p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{n.mensaje}</p>
                          <p className="text-[10px] text-gray-600 mt-1">{timeStr}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
