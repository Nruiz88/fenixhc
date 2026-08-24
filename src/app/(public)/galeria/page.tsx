'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ImageIcon, X, ChevronLeft, ChevronRight, Video, Calendar, User, Filter } from 'lucide-react';

interface Foto {
  id: string;
  url: string;
  descripcion: string | null;
  es_video: boolean;
  created_at: string;
  subido_por: string | null;
  subido_por_nombre?: string;
}

export default function GaleriaPage() {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [filtro, setFiltro] = useState('todas');

  useEffect(() => {
    fetch('/api/admin/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'fotos_galeria',
        operation: 'select',
        columns: '*',
        order: { column: 'created_at', ascending: false },
        limit: 50,
      }),
    })
      .then(r => r.json())
      .then(d => setFotos(d.data || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filtro === 'todas' ? fotos : fotos.filter(f => filtro === 'videos' ? f.es_video : !f.es_video);

  const placeholderFotos: Foto[] = [
    { id: 'p1', url: '/splash.png', descripcion: 'Entrenamiento en cancha principal', es_video: false, created_at: '2026-03-15', subido_por: null },
    { id: 'p2', url: '/splash.png', descripcion: 'Equipo completo temporada 2026', es_video: false, created_at: '2026-03-10', subido_por: null },
    { id: 'p3', url: '/splash.png', descripcion: 'Partido contra San Isidro - Fecha 5', es_video: false, created_at: '2026-04-20', subido_por: null },
    { id: 'p4', url: '/splash.png', descripcion: 'Celebración del equipo', es_video: false, created_at: '2026-05-01', subido_por: null },
    { id: 'p5', url: '/splash.png', descripcion: 'Entrenamiento técnico de juveniles', es_video: false, created_at: '2026-05-15', subido_por: null },
    { id: 'p6', url: '/splash.png', descripcion: 'Ceremonia de premiación', es_video: false, created_at: '2026-06-01', subido_por: null },
    { id: 'p7', url: '/splash.png', descripcion: 'Partido amistoso vs Alumni', es_video: false, created_at: '2026-06-20', subido_por: null },
    { id: 'p8', url: '/splash.png', descripcion: 'Asado del club', es_video: false, created_at: '2026-07-01', subido_por: null },
    { id: 'p9', url: '/splash.png', descripcion: 'Golazo de Lautaro', es_video: false, created_at: '2026-07-15', subido_por: null },
    { id: 'p10', url: '/splash.png', descripcion: 'Cancha auxiliar al atardecer', es_video: false, created_at: '2026-08-01', subido_por: null },
  ];

  const displayFotos = filtered.length > 0 ? filtered : placeholderFotos.filter(f => filtro === 'todas' || (filtro === 'videos' ? f.es_video : !f.es_video));
  const allDisplay = filtered.length > 0 ? filtered : placeholderFotos;

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
            <ImageIcon className="h-4 w-4 text-[#DC2626]" />
            <span className="text-sm text-gray-300 font-medium">{allDisplay.length} fotos</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white leading-[0.95] tracking-tight">
            Galería<span className="text-[#DC2626]">.</span>
          </h1>
          <p className="text-lg text-gray-400 mt-4 max-w-lg">Momentos capturados en entrenamientos, partidos y eventos del club.</p>
        </div>
      </section>

      {/* Filters */}
      <section className="py-8 bg-gray-950 border-b border-gray-800/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500 mr-2" />
            {[
              { value: 'todas', label: 'Todas' },
              { value: 'fotos', label: 'Fotos' },
              { value: 'videos', label: 'Videos' },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setFiltro(f.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  filtro === f.value ? 'bg-[#DC2626] text-white' : 'bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="py-12 bg-gray-950">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin h-8 w-8 border-2 border-[#DC2626] border-t-transparent rounded-full mx-auto" />
              <p className="text-gray-500 mt-4">Cargando galería...</p>
            </div>
          ) : displayFotos.length === 0 ? (
            <div className="text-center py-20">
              <ImageIcon className="h-16 w-16 text-gray-800 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No hay fotos disponibles</p>
              <p className="text-gray-600 text-sm mt-2">Las fotos subidas por los socios aparecerán aquí</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {displayFotos.map((f, i) => (
                <div
                  key={f.id}
                  className={`relative group rounded-2xl overflow-hidden bg-gray-800 cursor-pointer ${
                    i % 7 === 0 ? 'row-span-2 col-span-2 aspect-[4/3]' : 'aspect-square'
                  }`}
                  onClick={() => setLightbox(i)}
                >
                  {f.url ? (
                    <img src={f.url} alt={f.descripcion || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-700 flex items-center justify-center">
                      <span className="text-4xl opacity-30">🏑</span>
                    </div>
                  )}

                  {/* Video badge */}
                  {f.es_video && (
                    <div className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/60 flex items-center justify-center z-10">
                      <Video className="h-4 w-4 text-white" />
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Info */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                    {f.descripcion && <p className="text-sm font-medium text-white mb-1">{f.descripcion}</p>}
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(f.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Lightbox */}
      {lightbox !== null && displayFotos[lightbox] && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all z-10">
            <X className="h-5 w-5" />
          </button>

          {lightbox > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setLightbox(lightbox - 1); }} className="absolute left-4 h-12 w-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all z-10">
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          <div className="max-w-5xl max-h-[85vh] mx-4" onClick={e => e.stopPropagation()}>
            <img src={displayFotos[lightbox].url || '/splash.png'} alt={displayFotos[lightbox].descripcion || ''} className="max-h-[75vh] max-w-full object-contain rounded-lg mx-auto" />
            <div className="text-center mt-4">
              {displayFotos[lightbox].descripcion && <p className="text-white font-medium">{displayFotos[lightbox].descripcion}</p>}
              <p className="text-gray-400 text-sm mt-1">
                {new Date(displayFotos[lightbox].created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}{lightbox + 1} / {displayFotos.length}
              </p>
            </div>
          </div>

          {lightbox < displayFotos.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); setLightbox(lightbox + 1); }} className="absolute right-4 h-12 w-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all z-10">
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
