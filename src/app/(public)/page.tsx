'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Users, MapPin, ArrowRight, Clock, ChevronRight, Star, Heart, Zap } from 'lucide-react';
import { CalendarioPartidos } from '@/components/CalendarioPartidos';

function HeroSection() {
  return (
    <section className="relative min-h-[100vh] flex items-center overflow-hidden bg-[#0A0A0A]">
      <div className="absolute inset-0 flex justify-end items-end">
        <img src="/splash.png" alt="Jugador Fenix Roller Hockey" className="h-[85%] w-auto object-cover object-top opacity-80" style={{ maskImage: 'linear-gradient(to left, black 50%, transparent 100%), linear-gradient(to bottom, black 60%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to left, black 50%, transparent 100%), linear-gradient(to bottom, black 60%, transparent 100%)', maskComposite: 'intersect', WebkitMaskComposite: 'source-in' }} />
      </div>
      <div className="absolute right-0 bottom-0 w-[40%] h-[70%] bg-[#DC2626]/10 rounded-full blur-[120px]" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-[#0A0A0A]/90 to-transparent w-[65%]" />
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="relative z-10 container mx-auto px-4 py-20">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-[#DC2626]/10 border border-[#DC2626]/20 rounded-full px-4 py-2 mb-8">
            <div className="h-2 w-2 rounded-full bg-[#DC2626] animate-pulse" />
            <span className="text-sm text-gray-300 font-medium">Temporada 2026 en curso</span>
          </div>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white leading-[0.95] mb-6 tracking-tight">
            Fenix Roller<br /><span className="text-[#DC2626]">Hockey</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-md leading-relaxed">
            Más de 25 años formando campeones dentro y fuera de la cancha. Unite a nuestra familia deportiva.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mb-14">
            <Link href="/registro"><Button size="lg" className="bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold px-8 h-14 text-base gap-2 shadow-lg shadow-[#DC2626]/25">Unite al Club <ArrowRight className="h-5 w-5" /></Button></Link>
            <Link href="/club"><Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/5 font-semibold px-8 h-14 text-base">Conocé Más</Button></Link>
          </div>
          <div className="grid grid-cols-3 gap-6 max-w-md">
            {[{ value: '15+', label: 'Jugadores' }, { value: '10+', label: 'Familias' }, { value: '25+', label: 'Años' }].map((stat, i) => (
              <div key={i}><p className="text-2xl md:text-3xl font-black text-white">{stat.value}</p><p className="text-xs text-gray-500 uppercase tracking-wider mt-1">{stat.label}</p></div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-white/20 flex justify-center pt-2"><div className="w-1 h-2.5 rounded-full bg-[#DC2626]" /></div>
      </div>
    </section>
  );
}

function NoticiasSection() {
  const [noticias, setNoticias] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/admin/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'comunicados', operation: 'select', columns: '*', filters: { estado: 'publicado' }, limit: 3, order: { column: 'fecha_publicacion', ascending: false } }),
    }).then(r => r.json()).then(d => setNoticias(d.data || []));
  }, []);

  const tipoColors: Record<string, string> = { urgente: 'from-red-500 to-red-600', pago: 'from-amber-500 to-orange-600', deportivo: 'from-blue-500 to-indigo-600', evento: 'from-violet-500 to-purple-600', general: 'from-[#DC2626] to-[#B91C1C]' };

  return (
    <section className="py-24 bg-gray-950">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-12">
          <div><p className="text-sm text-[#DC2626] font-semibold uppercase tracking-wider mb-2">Novedades</p><h2 className="text-3xl md:text-4xl font-bold text-white">Comunicados del Club</h2></div>
          <Link href="/comunicados" className="hidden sm:flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">Ver todos <ChevronRight className="h-4 w-4" /></Link>
        </div>
        {noticias.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {noticias.map((n) => (
              <Card key={n.id} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-all group overflow-hidden">
                <div className={`h-2 bg-gradient-to-r ${tipoColors[n.tipo] || tipoColors.general}`} />
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-gradient-to-r ${tipoColors[n.tipo] || tipoColors.general} text-white`}>{n.tipo}</span>
                    {n.destacado && <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#DC2626]/20 text-[#DC2626]">★</span>}
                    <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(n.fecha_publicacion || n.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <h3 className="font-bold text-white text-lg mb-2 group-hover:text-[#DC2626] transition-colors">{n.titulo}</h3>
                  <p className="text-sm text-gray-400 line-clamp-3">{n.resumen || n.contenido}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[{ title: 'Próximo Partido', desc: 'El sábado 30 de agosto jugamos contra San Isidro a las 15hs en la cancha principal.', tipo: 'deportivo' }, { title: 'Vencimiento Cuotas', desc: 'Recordá que las cuotas del mes vencen el día 10 de cada mes.', tipo: 'pago' }, { title: 'Asamblea General', desc: 'El 15 de septiembre a las 19hs se realiza la asamblea anual del club.', tipo: 'general' }].map((n, i) => (
              <Card key={i} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-all group overflow-hidden">
                <div className={`h-2 bg-gradient-to-r ${tipoColors[n.tipo] || tipoColors.general}`} />
                <CardContent className="p-6">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-gradient-to-r ${tipoColors[n.tipo] || tipoColors.general} text-white mb-3`}>{n.tipo}</span>
                  <h3 className="font-bold text-white text-lg mb-2 group-hover:text-[#DC2626] transition-colors">{n.title}</h3>
                  <p className="text-sm text-gray-400">{n.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function GaleriaSection() {
  const [fotos, setFotos] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/admin/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'fotos_galeria', operation: 'select', columns: '*', limit: 8, order: { column: 'created_at', ascending: false } }),
    }).then(r => r.json()).then(d => setFotos(d.data || []));
  }, []);

  const placeholderFotos = [{ id: '1', url: '', descripcion: 'Entrenamiento en cancha principal' }, { id: '2', url: '', descripcion: 'Equipo completo 2026' }, { id: '3', url: '', descripcion: 'Partido contra San Isidro' }, { id: '4', url: '', descripcion: 'Celebración del equipo' }, { id: '5', url: '', descripcion: 'Entrenamiento de juveniles' }, { id: '6', url: '', descripcion: 'Ceremonia de premiación' }];
  const displayFotos = fotos.length > 0 ? fotos : placeholderFotos;

  return (
    <section className="py-24 bg-gray-900/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-12">
          <div><p className="text-sm text-[#DC2626] font-semibold uppercase tracking-wider mb-2">Galería</p><h2 className="text-3xl md:text-4xl font-bold text-white">Momentos del Club</h2></div>
          <Link href="/galeria" className="hidden sm:flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">Ver galería completa <ChevronRight className="h-4 w-4" /></Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {displayFotos.slice(0, 8).map((f, i) => (
            <div key={f.id} className={`relative group rounded-2xl overflow-hidden bg-gray-800 ${i === 0 || i === 5 ? 'row-span-2 aspect-[3/4]' : 'aspect-square'}`}>
              {f.url ? <img src={f.url} alt={f.descripcion} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-700 flex items-center justify-center"><span className="text-4xl opacity-30">🏑</span></div>}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              {f.descripcion && <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300"><p className="text-sm font-medium text-white">{f.descripcion}</p></div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SponsorsSection() {
  const [sponsors, setSponsors] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/admin/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'sponsors', operation: 'select', columns: '*', filters: { activo: true }, order: { column: 'orden', ascending: true } }),
    }).then(r => r.json()).then(d => setSponsors(d.data || []));
  }, []);

  const fallbackSponsors = [
    { id: '1', nombre: 'Deportes AR', tier: 'gold', logo_url: null },
    { id: '2', nombre: 'Hockey Pro', tier: 'gold', logo_url: null },
    { id: '3', nombre: 'Sports Tech', tier: 'silver', logo_url: null },
    { id: '4', nombre: 'Fitness Plus', tier: 'silver', logo_url: null },
    { id: '5', nombre: 'Arena Store', tier: 'bronze', logo_url: null },
    { id: '6', nombre: 'Coach Lab', tier: 'bronze', logo_url: null },
  ];

  const displaySponsors = sponsors.length > 0 ? sponsors : fallbackSponsors;

  return (
    <section className="py-20 bg-gray-950 border-t border-gray-800/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-sm text-[#DC2626] font-semibold uppercase tracking-wider mb-2">Aliados</p>
          <h2 className="text-3xl font-bold text-white">Nuestros Sponsors</h2>
          <p className="text-gray-400 mt-2 text-sm">Empresas que nos acompañan</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-4xl mx-auto">
          {displaySponsors.map((s) => (
            <div key={s.id} className={`rounded-2xl p-6 flex items-center justify-center border transition-all hover:scale-105 ${s.tier === 'gold' ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40' : s.tier === 'silver' ? 'bg-gray-500/5 border-gray-500/20 hover:border-gray-500/40' : 'bg-orange-500/5 border-orange-500/20 hover:border-orange-500/40'}`}>
              <div className="text-center">
                {s.logo_url ? <img src={s.logo_url} alt={s.nombre} className="h-10 w-10 object-contain mx-auto mb-2" /> : <Star className={`h-6 w-6 mx-auto mb-2 ${s.tier === 'gold' ? 'text-amber-400' : s.tier === 'silver' ? 'text-gray-400' : 'text-orange-400'}`} />}
                <p className="text-xs font-semibold text-white">{s.nombre}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-[#DC2626] to-[#B91C1C]" />
      <div className="absolute inset-0 opacity-10"><div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-[100px]" /></div>
      <div className="relative z-10 container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">¿Listo para jugar?</h2>
        <p className="text-lg text-red-100 mb-8 max-w-md mx-auto">Unite a nuestra familia deportiva y formá parte de la historia del club</p>
        <Link href="/registro"><Button size="lg" className="bg-white text-[#B91C1C] hover:bg-gray-100 font-bold px-10 h-14 text-base gap-2 shadow-xl">Registrarme Ahora <ArrowRight className="h-5 w-5" /></Button></Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-950 border-t border-gray-800/50 py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4"><img src="/logo.png" alt="Fenix" className="h-8 w-8 object-contain" /><div><p className="font-bold text-white text-xl">Fenix Roller Hockey</p><p className="text-xs text-gray-500 uppercase tracking-wider">Desde 1995</p></div></div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm">Club de hockey sobre hierba dedicado a la formación deportiva y personal de nuestros jugadores. Más de 25 años de historia.</p>
            <div className="flex items-center gap-4 mt-6">
              <a href="https://wa.me/+541155512345" target="_blank" rel="noopener noreferrer" className="h-10 w-10 rounded-xl bg-gray-800 hover:bg-[#DC2626] flex items-center justify-center text-gray-400 hover:text-white transition-all"><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="h-10 w-10 rounded-xl bg-gray-800 hover:bg-pink-600 flex items-center justify-center text-gray-400 hover:text-white transition-all"><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg></a>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-4">Navegación</h3>
            <ul className="space-y-2">
              {[{ label: 'El Club', href: '/club' }, { label: 'Sobre Nosotros', href: '/sobre-nosotros' }, { label: 'Comunicados', href: '/comunicados' }, { label: 'Galería', href: '/galeria' }, { label: 'Entrenamientos', href: '/entrenamientos' }, { label: 'Contacto', href: '/contacto' }, { label: 'Iniciar Sesión', href: '/login' }].map((l) => (
                <li key={l.href}><Link href={l.href} className="text-sm text-gray-400 hover:text-[#DC2626] transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-4">Contacto</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 shrink-0" /> Av. Libertador 1234, CABA</li>
              <li className="flex items-center gap-2"><Clock className="h-4 w-4 shrink-0" /> Lun-Sáb 10:00 - 18:00</li>
              <li className="flex items-center gap-2"><Zap className="h-4 w-4 shrink-0" /> info@clubhockey.com.ar</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-gray-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">&copy; 2026 Fenix Roller Hockey. Todos los derechos reservados.</p>
          <p className="text-xs text-gray-600">Hecho con ❤️ para el hockey argentino</p>
        </div>
      </div>
    </footer>
  );
}

export default function HomePage() {
  return (
    <div>
      <HeroSection />
      <CalendarioPartidos />
      <NoticiasSection />
      <GaleriaSection />
      <SponsorsSection />
      <CTASection />
      <Footer />
    </div>
  );
}
