'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, MapPin, Calendar, ChevronRight, Target, Zap, Brain, Swords, Trophy, Dumbbell, Timer, TrendingUp } from 'lucide-react';
import Link from 'next/link';

const TIPOS_CONFIG: Record<string, { icon: any; color: string; bgLight: string; accent: string; gradient: string }> = {
  'Técnico': { icon: Target, color: '#DC2626', bgLight: 'bg-[#DC2626]/10', accent: '#DC2626', gradient: 'from-[#DC2626] to-[#B91C1C]' },
  'Físico': { icon: Dumbbell, color: '#3B82F6', bgLight: 'bg-blue-500/10', accent: '#3B82F6', gradient: 'from-blue-600 to-indigo-700' },
  'Táctico': { icon: Brain, color: '#8B5CF6', bgLight: 'bg-violet-500/10', accent: '#8B5CF6', gradient: 'from-violet-600 to-purple-700' },
  'Partido': { icon: Swords, color: '#F59E0B', bgLight: 'bg-amber-500/10', accent: '#F59E0B', gradient: 'from-amber-500 to-orange-600' },
  'Libre': { icon: Trophy, color: '#10B981', bgLight: 'bg-emerald-500/10', accent: '#10B981', gradient: 'from-emerald-600 to-teal-700' },
};

const SEMANA_COMPLETA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

interface Horario {
  id: string;
  dia: string;
  hora_inicio: string;
  hora_fin: string;
  tipo: string;
  descripcion: string | null;
  nivel: string;
  activo: boolean;
}

const FALLBACK_HORARIOS: Horario[] = [
  { id: '1', dia: 'Lunes', hora_inicio: '16:00', hora_fin: '18:00', tipo: 'Técnico', descripcion: 'Dribling, pases y recepción', nivel: 'Todos', activo: true },
  { id: '2', dia: 'Martes', hora_inicio: '16:00', hora_fin: '18:00', tipo: 'Físico', descripcion: 'Resistencia, velocidad y fuerza', nivel: 'Todos', activo: true },
  { id: '3', dia: 'Miércoles', hora_inicio: '16:00', hora_fin: '18:00', tipo: 'Táctico', descripcion: 'Estrategia y juego colectivo', nivel: 'Todos', activo: true },
  { id: '4', dia: 'Jueves', hora_inicio: '16:00', hora_fin: '18:00', tipo: 'Partido', descripcion: 'Práctica competitiva interna', nivel: 'Todos', activo: true },
  { id: '5', dia: 'Viernes', hora_inicio: '15:00', hora_fin: '17:00', tipo: 'Técnico', descripcion: 'Tiros libres y penales', nivel: 'Avanzados', activo: true },
  { id: '6', dia: 'Sábado', hora_inicio: '10:00', hora_fin: '12:00', tipo: 'Libre', descripcion: 'Juego libre y diversión', nivel: 'Todos', activo: true },
];

