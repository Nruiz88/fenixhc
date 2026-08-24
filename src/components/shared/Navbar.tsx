'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, User, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

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

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
          {/* More dropdown for overflow links */}
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

        {/* Auth Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/login">
            <Button variant="ghost" className="hidden sm:flex text-gray-300 hover:text-white hover:bg-white/10 text-sm gap-2">
              <LogIn className="h-4 w-4" />
              Iniciar Sesión
            </Button>
          </Link>
          <Link href="/registro">
            <Button className="hidden sm:flex bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm gap-2">
              <User className="h-4 w-4" />
              Registrarse
            </Button>
          </Link>

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
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
