'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X, User, LogIn, LogOut, LayoutDashboard, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { createClient } from '@supabase/supabase-js';
import { NotificationsBell } from './NotificationsBell';

const PUBLIC_LINKS = [
  { label: 'Inicio', href: '/' },
  { label: 'Club', href: '/club' },
  { label: 'Comunicados', href: '/comunicados' },
  { label: 'Galería', href: '/galeria' },
  { label: 'Entrenamientos', href: '/entrenamientos' },
  { label: 'Contacto', href: '/contacto' },
];

const MORE_LINKS = [
  { label: 'Sobre Nosotros', href: '/sobre-nosotros' },
];

const ROLE_DASHBOARD: Record<string, { href: string; label: string }> = {
  admin: { href: '/admin/dashboard', label: 'Panel Admin' },
  padre: { href: '/padre/dashboard', label: 'Mi Cuenta' },
  deportista: { href: '/deportista/dashboard', label: 'Mi Cuenta' },
};

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) { setLoading(false); return; }

    const supabase = createClient(url, key);

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const authUser = session.user;
          // Try to get profile, fallback to auth metadata
          let perfil = null;
          try {
            const { data } = await supabase
              .from('perfiles')
              .select('nombre, apellido, rol')
              .eq('id', authUser.id)
              .single();
            perfil = data;
          } catch {}

          setUser({
            id: authUser.id,
            email: authUser.email,
            perfil: perfil || {
              nombre: authUser.user_metadata?.nombre || authUser.email?.split('@')[0] || 'Usuario',
              apellido: authUser.user_metadata?.apellido || '',
              rol: authUser.user_metadata?.rol || 'padre',
            },
          });
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const handleLogout = async () => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && key) {
        const supabase = createClient(url, key);
        await supabase.auth.signOut();
      }
    } catch {}
    setUser(null);
    setUserMenuOpen(false);
    setOpen(false);
    window.location.href = '/';
  };

  const dashboardInfo = user?.perfil?.rol ? ROLE_DASHBOARD[user.perfil.rol] : null;
  const initials = user?.perfil
    ? `${user.perfil.nombre?.[0] || ''}${user.perfil.apellido?.[0] || ''}`
    : user?.email?.[0]?.toUpperCase() || '?';

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#0A0A0A]/90 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <img src="/logo.png" alt="Fenix Roller Hockey" className="h-9 w-9 object-contain" />
          <div className="flex flex-col leading-none">
            <span className="font-extrabold text-lg text-white tracking-tight">FENIX</span>
            <span className="text-[8px] text-gray-400 uppercase tracking-[0.2em]">Roller Hockey</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-1">
          {PUBLIC_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                pathname === link.href
                  ? 'bg-[#DC2626]/10 text-[#DC2626]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {link.label}
            </Link>
          ))}
          {/* More dropdown */}
          <div className="relative group">
            <button className="px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all">
              Más ▾
            </button>
            <div className="absolute right-0 top-full pt-2 hidden group-hover:block z-50">
              <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-2 min-w-[160px]">
                {MORE_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      pathname === link.href
                        ? 'bg-[#DC2626]/10 text-[#DC2626]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Auth / User Section */}
        <div className="flex items-center gap-2 shrink-0">
          {loading ? (
            <div className="hidden sm:flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gray-800 animate-pulse" />
            </div>
          ) : user ? (
            /* Logged in */
            <div className="hidden sm:flex items-center gap-2">
              <NotificationsBell userId={user.id} />
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/5 transition-all"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-[#DC2626] text-white text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white leading-tight">
                      {user.perfil.nombre} {user.perfil.apellido}
                    </p>
                    <p className="text-[10px] text-gray-500 capitalize">{user.perfil.rol}</p>
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-gray-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 z-50 w-52 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-2">
                      <div className="px-3 py-2 mb-1 border-b border-gray-800">
                        <p className="text-sm font-medium text-white">{user.perfil.nombre} {user.perfil.apellido}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                      {dashboardInfo && (
                        <Link
                          href={dashboardInfo.href}
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          {dashboardInfo.label}
                        </Link>
                      )}
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <LogOut className="h-4 w-4" />
                        Cerrar Sesión
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Not logged in */
            <div className="hidden sm:flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-white/10 text-sm gap-2">
                  <LogIn className="h-4 w-4" />
                  Iniciar Sesión
                </Button>
              </Link>
              <Link href="/registro">
                <Button className="bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm gap-2">
                  <User className="h-4 w-4" />
                  Registrarse
                </Button>
              </Link>
            </div>
          )}

          {/* Mobile Menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger>
              <Button variant="ghost" size="icon" className="lg:hidden text-gray-400 hover:text-white">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-[#0A0A0A] border-gray-800 p-0">
              <div className="flex flex-col h-full">
                <div className="p-5 border-b border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="Fenix" className="h-8 w-8 object-contain" />
                    <span className="font-bold text-white">FENIX</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                {user && (
                  <div className="p-4 border-b border-gray-800 flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-[#DC2626] text-white text-sm font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-white">{user.perfil.nombre} {user.perfil.apellido}</p>
                      <p className="text-xs text-gray-500 capitalize">{user.perfil.rol}</p>
                    </div>
                  </div>
                )}

                <nav className="flex-1 p-4 space-y-1">
                  {[...PUBLIC_LINKS, ...MORE_LINKS].map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={`block px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        pathname === link.href ? 'bg-[#DC2626]/10 text-[#DC2626]' : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>

                <div className="p-4 space-y-2 border-t border-gray-800">
                  {user ? (
                    <>
                      {dashboardInfo && (
                        <Link href={dashboardInfo.href} onClick={() => setOpen(false)}>
                          <Button className="w-full bg-[#DC2626] hover:bg-[#B91C1C] gap-2">
                            <LayoutDashboard className="h-4 w-4" /> {dashboardInfo.label}
                          </Button>
                        </Link>
                      )}
                      <Button
                        variant="outline"
                        onClick={handleLogout}
                        className="w-full border-gray-700 text-gray-300 hover:text-red-400 hover:border-red-500/30 gap-2"
                      >
                        <LogOut className="h-4 w-4" /> Cerrar Sesión
                      </Button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" onClick={() => setOpen(false)}>
                        <Button variant="outline" className="w-full border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 gap-2">
                          <LogIn className="h-4 w-4" /> Iniciar Sesión
                        </Button>
                      </Link>
                      <Link href="/registro" onClick={() => setOpen(false)}>
                        <Button className="w-full bg-[#DC2626] hover:bg-[#B91C1C] gap-2">
                          <User className="h-4 w-4" /> Registrarse
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
