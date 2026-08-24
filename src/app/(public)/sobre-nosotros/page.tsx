'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Users, MapPin, Calendar, Heart, Target, Shield, Star, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const TIMELINE = [
  { year: '1995', title: 'Fundación', desc: 'Un grupo de familias funda el Fenix Roller Hockey con el sueño de practicar hockey sobre hierba.', icon: '🏗️' },
  { year: '2000', title: 'Primera Cancha', desc: 'Inauguración de la cancha principal con césped sintético y dimensiones reglamentarias.', icon: '🏟️' },
  { year: '2005', title: 'Primer Campeonato', desc: 'Participación en el campeonato regional con resultado histórico: subcampeones.', icon: '🏆' },
  { year: '2010', title: 'Cancha Auxiliar', desc: 'Construcción de la cancha auxiliar para entrenamientos tácticos y técnicos.', icon: '⚽' },
  { year: '2015', title: '20 Años', desc: 'Celebración de las bodas de oro del club con más de 50 jugadores activos.', icon: '🎉' },
  { year: '2020', title: 'Era Digital', desc: 'Lanzamiento de la plataforma digital para socios, pagos y gestión del club.', icon: '💻' },
  { year: '2026', title: 'Temporada Actual', desc: '15+ jugadores activos, 10+ familias y un equipo que crece cada año.', icon: '🚀' },
];

const VALORES = [
  { title: 'Respeto', desc: 'Valoramos a cada integrante del club, jugadores, familias y cuerpo técnico.', icon: Heart, color: '#DC2626' },
  { title: 'Disciplina', desc: 'El esfuerzo constante y la dedication son la base del crecimiento deportivo.', icon: Target, color: '#3B82F6' },
  { title: 'Compañerismo', desc: 'El hockey es un deporte de equipo. Enseñamos a ganar y perder juntos.', icon: Users, color: '#10B981' },
  { title: 'Integridad', desc: 'Formamos personas íntegras que llevan los valores del deporte a su vida diaria.', icon: Shield, color: '#F59E0B' },
];

const INSTALACIONES = [
  { name: 'Cancha Principal', specs: ['91x55m reglamentario', 'Césped sintético', 'Iluminación artificial', 'Vestuarios completos'], color: 'from-[#DC2626] to-[#B91C1C]' },
  { name: 'Cancha Auxiliar', specs: ['60x40m', 'Entrenamiento táctico', 'Zona de calentamiento', 'Almacén de equipamiento'], color: 'from-blue-600 to-indigo-700' },
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
              <span className="text-sm text-gray-300 font-medium">Más de 25 años de historia</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-white leading-[0.95] mb-6 tracking-tight">
              Sobre <span className="text-[#DC2626]">Nosotros</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-400 mb-8 max-w-lg leading-relaxed">
              Conocé la historia del Fenix Roller Hockey, un club dedicado a formar campeones dentro y fuera de la cancha desde 1995.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-gray-900 border-y border-gray-800">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-800">
            {[
              { value: '1995', label: 'Fundación', icon: Calendar },
              { value: '25+', label: 'Años de Historia', icon: Trophy },
              { value: '15+', label: 'Jugadores Activos', icon: Users },
              { value: '10+', label: 'Familias', icon: Heart },
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
              <h2 className="text-3xl font-bold text-white">Más de 25 años de pasión</h2>
            </div>

            <div className="space-y-6 text-gray-400 leading-relaxed text-lg">
              <p>Fundado en 1995, el <span className="text-white font-semibold">Fenix Roller Hockey</span> nació del sueño de un grupo de familias que querían brindar la oportunidad de practicar hockey sobre hierba a los jóvenes de la zona.</p>
              <p>A lo largo de más de dos décadas, hemos formado no solo jugadores, sino también <span className="text-[#DC2626] font-semibold">personas íntegras</span> que llevan los valores del deporte a todas las áreas de sus vidas.</p>
              <p>Hoy contamos con más de 15 jugadores activos, dos canchas de primer nivel y una comunidad unida que crece cada año. Nuestro objetivo sigue siendo el mismo: formar campeones dentro y fuera de la cancha.</p>
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

      {/* Instalaciones */}
      <section className="py-20 bg-gray-900/50">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-sm text-[#DC2626] font-semibold uppercase tracking-wider mb-2">Instalaciones</p>
              <h2 className="text-3xl font-bold text-white">Nuestras Canchas</h2>
              <p className="text-gray-400 mt-3 max-w-lg mx-auto">Espacios de primer nivel para el mejor desarrollo deportivo</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {INSTALACIONES.map((inst, i) => (
                <Card key={i} className="bg-gray-900 border-gray-800 overflow-hidden group hover:border-gray-700 transition-all">
                  <div className={`h-3 bg-gradient-to-r ${inst.color}`} />
                  <CardContent className="p-6">
                    <h3 className="text-xl font-bold text-white mb-4">{inst.name}</h3>
                    <ul className="space-y-3">
                      {inst.specs.map((spec, j) => (
                        <li key={j} className="flex items-center gap-3 text-sm text-gray-400">
                          <div className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
                          {spec}
                        </li>
                      ))}
                    </ul>
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
