'use client';
import { useState, useEffect } from 'react';
import { getCurrentUser, logout } from '@/lib/auth-client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Menu, LogOut, LayoutDashboard, Users, UserCheck, FileText, Link2, DollarSign, PieChart, Bell, Calendar, Home, ChevronRight, Settings, Megaphone, ImageIcon, Clock, Star } from 'lucide-react';
import { tieneModulo, ROL_LABEL, type Modulo, type Rol } from '@/lib/roles';

// Cada item declara su modulo para poder filtrar segun el cargo:
// un tesorero no ve "Usuarios", un vocal no ve "Finanzas".
const NAV_ITEMS: { label: string; href: string; icon: any; modulo: Modulo }[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard, modulo: 'dashboard' },
  { label: 'Usuarios', href: '/admin/usuarios', icon: Users, modulo: 'usuarios' },
  { label: 'Partidos', href: '/admin/partidos', icon: Calendar, modulo: 'partidos' },
  { label: 'Benefactores', href: '/admin/socios', icon: Users, modulo: 'socios' },
  { label: 'Jugadores', href: '/admin/jugadores', icon: UserCheck, modulo: 'jugadores' },
  { label: 'Legajos', href: '/admin/legajos', icon: FileText, modulo: 'legajos' },
  { label: 'Familias', href: '/admin/links-familia', icon: Link2, modulo: 'familias' },
  { label: 'Pagos', href: '/admin/pagos', icon: DollarSign, modulo: 'pagos' },
  { label: 'Finanzas', href: '/admin/finanzas', icon: PieChart, modulo: 'finanzas' },
  { label: 'Reservas', href: '/admin/reservas', icon: Calendar, modulo: 'reservas' },
  { label: 'Notificaciones', href: '/admin/notificaciones', icon: Bell, modulo: 'notificaciones' },
  { label: 'Horarios', href: '/admin/horarios', icon: Clock, modulo: 'horarios' },
  { label: 'Comunicados', href: '/admin/comunicados', icon: Megaphone, modulo: 'comunicados' },
  { label: 'Sponsors', href: '/admin/sponsors', icon: Star, modulo: 'sponsors' },
  { label: 'Reportes', href: '/admin/reportes', icon: FileText, modulo: 'reportes' },
  { label: 'Configuración', href: '/admin/configuracion', icon: Settings, modulo: 'configuracion' },
];

function Sidebar({ currentPath, onLogout, rol }: { currentPath: string; onLogout: () => void; rol?: Rol }) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-5 border-b border-gray-800 shrink-0">
        <Link href="/admin/dashboard" className="flex items-center gap-3">
          <img src="/logo.png" alt="Fenix" className="h-9 w-9 object-contain shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-white text-lg leading-tight">FENIX</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider truncate">Panel de la Directiva</p>
          </div>
        </Link>
      </div>
      {/* min-h-0 es necesario: en una columna flex, un hijo con flex-1 +
          overflow-y-auto sin min-h-0 no se constrain y la barra crece mas alla
          del viewport en vez de scrollear. */}
      <nav className="flex-1 min-h-0 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.filter((item) => !rol || tieneModulo(rol, item.modulo)).map((item) => {
          const isActive = currentPath === item.href || currentPath.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive ? 'bg-[#DC2626] text-white shadow-lg shadow-[#DC2626]/20' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}>
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
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

  useEffect(() => {
    (async () => {
      const current = await getCurrentUser();
      if (!current) { router.push('/login'); return; }
      setUser(current);
    })();
  }, []);

  const handleLogout = async () => { await logout(); router.push('/login'); };
  const breadcrumbs = pathname.split('/').filter(Boolean).map((s, i, arr) => ({
    label: s.charAt(0).toUpperCase() + s.slice(1),
    href: '/' + arr.slice(0, i + 1).join('/'),
    isLast: i === arr.length - 1,
  }));

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <aside className="hidden lg:flex w-64 bg-gray-900 border-r border-gray-800 flex-col shrink-0 min-h-0">
        <Sidebar currentPath={pathname} onLogout={handleLogout} rol={user?.rol} />
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger>
                <Button variant="ghost" size="icon" className="lg:hidden text-gray-400 hover:text-white"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-gray-900 border-gray-800">
                <Sidebar currentPath={pathname} onLogout={handleLogout} rol={user?.rol} />
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
                  <p className="text-xs text-gray-500">{ROL_LABEL[user.rol as Rol] ?? user.rol}</p>
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
        {/* min-w-0 + overflow-x-hidden: sin esto, una tabla ancha estira el
            contenedor y empuja la pagina completa (incluido el header). */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
