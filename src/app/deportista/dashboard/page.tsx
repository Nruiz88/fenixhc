'use client';
import { useState, useEffect } from 'react';
import { udb } from '@/lib/userQuery';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Image, Calendar, Bell, User, Zap } from 'lucide-react';
import Link from 'next/link';

export default function DeportistaDashboard() {
  const [perfil, setPerfil] = useState<any>(null);
  const [stats, setStats] = useState({ msgs: 0, fotos: 0, reservas: 0, notifs: 0 });

  useEffect(() => {
    udb.select('perfiles', '*', undefined, { single: true }).then(({ data }) => setPerfil(data));
    Promise.all([
      udb.select('mensajes_chat', 'id'),
      udb.select('fotos_galeria', 'id'),
      udb.select('reservas', 'id'),
      udb.select('notificaciones', 'id'),
    ]).then(([m, f, r, n]) => {
      setStats({
        msgs: m.data?.length || 0,
        fotos: f.data?.length || 0,
        reservas: r.data?.length || 0,
        notifs: (n.data || []).filter((x: any) => x.destinatario_rol === 'deportista' || x.destinatario_rol === 'todos').length,
      });
    });
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Hola, {perfil?.nombre || '...'}</h1>
        <p className="text-gray-400 mt-1">Bienvenido a tu panel</p>
      </div>

      {/* Profile Card */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl shrink-0">{perfil?.nombre?.[0]}{perfil?.apellido?.[0]}</div>
            <div>
              <h2 className="text-xl font-bold text-white">{perfil?.nombre} {perfil?.apellido}</h2>
              <p className="text-sm text-gray-400 mt-0.5">DNI: {perfil?.dni} • {perfil?.correo}</p>
              <p className="text-xs text-gray-500 mt-1">{perfil?.telefono || ''} {perfil?.direccion ? '• ' + perfil.direccion : ''}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Chat', value: stats.msgs, icon: MessageSquare, color: 'from-blue-500 to-indigo-600', href: '/deportista/chat' },
          { label: 'Fotos', value: stats.fotos, icon: Image, color: 'from-violet-500 to-purple-600', href: '/deportista/galeria' },
          { label: 'Reservas', value: stats.reservas, icon: Calendar, color: 'from-[#DC2626] to-[#7F1D1D]', href: '/deportista/reservas' },
          { label: 'Notificaciones', value: stats.notifs, icon: Bell, color: 'from-amber-500 to-orange-600', href: '/deportista/notificaciones' },
        ].map((s) => (
          <Link key={s.href} href={s.href}>
            <div className={`rounded-2xl bg-gradient-to-br ${s.color} p-5 text-white shadow-lg cursor-pointer hover:scale-[1.02] transition-transform`}>
              <s.icon className="h-6 w-6 mb-2 text-white/60" />
              <p className="text-sm text-white/80">{s.label}</p>
              <p className="text-3xl font-extrabold mt-1">{s.value}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/deportista/chat">
          <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors cursor-pointer group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform"><MessageSquare className="h-6 w-6 text-blue-400" /></div>
              <div>
                <h3 className="font-semibold text-white">Chat del Club</h3>
                <p className="text-sm text-gray-400">Charlá con tus compañeros</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/deportista/galeria">
          <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors cursor-pointer group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover:scale-110 transition-transform"><Image className="h-6 w-6 text-violet-400" /></div>
              <div>
                <h3 className="font-semibold text-white">Galería</h3>
                <p className="text-sm text-gray-400">Subí fotos y videos</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
