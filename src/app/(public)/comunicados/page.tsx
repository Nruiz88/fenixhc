'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Megaphone, Clock, ArrowRight, Calendar, ChevronRight, Filter } from 'lucide-react';
import Link from 'next/link';

const TIPOS: Record<string, { label: string; color: string; bg: string }> = {
  general: { label: 'General', color: 'text-[#DC2626]', bg: 'bg-[#DC2626]' },
  deportivo: { label: 'Deportivo', color: 'text-blue-400', bg: 'bg-blue-600' },
  pago: { label: 'Pago', color: 'text-amber-400', bg: 'bg-amber-600' },
  urgente: { label: 'Urgente', color: 'text-red-400', bg: 'bg-red-600' },
  evento: { label: 'Evento', color: 'text-violet-400', bg: 'bg-violet-600' },
};

interface Comunicado {
  id: string;
  titulo: string;
  resumen: string;
  contenido: string;
  tipo: string;
  imagen_url: string | null;
  destacado: boolean;
  fecha_publicacion: string;
  created_at: string;
}

export default function ComunicadosPage() {
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'comunicados',
        operation: 'select',
        columns: '*',
        filters: { estado: 'publicado' },
        order: { column: 'fecha_publicacion', ascending: false },
      }),
    })
      .then(r => r.json())
      .then(d => setComunicados(d.data || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filtro === 'todos' ? comunicados : comunicados.filter(c => c.tipo === filtro);
  const destacados = filtered.filter(c => c.destacado);
  const normales = filtered.filter(c => !c.destacado);

  return (
    <div className="space-y-0">
      {/* Hero */}
      <section className="relative min-h-[50vh] flex items-center overflow-hidden bg-[#0A0A0A]">
        <div className="absolute inset-0">
          <img src="/splash.png" alt="" className="w-full h-full object-cover object-top opacity-15" style={{ maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)' }} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/80 to-[#0A0A0A]/50" />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative z-10 container mx-auto px-4 py-20">
          <div className="inline-flex items-center gap-2 bg-[#DC2626]/10 border border-[#DC2626]/20 rounded-full px-4 py-2 mb-6">
            <Megaphone className="h-4 w-4 text-[#DC2626]" />
            <span className="text-sm text-gray-300 font-medium">Novedades del club</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white leading-[0.95] tracking-tight">
            Comunicados<span className="text-[#DC2626]">.</span>
          </h1>
          <p className="text-lg text-gray-400 mt-4 max-w-lg">Mantenete al día con las últimas noticias, eventos y comunicaciones del club.</p>
        </div>
      </section>

      {/* Filters */}
      <section className="py-8 bg-gray-950 border-b border-gray-800/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-gray-500 mr-2" />
            {[{ value: 'todos', label: 'Todos' }, ...Object.entries(TIPOS).map(([v, t]) => ({ value: v, label: t.label }))].map(f => (
              <button
                key={f.value}
                onClick={() => setFiltro(f.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  filtro === f.value
                    ? 'bg-[#DC2626] text-white'
                    : 'bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 bg-gray-950">
        <div className="container mx-auto px-4 max-w-4xl">
          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin h-8 w-8 border-2 border-[#DC2626] border-t-transparent rounded-full mx-auto" />
              <p className="text-gray-500 mt-4">Cargando comunicados...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Megaphone className="h-16 w-16 text-gray-800 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No hay comunicados{filtro !== 'todos' ? ` de tipo "${filtro}"` : ''}</p>
              <p className="text-gray-600 text-sm mt-2">Volvé a consultar pronto</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Destacados */}
              {destacados.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-sm text-[#DC2626] font-semibold uppercase tracking-wider flex items-center gap-2">
                    <span className="h-1 w-4 bg-[#DC2626] rounded-full" />
                    Destacados
                  </h2>
                  {destacados.map(c => (
                    <ComunicadoCard key={c.id} c={c} expanded={expanded === c.id} onToggle={() => setExpanded(expanded === c.id ? null : c.id)} featured />
                  ))}
                </div>
              )}

              {/* Normales */}
              {normales.length > 0 && (
                <div className="space-y-4">
                  {destacados.length > 0 && <h2 className="text-sm text-gray-500 font-semibold uppercase tracking-wider flex items-center gap-2 mt-8"><span className="h-1 w-4 bg-gray-600 rounded-full" />Otros Comunicados</h2>}
                  {normales.map(c => (
                    <ComunicadoCard key={c.id} c={c} expanded={expanded === c.id} onToggle={() => setExpanded(expanded === c.id ? null : c.id)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ComunicadoCard({ c, expanded, onToggle, featured = false }: { c: Comunicado; expanded: boolean; onToggle: () => void; featured?: boolean }) {
  const tipo = TIPOS[c.tipo] || TIPOS.general;

  return (
    <Card className={`bg-gray-900 border-gray-800 hover:border-gray-700 transition-all overflow-hidden ${featured ? 'border-l-2 border-l-[#DC2626]' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${tipo.bg} text-white`}>
            {tipo.label}
          </span>
          {featured && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[#DC2626]/20 text-[#DC2626]">
              ★ Destacado
            </span>
          )}
          <span className="text-xs text-gray-500 flex items-center gap-1 ml-auto">
            <Clock className="h-3 w-3" />
            {new Date(c.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        <h3 className="font-bold text-white text-xl mb-2">{c.titulo}</h3>
        {c.resumen && <p className="text-gray-400 text-sm mb-3">{c.resumen}</p>}

        {expanded && (
          <div className="mt-4 p-4 bg-gray-800/50 rounded-xl">
            {c.contenido.split('\n').map((p, i) => (
              <p key={i} className="text-sm text-gray-300 leading-relaxed mb-2">{p}</p>
            ))}
          </div>
        )}

        <button onClick={onToggle} className="mt-3 text-sm text-[#DC2626] hover:text-[#B91C1C] font-semibold flex items-center gap-1 transition-colors">
          {expanded ? 'Leer menos' : 'Leer más'} <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      </CardContent>
    </Card>
  );
}
