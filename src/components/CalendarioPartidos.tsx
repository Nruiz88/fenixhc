'use client';
import { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight, Trophy } from 'lucide-react';

interface Partido {
  id: string;
  fecha: string;
  hora: string | null;
  rival: string;
  cancha: string;
  es_local: boolean;
  competencia: string;
  jornada: string | null;
  estado: string;
  goles_nuestros: number | null;
  goles_rival: number | null;
  resultado: string | null;
}

export function CalendarioPartidos() {
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/admin/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'partidos', operation: 'select', columns: '*',
        filters: {},
        order: { column: 'fecha', ascending: true },
      }),
    }).then(r => r.json()).then(d => {
      setPartidos(d.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = dir === 'left' ? -320 : 320;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const formatDate = (fecha: string) => {
    const d = new Date(fecha + 'T12:00:00');
    return {
      day: d.toLocaleDateString('es-AR', { day: 'numeric' }),
      month: d.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase(),
      weekday: d.toLocaleDateString('es-AR', { weekday: 'short' }).toUpperCase(),
    };
  };

  const estadoConfig: Record<string, { label: string; color: string; dot: string }> = {
    programado: { label: 'Próximo', color: 'bg-blue-500', dot: 'bg-blue-400' },
    en_juego: { label: 'EN VIVO', color: 'bg-[#DC2626]', dot: 'bg-emerald-400 animate-pulse' },
    finalizado: { label: 'Finalizado', color: 'bg-gray-500', dot: 'bg-gray-400' },
    suspendido: { label: 'Suspendido', color: 'bg-amber-500', dot: 'bg-amber-400' },
    cancelado: { label: 'Cancelado', color: 'bg-red-500', dot: 'bg-red-400' },
  };

  const resultadoConfig: Record<string, { label: string; color: string }> = {
    ganado: { label: 'Victoria', color: 'text-[#DC2626]' },
    empatado: { label: 'Empate', color: 'text-amber-400' },
    perdido: { label: 'Derrota', color: 'text-red-400' },
  };

  if (loading) return null;
  if (partidos.length === 0) return null;

  // Split: completed matches and upcoming
  const proximos = partidos.filter(p => p.estado === 'programado' || p.estado === 'en_juego');
  const jugados = partidos.filter(p => p.estado === 'finalizado');
  const display = [...proximos, ...jugados].slice(0, 10);

  return (
    <section className="py-20 bg-gray-950">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm text-[#DC2626] font-semibold uppercase tracking-wider mb-2">Competencia</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">Calendario de Partidos</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={() => scroll('left')} className="h-10 w-10 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-all">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={() => scroll('right')} className="h-10 w-10 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-all">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Timeline */}
        <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {display.map((p: Partido) => {
            const date = formatDate(p.fecha);
            const estado = estadoConfig[p.estado] || estadoConfig.programado;
            const resultado = p.resultado ? resultadoConfig[p.resultado] : null;

            return (
              <div key={p.id} className="flex-shrink-0 w-72 snap-start">
                <div className={`relative rounded-2xl overflow-hidden border transition-all hover:scale-[1.02] ${
                  p.estado === 'en_juego' ? 'border-[#DC2626]/50 shadow-lg shadow-[#DC2626]/10' : 'border-gray-800 hover:border-gray-700'
                } bg-gray-900`}>
                  {/* Status Bar */}
                  <div className={`px-4 py-1.5 flex items-center justify-between ${estado.color}`}>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${estado.dot}`} />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">{estado.label}</span>
                    </div>
                    <span className="text-[10px] text-white/70 font-medium">{p.competencia}</span>
                  </div>

                  <div className="p-5">
                    {/* Date & Time */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-3xl font-extrabold text-white leading-none">{date.day}</p>
                        <p className="text-xs text-gray-400 font-medium mt-0.5">{date.month}</p>
                      </div>
                      <div className="flex-1 border-l border-gray-800 pl-4">
                        <p className="text-xs text-gray-500">{date.weekday}</p>
                        {p.hora && <p className="text-sm font-semibold text-white flex items-center gap-1"><Clock className="h-3 w-3 text-gray-400" />{p.hora.slice(0, 5)}hs</p>}
                      </div>
                    </div>

                    {/* Match Info */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">{p.es_local ? 'NOSOTROS' : p.rival}</p>
                        <p className="text-xl font-bold text-white">{p.es_local ? 'Fenix Roller' : p.rival}</p>
                        <p className="text-xs text-gray-500 mt-1">vs {p.es_local ? p.rival : 'Fenix Roller'}</p>
                      </div>
                      <div className="text-right">
                        {p.goles_nuestros !== null && p.goles_rival !== null && (
                          <div className="mb-1">
                            <span className={`text-3xl font-extrabold ${resultado?.color || 'text-gray-400'}`}>
                              {p.goles_nuestros} - {p.goles_rival}
                            </span>
                          </div>
                        )}
                        {resultado && (
                          <span className={`text-xs font-bold uppercase tracking-wider ${resultado.color}`}>{resultado.label}</span>
                        )}
                      </div>
                    </div>

                    {/* Venue */}
                    <div className="mt-4 pt-3 border-t border-gray-800 flex items-center gap-2 text-xs text-gray-500">
                      <MapPin className="h-3 w-3" />
                      <span>{p.cancha}</span>
                      <span className="text-gray-700">•</span>
                      <span>{p.jornada || p.competencia}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
