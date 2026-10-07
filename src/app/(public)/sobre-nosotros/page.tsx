'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Users, Calendar, Heart, Target, Shield, ChevronRight } from 'lucide-react';
import Link from 'next/link';

/**
 * Línea de tiempo.
 *
 * ANTES ACÁ HABÍA SIETE HITOS INVENTADOS: fundación en 1995, primera cancha en
 * 2000, subcampeonato regional en 2005, cancha auxiliar en 2010, bodas de oro en
 * 2015 y "lanzamiento de la plataforma digital" en 2020. Ninguno ocurrió: el
 * club se fundó en 2026.
 *
 * Los cuatro hitos de abajo salen de la historia que escribió el club, no de
 * criterio propio. Lo que no se puede verificar no se pone: preferimos cuatro
 * fechas reales a siete imaginarias.
 */
const TIMELINE = [
  {
    year: '2026',
    title: 'Nace Fénix',
    desc: 'Un grupo de familias y jugadores crea el club en Neuquén con el sueño de darle un lugar donde desarrollarse al hockey sobre patines en línea.',
    icon: '🏗️',
  },
  {
    year: '2026',
    title: 'Categorías formativas',
    desc: 'Se incorporan distintas categorías formativas y competitivas, desde los más pequeños hasta jóvenes y adultos.',
    icon: '🏟️',
  },
  {
    year: 'Marzo 2026',
    title: 'Formalización',
    desc: 'La institución se constituye como Simple Asociación Hockey Roller Confluencia, consolidando jurídicamente el proyecto.',
    icon: '⚖️',
  },
  {
    year: 'Hoy',
    title: 'Hockey neuquino',
    desc: 'Acompañamos a deportistas que alcanzaron instancias de Selección Argentina y trabajamos en el desarrollo del hockey neuquino.',
    icon: '🏆',
  },
];

const VALORES = [
  { title: 'Respeto', desc: 'Valoramos a cada integrante del club, jugadores, familias y cuerpo técnico.', icon: Heart, color: '#DC2626' },
  { title: 'Disciplina', desc: 'El esfuerzo constante y la dedicación son la base del crecimiento deportivo.', icon: Target, color: '#3B82F6' },
  { title: 'Compañerismo', desc: 'El hockey es un deporte de equipo. Enseñamos a ganar y perder juntos.', icon: Users, color: '#10B981' },
  { title: 'Solidaridad', desc: 'Nos acompañan las familias que hacen posible que cada jugador llegue a su objetivo.', icon: Shield, color: '#F59E0B' },
];



