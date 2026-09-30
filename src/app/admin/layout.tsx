'use client';

import { useState, useEffect } from 'react';
import { getCurrentUser, logout } from '@/lib/auth-client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Menu, LogOut, LayoutDashboard, Users, UserCheck, FileText, Link2,
  DollarSign, PieChart, Bell, Calendar, Home, ChevronRight, Settings,
  Megaphone, Star, Clock, TrendingUp, BarChart3, Shield, ShieldCheck,
} from 'lucide-react';
import { tieneModulo, ROL_LABEL, type Modulo, type Rol } from '@/lib/roles';
import { iniciales } from '@/lib/format';

// Secciones: en vez de 16 items sueltos, agruparlos ayuda a que alguien
// nuevo sepa dónde está sin conocer el sistema.
const SECCIONES: { titulo: string; items: NavItem[] }[] = [
  {
    titulo: 'General',
    items: [
      { label: 'Inicio', href: '/admin/dashboard', icon: LayoutDashboard, modulo: 'dashboard' },
    ],
  },
  {
    titulo: 'Personas',
    items: [
      { label: 'Usuarios', href: '/admin/usuarios', icon: Users, modulo: 'usuarios' },
      { label: 'Socios Benefactores', href: '/admin/socios', icon: Users, modulo: 'socios' },
      { label: 'Jugadores', href: '/admin/jugadores', icon: UserCheck, modulo: 'jugadores' },
      { label: 'Legajos', href: '/admin/legajos', icon: FileText, modulo: 'legajos' },
      { label: 'Vínculos familiares', href: '/admin/links-familia', icon: Link2, modulo: 'familias' },
    ],
  },
  {
    titulo: 'Dinero',
    items: [
      { label: 'Pagos de cuotas', href: '/admin/pagos', icon: DollarSign, modulo: 'pagos' },
      { label: 'Finanzas', href: '/admin/finanzas', icon: PieChart, modulo: 'finanzas' },
      { label: 'Reportes', href: '/admin/reportes', icon: TrendingUp, modulo: 'reportes' },
      { label: 'Contabilidad', href: '/admin/contabilidad', icon: BarChart3, modulo: 'contabilidad' },
    ],
  },
  {
    titulo: 'Actividades',
    items: [
      { label: 'Partidos', href: '/admin/partidos', icon: Calendar, modulo: 'partidos' },
      { label: 'Horarios', href: '/admin/horarios', icon: Clock, modulo: 'horarios' },
      { label: 'Reservas', href: '/admin/reservas', icon: Calendar, modulo: 'reservas' },
    ],
  },
  {
    titulo: 'Comunicación',
    items: [
      { label: 'Comunicados', href: '/admin/comunicados', icon: Megaphone, modulo: 'comunicados' },
      { label: 'Notificaciones', href: '/admin/notificaciones', icon: Bell, modulo: 'notificaciones' },
      { label: 'Sponsors', href: '/admin/sponsors', icon: Star, modulo: 'sponsors' },
    ],
  },
  {
    titulo: 'Sistema',
    items: [
      { label: 'Configuración', href: '/admin/configuracion', icon: Settings, modulo: 'configuracion' },
      { label: 'Datos personales', href: '/admin/privacidad', icon: ShieldCheck, modulo: 'configuracion' },
    ],
  },
];

interface NavItem {
  label: string;
  href: string;
  icon: any;
  modulo: Modulo;
}

function Sidebar({
  currentPath,
  onLogout,
  rol,
  onNavigate,
}: {
  currentPath: string;
  onLogout: () => void;
  rol?: Rol;
  onNavigate?: () => void;
}) {
  const visibles = SECCIONES
    .map((s) => ({ ...s, items: s.items.filter((i) => !rol || tieneModulo(rol, i.modulo)) }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-line px-4 py-4">
        <Link href="/admin/dashboard" className="flex items-center gap-3" onClick={onNavigate}>
          <img src="/logo.png" alt="Fenix" className="h-9 w-9 shrink-0 object-contain" />
          <div className="min-w-0">
            <p className="text-base font-bold leading-tight tracking-tight text-main">FENIX</p>
            <p className="truncate text-[10px] uppercase tracking-wider text-dim">
              Panel de la Directiva
            </p>
          </div>
        </Link>
      </div>

      {/* min-h-0: sin esto el nav crece mas alla del viewport en vez de scrollear. */}
      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {visibles.map((seccion) => (
          <div key={seccion.titulo}>
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-dim">
              {seccion.titulo}
            </p>
            <ul className="space-y-0.5">
              {seccion.items.map((item) => {
                const activo = currentPath === item.href || currentPath.startsWith(item.href + '/');
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={activo ? 'page' : undefined}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                        activo
                          ? 'bg-brand/10 text-brand'
                          : 'text-muted hover:bg-surface-2 hover:text-main'
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-line p-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-main"
        >
          <Home className="h-4 w-4" /> Ver el sitio público
        </Link>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-muted transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}

/** Convierte /admin/links-familia -> "Links Familia" */
function tituloRuta(seg: string): string {
  const REGLAS: Record<string, string> = {
    'links-familia': 'Vínculos familiares',
    dashboard: 'Inicio',
    usuarios: 'Usuarios',
  };
  if (REGLAS[seg]) return REGLAS[seg];
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
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

  useEffect(() => { setOpen(false); }, [pathname]);

  const handleLogout = async () => { await logout(); router.push('/login'); };

  const migas = pathname.split('/').filter(Boolean).slice(1); // sin 'admin'
  const crumbs = [
    { label: 'Inicio', href: '/admin/dashboard' },
    ...migas.map((s, i) => ({
      label: tituloRuta(s),
      href: '/admin/' + migas.slice(0, i + 1).join('/'),
    })),
  ];

  return (
    <div className="flex min-h-screen bg-base">
      <aside className="hidden min-h-0 w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <Sidebar currentPath={pathname} onLogout={handleLogout} rol={user?.rol} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger>
                <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Abrir menú">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 border-line bg-surface p-0">
                <Sidebar
                  currentPath={pathname}
                  onLogout={handleLogout}
                  rol={user?.rol}
                  onNavigate={() => setOpen(false)}
                />
              </SheetContent>
            </Sheet>

            <nav aria-label="Ruta" className="hidden min-w-0 items-center gap-1 text-sm sm:flex">
              {crumbs.map((c, i) => (
                <span key={c.href} className="flex min-w-0 items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-dim" />}
                  {i === crumbs.length - 1 ? (
                    <span className="truncate font-medium text-main">{c.label}</span>
                  ) : (
                    <Link href={c.href} className="truncate text-dim hover:text-muted">{c.label}</Link>
                  )}
                </span>
              ))}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {user && (
              <>
                <div className="hidden text-right sm:block">
                  <p className="text-[13px] font-medium leading-tight text-main">
                    {user.nombre} {user.apellido}
                  </p>
                  <p className="inline-flex items-center gap-1 text-[11px] text-dim">
                    <Shield className="h-3 w-3" />
                    {ROL_LABEL[user.rol as Rol] ?? user.rol}
                  </p>
                </div>
                <Link href="/admin/configuracion" aria-label="Mi configuración">
                  <Avatar className="h-8 w-8 cursor-pointer transition-all hover:ring-2 hover:ring-brand/50">
                    <AvatarFallback className="bg-brand/15 text-[11px] font-bold text-brand">
                      {iniciales(user.nombre, user.apellido)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              </>
            )}
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6">
          <div className="mx-auto max-w-7xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