export default function EntrenamientosPage() {
  const [horarios, setHorarios] = useState<Horario[]>(FALLBACK_HORARIOS);
  const [hoy, setHoy] = useState('');

  useEffect(() => {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    setHoy(dias[new Date().getDay()]);

    // Fetch from Supabase
    fetch('/api/admin/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'horarios_entrenamiento',
        operation: 'select',
        columns: '*',
        filters: { activo: true },
        order: { column: 'orden', ascending: true },
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.data && d.data.length > 0) setHorarios(d.data);
      })
      .catch(() => {}); // keep fallback
  }, []);

  const totalHoras = horarios.reduce((acc, h) => {
    const [iniH, iniM] = h.hora_inicio.split(':').map(Number);
    const [finH, finM] = h.hora_fin.split(':').map(Number);
    return acc + ((finH + finM / 60) - (iniH + iniM / 60));
  }, 0);

  const tiposUnicos = [...new Set(horarios.map(h => h.tipo))];

  const getHorarioPorDia = (dia: string) => horarios.find(h => h.dia === dia);
  const getDuracion = (h: Horario) => {
    const [iniH, iniM] = h.hora_inicio.split(':').map(Number);
    const [finH, finM] = h.hora_fin.split(':').map(Number);
    return `${(finH + finM / 60) - (iniH + iniM / 60)}h`;
  };

  return (
    <div className="space-y-0">
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden bg-[#0A0A0A]">
        <div className="absolute inset-0">
          <img src="/splash.png" alt="Entrenamiento Fenix" className="w-full h-full object-cover object-top opacity-30" style={{ maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)' }} />
        </div>
        <div className="absolute right-0 bottom-0 w-[50%] h-[60%] bg-[#DC2626]/15 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/70 to-[#0A0A0A]/40" />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative z-10 container mx-auto px-4 py-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2 mb-6">
              <Calendar className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-blue-300 font-medium">Temporada 2026</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-white leading-[0.95] mb-6 tracking-tight">
              Entrena<span className="text-[#DC2626]">mientos</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-400 mb-8 max-w-lg leading-relaxed">
              6 días de entrenamiento por semana. Técnico, físico, táctico y competencia. Formamos jugadores completos.
            </p>
            <Link href="/registro">
              <button className="bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold px-8 h-12 rounded-lg text-sm gap-2 flex items-center shadow-lg shadow-[#DC2626]/25 transition-all">
                Sumate al Club <ChevronRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-gray-900 border-y border-gray-800">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-800">
            {[
              { value: `${horarios.length}`, label: 'Clases / Semana', icon: Calendar },
              { value: `${totalHoras.toFixed(0)}h`, label: 'Entrenamiento / Sem', icon: Timer },
              { value: `${tiposUnicos.length}`, label: 'Disciplinas', icon: Zap },
              { value: `${(totalHoras * 4).toFixed(0)}`, label: 'Horas / Mes', icon: TrendingUp },
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

      {/* Today's Training */}
      {hoy && getHorarioPorDia(hoy) && (() => {
        const h = getHorarioPorDia(hoy)!;
        const config = TIPOS_CONFIG[h.tipo] || TIPOS_CONFIG['Técnico'];
        const Icon = config.icon;
        return (
          <section className="py-12 bg-gray-950">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto">
                <div className="relative overflow-hidden rounded-2xl border border-[#DC2626]/30 bg-gradient-to-r from-[#DC2626]/10 via-gray-900 to-gray-900">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#DC2626] to-[#B91C1C]" />
                  <div className="p-6 md:p-8 flex items-center gap-6">
                    <div className="hidden md:flex h-20 w-20 rounded-2xl bg-[#DC2626] items-center justify-center shrink-0">
                      <span className="text-3xl font-black text-white">{hoy.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-2 w-2 rounded-full bg-[#DC2626] animate-pulse" />
                        <span className="text-xs text-[#DC2626] font-bold uppercase tracking-wider">Hoy</span>
                      </div>
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Icon className="h-5 w-5" style={{ color: config.accent }} /> {h.tipo}
                      </h3>
                      <p className="text-gray-400 text-sm mt-1">{h.descripcion} · {h.hora_inicio.slice(0, 5)} - {h.hora_fin.slice(0, 5)} hs</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-black text-white">{getDuracion(h)}</p>
                      <p className="text-xs text-gray-500">duración</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* Weekly Grid */}
      <section className="py-16 bg-gray-950">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-sm text-[#DC2626] font-semibold uppercase tracking-wider mb-2">Grilla Semanal</p>
              <h2 className="text-3xl font-bold text-white">Plan de Entrenamiento</h2>
              <p className="text-gray-400 mt-3">Cada sesión está diseñada para tu desarrollo integral</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
              {SEMANA_COMPLETA.map((dia) => {
                const h = getHorarioPorDia(dia);
                const isToday = dia === hoy;

                if (!h) {
                  return (
                    <div key={dia} className="relative rounded-2xl border border-gray-800/50 bg-gray-900/30 p-5 flex flex-col items-center justify-center min-h-[220px] opacity-50">
                      <div className="h-12 w-12 rounded-xl bg-gray-800/50 flex items-center justify-center mb-3">
                        <span className="text-2xl">😴</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-500">{dia}</p>
                      <p className="text-xs text-gray-600 mt-1">Descanso</p>
                    </div>
                  );
                }

                const config = TIPOS_CONFIG[h.tipo] || TIPOS_CONFIG['Técnico'];
                const Icon = config.icon;

                return (
                  <div
                    key={dia}
                    className={`relative rounded-2xl overflow-hidden min-h-[220px] flex flex-col group hover:scale-[1.02] transition-all duration-300 ${
                      isToday ? 'ring-2 ring-[#DC2626] shadow-lg shadow-[#DC2626]/20' : 'border border-gray-800'
                    }`}
                  >
                    <div className={`h-2 bg-gradient-to-r ${config.gradient}`} />

                    {isToday && (
                      <div className="absolute top-3 right-3 z-10">
                        <div className="flex items-center gap-1 bg-[#DC2626] rounded-full px-2 py-0.5">
                          <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                          <span className="text-[10px] text-white font-bold">HOY</span>
                        </div>
                      </div>
                    )}

                    <div className="flex-1 bg-gray-900 p-4 flex flex-col">
                      <div className={`h-11 w-11 rounded-xl ${config.bgLight} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                        <Icon className="h-5 w-5" style={{ color: config.accent }} />
                      </div>

                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{dia}</p>
                      <p className="text-sm font-bold text-white mb-1">{h.tipo}</p>
                      <p className="text-[11px] text-gray-400 mb-3 flex-1 line-clamp-2">{h.descripcion}</p>

                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-xs font-mono text-gray-300 bg-gray-800 px-2 py-1 rounded-lg">
                          {h.hora_inicio.slice(0, 5)} - {h.hora_fin.slice(0, 5)}
                        </span>
                        <span className="text-[9px] text-gray-600 uppercase tracking-wider">{h.nivel}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Training Types */}
      <section className="py-16 bg-gray-900/50">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-sm text-[#DC2626] font-semibold uppercase tracking-wider mb-2">Disciplinas</p>
              <h2 className="text-3xl font-bold text-white">¿Qué entrenamos?</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: 'Técnico', desc: 'Dribling, pases, recepción, tiros libres y penales. Habilidad individual con el stick.', icon: Target, color: '#DC2626', sessions: horarios.filter(h => h.tipo === 'Técnico').length },
                { title: 'Físico', desc: 'Resistencia, velocidad, agilidad y fuerza. Preparación atlética de primer nivel.', icon: Dumbbell, color: '#3B82F6', sessions: horarios.filter(h => h.tipo === 'Físico').length },
                { title: 'Táctico', desc: 'Estrategia de juego, sistemas, armado y desarmado. Juego colectivo.', icon: Brain, color: '#8B5CF6', sessions: horarios.filter(h => h.tipo === 'Táctico').length },
                { title: 'Competencia', desc: 'Partidos internos y amistosos. Aplicación de lo aprendido en situación real.', icon: Swords, color: '#F59E0B', sessions: horarios.filter(h => h.tipo === 'Partido').length },
              ].filter(t => t.sessions > 0).map((t, i) => (
                <Card key={i} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-all group">
                  <CardContent className="p-6">
                    <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-all" style={{ backgroundColor: `${t.color}15` }}>
                      <t.icon className="h-7 w-7" style={{ color: t.color }} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{t.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed mb-3">{t.desc}</p>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-8 rounded-full" style={{ backgroundColor: t.color }} />
                      <span className="text-xs text-gray-500">{t.sessions} {t.sessions === 1 ? 'sesión' : 'sesiones'} / semana</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="py-16 bg-gray-950">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-gray-900 border-gray-800 overflow-hidden">
                <div className="h-3 bg-gradient-to-r from-[#DC2626] to-[#B91C1C]" />
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-[#DC2626]/10 flex items-center justify-center shrink-0">
                      <MapPin className="h-6 w-6 text-[#DC2626]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg mb-1">Cancha Principal</h3>
                      <p className="text-sm text-gray-400">Av. Libertador 1234, CABA</p>
                      <p className="text-xs text-gray-500 mt-2">Césped sintético de última generación con iluminación artificial para entrenamientos nocturnos.</p>
                      <div className="flex gap-2 mt-4">
                        <span className="px-2.5 py-1 rounded-lg bg-gray-800 text-[10px] text-gray-400 uppercase tracking-wider">91x55m</span>
                        <span className="px-2.5 py-1 rounded-lg bg-gray-800 text-[10px] text-gray-400 uppercase tracking-wider">Iluminación</span>
                        <span className="px-2.5 py-1 rounded-lg bg-gray-800 text-[10px] text-gray-400 uppercase tracking-wider">Vestuarios</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-800 overflow-hidden">
                <div className="h-3 bg-gradient-to-r from-blue-600 to-indigo-700" />
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Clock className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg mb-1">Horarios</h3>
                      <div className="space-y-2 mt-3">
                        {SEMANA_COMPLETA.filter(d => getHorarioPorDia(d)).map(dia => {
                          const h = getHorarioPorDia(dia)!;
                          return (
                            <div key={dia}>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-400">{dia}</span>
                                <span className="text-sm text-white font-mono">{h.hora_inicio.slice(0, 5)} - {h.hora_fin.slice(0, 5)}</span>
                              </div>
                              <div className="h-px bg-gray-800 mt-2" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500 mb-2">¿Querés saber más sobre nuestros entrenamientos?</p>
              <Link href="/contacto" className="text-sm text-[#DC2626] hover:text-[#B91C1C] font-semibold transition-colors">
                Escribinos →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