export default function SobreNosotrosPage() {
  return (
    <div className="space-y-0">
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden bg-[#0A0A0A]">
        <div className="absolute inset-0">
          <img src="/splash.png" alt="" className="w-full h-full object-cover object-top opacity-20" style={{ maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)' }} />
        </div>
        <div className="absolute right-0 bottom-0 w-[50%] h-[60%] bg-[#DC2626]/15 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/80 to-[#0A0A0A]/50" />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative z-10 container mx-auto px-4 py-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-[#DC2626]/10 border border-[#DC2626]/20 rounded-full px-4 py-2 mb-6">
              <Trophy className="h-4 w-4 text-[#DC2626]" />
              <span className="text-sm text-gray-300 font-medium">Hockey sobre patines en línea</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-white leading-[0.95] mb-6 tracking-tight">
              Sobre <span className="text-[#DC2626]">Nosotros</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-400 mb-8 max-w-lg leading-relaxed">
              Conocé la historia del Fenix Roller Hockey, un club de hockey sobre patines en línea de Neuquén.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-gray-900 border-y border-gray-800">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-800">
            {[
              { value: '2026', label: 'Fundación', icon: Calendar },
              { value: '1', label: 'Año de historia', icon: Trophy },
              { value: 'Inline', label: 'Disciplina', icon: Users },
              { value: 'Neuquén', label: 'Ciudad', icon: Heart },
            ].map((s, i) => (
              <div key={i} className="py-6 px-6 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-[#DC2626]/10 flex items-center justify-center">
                  <s.icon className="h-5 w-5 text-[#DC2626]" />
                </div>
                <div>
                  <p className="text-2xl font-black text-white">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nuestra Historia */}
      <section className="py-20 bg-gray-950">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-sm text-[#DC2626] font-semibold uppercase tracking-wider mb-2">Nuestra Historia</p>
              <h2 className="text-3xl font-bold text-white">Un club que recién empieza</h2>
            </div>

            <div className="space-y-6 text-gray-400 leading-relaxed text-lg">
              <p><span className="text-white font-semibold">Fénix Roller Hockey Neuquén</span> nació de una idea sencilla pero ambiciosa: crear en Neuquén un espacio donde niños, jóvenes y adultos pudieran aprender, entrenar y desarrollarse en el hockey sobre patines en línea.</p>
              <p>En marzo de 2026 alcanzamos un paso fundamental en nuestra historia con la formalización de nuestra institución como <span className="text-[#DC2626] font-semibold">Simple Asociación Hockey Roller Confluencia</span>.</p>
              <p>Hoy trabajamos para ampliar nuestra escuela deportiva, fortalecer nuestras categorías competitivas y avanzar hacia uno de nuestros grandes objetivos: contar con un espacio deportivo propio.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 bg-gray-900/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-sm text-[#DC2626] font-semibold uppercase tracking-wider mb-2">Cronología</p>
              <h2 className="text-3xl font-bold text-white">Nuestro Camino</h2>
            </div>

            <div className="relative">
              {/* Línea vertical */}
              <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#DC2626] via-gray-700 to-gray-800" />

              <div className="space-y-12">
                {TIMELINE.map((item, i) => (
                  <div key={i} className={`relative flex items-center gap-8 ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                    {/* Dot */}
                    <div className="absolute left-8 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#DC2626] border-4 border-gray-900 z-10" />

                    {/* Content */}
                    <div className={`flex-1 ml-16 md:ml-0 ${i % 2 === 0 ? 'md:text-right md:pr-12' : 'md:text-left md:pl-12'}`}>
                      <div className={`inline-block ${i % 2 === 0 ? '' : ''}`}>
                        <span className="text-3xl mb-2 block">{item.icon}</span>
                        <span className="text-[#DC2626] font-black text-sm">{item.year}</span>
                        <h3 className="text-lg font-bold text-white mt-1">{item.title}</h3>
                        <p className="text-sm text-gray-400 mt-1 max-w-sm">{item.desc}</p>
                      </div>
                    </div>

                    {/* Spacer for the other side */}
                    <div className="hidden md:block flex-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Valores */}
      <section className="py-20 bg-gray-950">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-sm text-[#DC2626] font-semibold uppercase tracking-wider mb-2">Nuestros Valores</p>
              <h2 className="text-3xl font-bold text-white">¿En qué creemos?</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {VALORES.map((v, i) => (
                <Card key={i} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-all group">
                  <CardContent className="p-6 text-center">
                    <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-all" style={{ backgroundColor: `${v.color}15` }}>
                      <v.icon className="h-8 w-8" style={{ color: v.color }} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{v.title}</h3>
                    <p className="text-sm text-gray-400">{v.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#DC2626] to-[#B91C1C]" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-[100px]" />
        </div>
        <div className="relative z-10 container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">¿Querés ser parte?</h2>
          <p className="text-lg text-red-100 mb-8 max-w-md mx-auto">Unite a nuestra familia deportiva y formá parte de la historia del club</p>
          <Link href="/registro">
            <button className="bg-white text-[#B91C1C] hover:bg-gray-100 font-bold px-10 h-14 text-base gap-2 inline-flex items-center shadow-xl rounded-lg transition-all">
              Quiero Sumarme <ChevronRight className="h-5 w-5" />
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
