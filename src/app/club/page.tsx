'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, MapPin, Users, Star, Calendar, Target, ArrowRight, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function ClubPage() {
  return (
    <div className="space-y-0">
      {/* Hero with splash image */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden bg-[#0A0A0A]">
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src="/splash.png"
            alt="Fenix Roller Hockey"
            className="w-full h-full object-cover object-top opacity-25"
            style={{
              maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
            }}
          />
        </div>

        {/* Red glow */}
        <div className="absolute right-0 bottom-0 w-[50%] h-[60%] bg-[#DC2626]/15 rounded-full blur-[120px]" />

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/70 to-[#0A0A0A]/40" />

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative z-10 container mx-auto px-4 py-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-[#DC2626]/10 border border-[#DC2626]/20 rounded-full px-4 py-2 mb-6">
              <Trophy className="h-4 w-4 text-[#DC2626]" />
              <span className="text-sm text-gray-300 font-medium">Desde 1995</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-black text-white leading-[0.95] mb-6 tracking-tight">
              El <span className="text-[#DC2626]">Club</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 mb-8 max-w-lg leading-relaxed">
              Conocé nuestra historia, instalaciones y categorías. Más de 25 años formando campeones dentro y fuera de la cancha.
            </p>

            <Link href="/contacto" className="inline-flex">
              <button className="bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold px-8 h-12 rounded-lg text-sm gap-2 flex items-center shadow-lg shadow-[#DC2626]/25 transition-all">
                Conocé al Club <ChevronRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Historia */}
      <section className="py-20 bg-gray-950">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div>
              <p className="text-sm text-[#DC2626] font-semibold uppercase tracking-wider mb-2">Nuestra Historia</p>
              <h2 className="text-3xl font-bold text-white mb-6">Más de 25 años de pasión</h2>
              <div className="space-y-4 text-gray-400 leading-relaxed">
                <p>Fundado en 1995, el Fenix Roller Hockey nació del sueño de un grupo de familias que querían brindar la oportunidad de practicar hockey sobre hierba a los jóvenes de la zona.</p>
                <p>A lo largo de más de dos décadas, hemos formado no solo jugadores, sino también personas íntegras que llevan los valores del deporte a todas las áreas de sus vidas.</p>
                <p>Hoy contamos con más de 15 jugadores activos, dos canchas de primer nivel y una comunidad unida que crece cada año.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: '1995', label: 'Fundación', icon: Calendar },
                { value: '15+', label: 'Jugadores', icon: Users },
                { value: '2', label: 'Canchas', icon: MapPin },
                { value: '25+', label: 'Años', icon: Trophy },
              ].map((s, i) => (
                <Card key={i} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-all group">
                  <CardContent className="p-6 text-center">
                    <div className="h-12 w-12 rounded-xl bg-[#DC2626]/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-[#DC2626] transition-all">
                      <s.icon className="h-6 w-6 text-[#DC2626] group-hover:text-white transition-all" />
                    </div>
                    <p className="text-3xl font-black text-white">{s.value}</p>
                    <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">{s.label}</p>
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
          <div className="text-center mb-12">
            <p className="text-sm text-[#DC2626] font-semibold uppercase tracking-wider mb-2">Instalaciones</p>
            <h2 className="text-3xl font-bold text-white">Nuestras Canchas</h2>
            <p className="text-gray-400 mt-3 max-w-lg mx-auto">Espacios de primer nivel para el mejor desarrollo deportivo</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Card className="bg-gray-900 border-gray-800 overflow-hidden group hover:border-gray-700 transition-all">
              <div className="h-48 bg-gradient-to-br from-[#DC2626] to-[#B91C1C] flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-10 right-10 w-32 h-32 bg-white rounded-full blur-[60px]" />
                </div>
                <Target className="h-16 w-16 text-white/30 group-hover:text-white/50 transition-all" />
              </div>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-white mb-2">Cancha Principal</h3>
                <p className="text-sm text-gray-400 mb-4">Cancha de hockey sobre césped sintético de última generación, con medidas reglamentarias (91x55m) y iluminación artificial.</p>
                <div className="flex items-center gap-2 text-sm text-gray-500"><MapPin className="h-4 w-4" />Capacidad: 30 personas</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-900 border-gray-800 overflow-hidden group hover:border-gray-700 transition-all">
              <div className="h-48 bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-[60px]" />
                </div>
                <Target className="h-16 w-16 text-white/30 group-hover:text-white/50 transition-all" />
              </div>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-white mb-2">Cancha Auxiliar</h3>
                <p className="text-sm text-gray-400 mb-4">Cancha de entrenamiento ideal para prácticas tácticas y técnicas. Dimensiones 60x40m.</p>
                <div className="flex items-center gap-2 text-sm text-gray-500"><MapPin className="h-4 w-4" />Capacidad: 20 personas</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Categorías */}
      <section className="py-20 bg-gray-950">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-sm text-[#DC2626] font-semibold uppercase tracking-wider mb-2">Categorías</p>
            <h2 className="text-3xl font-bold text-white">Áreas del Club</h2>
            <p className="text-gray-400 mt-3 max-w-lg mx-auto">Tres tipos de socios para una comunidad unida</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { title: 'Cadete', desc: 'Jugadores de hockey en formación. Entrenamientos técnicos y tácticos.', color: 'from-blue-500 to-indigo-600', icon: Target, badge: 'Jugador' },
              { title: 'Activo', desc: 'Jugadores que además contribuyen económicamente y participan de la comisión.', color: 'from-[#DC2626] to-[#B91C1C]', icon: Star, badge: 'Jugador + Donante' },
              { title: 'Benefactor', desc: 'Padres/madres a cargo de los deportistas. Cuota unificada con el cadete.', color: 'from-violet-500 to-purple-600', icon: Users, badge: 'Padre/Madre' },
            ].map((c, i) => (
              <Card key={i} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-all group">
                <CardContent className="p-6">
                  <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${c.color} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-all`}>
                    <c.icon className="h-7 w-7" />
                  </div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-gray-800 text-gray-400 mb-3">
                    {c.badge}
                  </span>
                  <h3 className="text-lg font-bold text-white mb-2">{c.title}</h3>
                  <p className="text-sm text-gray-400">{c.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link href="/registro" className="inline-flex">
              <button className="bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold px-8 h-12 rounded-lg text-sm gap-2 flex items-center shadow-lg shadow-[#DC2626]/25 transition-all">
                Quiero Sumarme <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
