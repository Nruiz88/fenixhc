'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Panel, Hint } from '@/components/admin/ui';
import { ShieldQuestion, Loader2 } from 'lucide-react';

// El jugador decide por sí mismo.
//
// El sistema ya le da cuenta propia, así que un pibe de 12 años puede entrar
// y decir que no a que le guarden la foto del DNI sin tener que convencer a su
// madre. Y si dice que no, la puerta se cierra para todos: el padre tampoco
// puede guardar la documentación.
//
// El texto dice explícitamente que la familia va a verlo. Si no lo dijera,
// habría un adulto descubriendo por surprise que su hijo no autorizó algo, y
// el TRUST del sistema se cae en un comentario. Tiene que saberlo de antemano.

const TEMAS = [
  {
    id: 'documentacion_dni',
    titulo: 'Guardar la foto de mi documento',
    texto: 'El club la usa solo para verificar tu identidad como jugador.',
  },
  {
    id: 'imagenes',
    titulo: 'Publicar mis fotos en la galería y redes',
    texto: 'Imágenes de partidos y de las actividades del club.',
  },
  {
    id: 'datos_deportivos',
    titulo: 'Anotar mis datos deportivos',
    texto: 'Categoría, posición, partidos y observaciones de la ficha técnica.',
  },
] as const;

type Tema = (typeof TEMAS)[number]['id'];

export function OpinionDelMenor() {
  const [opiniones, setOpiniones] = useState<Partial<Record<Tema, string>>>({});
  const [guardando, setGuardando] = useState<Tema | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/user/opinion-menor');
        if (res.ok) {
          const json = await res.json();
          setOpiniones(json.data?.opiniones ?? {});
        }
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  async function opinar(tema: Tema, opinion: string) {
    setGuardando(tema);
    try {
      const res = await fetch('/api/user/opinion-menor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalidad: tema, opinion }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'No pudimos registrarlo'); return; }

      setOpiniones((prev) => ({ ...prev, [tema]: opinion }));
      toast.success('Registrado', { description: json.mensaje, duration: 8000 });
    } catch {
      toast.error('No pudimos registrar tu opinión');
    } finally {
      setGuardando(null);
    }
  }

  return (
    <Panel
      title="Qué autoriza el club sobre tus datos"
      description="Esto lo decidís vos"
      actions={<ShieldQuestion className="h-4 w-4 text-dim" />}
    >
      <Hint>
        Si en algo no estás de acuerdo, el club{' '}
        <strong>no lo va a hacer</strong>, aunque tu madre o tu padre lo
        autoricen. Lo que digas queda registrado y tu familia lo va a ver.
      </Hint>

      <div className="mt-4 space-y-3">
        {TEMAS.map((t) => {
          const actual = opiniones[t.id];
          return (
            <div key={t.id} className="rounded-lg border border-line bg-surface-2 p-3">
              <p className="text-sm font-medium text-main">{t.titulo}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-dim">{t.texto}</p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  ['a_favor', 'Sí, autorizo'],
                  ['en_contra', 'No autorizo'],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    disabled={cargando || guardando === t.id}
                    onClick={() => opinar(t.id, v)}
                    className={
                      actual === v
                        ? v === 'en_contra'
                          ? 'rounded border border-danger/60 bg-danger/10 px-2.5 py-1 text-[11px] font-medium text-danger'
                          : 'rounded border border-ok/50 bg-ok/10 px-2.5 py-1 text-[11px] font-medium text-ok'
                        : 'rounded border border-line px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-line-strong disabled:opacity-40'
                    }
                  >
                    {guardando === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : label}
                  </button>
                ))}
              </div>

              {actual === 'en_contra' && (
                <p className="mt-2 text-[11px] text-danger">
                  Dijiste que no. El club no va a guardar esto hasta que cambies
                  de opinión.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
