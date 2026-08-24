'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Menu, LogOut, LayoutDashboard, Users, UserCheck, FileText, Link2, DollarSign, PieChart, Bell, Calendar, Home, ChevronRight, Settings, Megaphone, ImageIcon, Clock, Star } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Partidos', href: '/admin/partidos', icon: Calendar },
  { label: 'Socios', href: '/admin/socios', icon: Users },
  { label: 'Jugadores', href: '/admin/jugadores', icon: UserCheck },
  { label: 'Legajos', href: '/admin/legajos', icon: FileText },
  { label: 'Familias', href: '/admin/links-familia', icon: Link2 },
  { label: 'Pagos', href: '/admin/pagos', icon: DollarSign },
  { label: 'Finanzas', href: '/admin/finanzas', icon: PieChart },
  { label: 'Reservas', href: '/admin/reservas', icon: Calendar },
  { label: 'Notificaciones', href: '/admin/notificaciones', icon: Bell },
  { label: 'Horarios', href: '/admin/horarios', icon: Clock },
  { label: 'Comunicados', href: '/admin/comunicados', icon: Megaphone },
  { label: 'Sponsors', href: '/admin/sponsors', icon: Star },
  { label: 'Reportes', href: '/admin/reportes', icon: FileText },
  { label: 'Configuración', href: '/admin/configuracion', icon: Settings },
];

function Sidebar({ currentPath, onLogout }: { currentPath: string; onLogout: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-gray-800">
        <Link href="/admin/dashboard" className="flex items-center gap-3">
          <img src="/logo.png" alt="Fenix" className="h-9 w-9 object-contain" />
          <div>
            <p className="font-bold text-white text-lg leading-tight">FENIX</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Admin Panel</p>
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = currentPath === item.href || currentPath.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive ? 'bg-[#DC2626] text-white shadow-lg shadow-[#DC2626]/20' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}>
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-gray-800 space-y-1">
        <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 transition-all">
          <Home className="h-4 w-4" /> Ver Sitio
        </Link>
        <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
          <LogOut className="h-4 w-4" /> Cerrar Sesión
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);

  useEffect(() => {
    const client = createClient();
    setSupabase(client);
    (async () => {
      const { data: { user } } = await client.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: p } = await client.from('perfiles').select('nombre, apellido, rol').eq('id', user.id).single();
      setUser(p);
    })();
  }, []);

  const handleLogout = async () => { await supabase?.auth.signOut(); router.push('/login'); };
  const breadcrumbs = pathname.split('/').filter(Boolean).map((s, i, arr) => ({
    label: s.charAt(0).toUpperCase() + s.slice(1),
    href: '/' + arr.slice(0, i + 1).join('/'),
    isLast: i === arr.length - 1,
  }));

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <aside className="hidden lg:flex w-64 bg-gray-900 border-r border-gray-800 flex-col shrink-0">
        <Sidebar currentPath={pathname} onLogout={handleLogout} />
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger>
                <Button variant="ghost" size="icon" className="lg:hidden text-gray-400 hover:text-white"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-gray-900 border-gray-800">
                <Sidebar currentPath={pathname} onLogout={handleLogout} />
              </SheetContent>
            </Sheet>
            <nav className="flex items-center gap-1 text-sm">
              {breadcrumbs.map((b, i) => (
                <span key={b.href} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-gray-600" />}
                  <span className={b.isLast ? 'text-white font-medium' : 'text-gray-500'}>{b.label}</span>
                </span>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-white">{user.nombre} {user.apellido}</p>
                  <p className="text-xs text-gray-500 capitalize">{user.rol}</p>
                </div>
                <Link href="/admin/configuracion">
                  <Avatar className="h-9 w-9 cursor-pointer hover:ring-2 hover:ring-[#DC2626]/50 transition-all">
                    <AvatarFallback className="bg-[#DC2626] text-white text-sm font-bold">{user.nombre?.[0]}{user.apellido?.[0]}</AvatarFallback>
                  </Avatar>
                </Link>
              </>
            )}
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
