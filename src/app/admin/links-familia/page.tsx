'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/adminQuery';
import { toast } from 'sonner';
import { iniciales } from '@/lib/format';
import { PageHeader, StatCard, Panel, EmptyState, StatusPill, Hint } from '@/components/admin/ui';
import { Confirmar } from '@/components/admin/confirmar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link2, Trash2, ArrowRight, Users, UserCheck, CheckCircle2 } from 'lucide-react';

// Ojo con la nomenclatura: `padre_perfil_id` y `deportista_perfil_id` son los
// nombres de las columnas y describen el vínculo familiar, pero el ROL del
// usuario es socio_benefactor / socio_cadete.

const VINCULOS = [
  { value: 'padre', label: 'Padre' },
  { value: 'madre', label: 'Madre' },
  { value: 'tutor', label: 'Tutor' },
];

const ETIQUETA_VINCULO: Record<string, string> = {
  padre: 'Padre', madre: 'Madre', tutor: 'Tutor',
};

// Centinela para "nada seleccionado": base-ui no dispara onValueChange con
// string vacío, así que la opción quedaría sin poder elegirse.
const SIN_SEL = '__sin_seleccion__';

export default function AdminLinksFamilia() {
  const [benefactores, setBenefactores] = useState<any[]>([]);
  const [cadetes, setCadetes] = useState<any[]>([]);
  const [familias, setFamilias] = useState<any[]>([]);
  const [form, setForm] = useState({ padre_id: '', deportista_id: '', tipo_vinculo: 'padre' });
  const [guardando, setGuardando] = useState(false);
  const [aDesvincular, setADesvincular] = useState<any | null>(null);

  async function cargar() {
    const [{ data: p }, { data: d }, { data: f }] = await Promise.all([
      db.select<any>('perfiles', 'id, nombre, apellido, dni, correo', { rol: 'socio_benefactor' }, { limit: 1000 }),
      db.view<any>('admin_deportistas_ligeros'),
      db.view<any>('admin_familias'),
    ]);
    setBenefactores(p ?? []);
    setCadetes(d ?? []);
    setFamilias(f ?? []);
  }

  useEffect(() => { cargar(); }, []);

  const { benefactoresLibres, cadetesLibres } = useMemo(() => {
    const vinculosBenefactor = new Set(familias.map((f) => f.padre_perfil_id));
    const vinculosCadete = new Set(familias.map((f) => f.deportista_perfil_id));
    return {
      benefactoresLibres: benefactores.filter((p) => !vinculosBenefactor.has(p.id)),
      cadetesLibres: cadetes.filter((d) => !vinculosCadete.has(d.perfil_id)),
    };
  }, [familias, benefactores, cadetes]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.padre_id || !form.deportista_id) {
      toast.error('Elegí un socio y un jugador');
      return;
    }

    setGuardando(true);
    const { error } = await db.insert('familias', {
      padre_perfil_id: form.padre_id,
      deportista_perfil_id: form.deportista_id,
      tipo_vinculo: form.tipo_vinculo,
    });
    setGuardando(false);

    if (error) { toast.error(error); return; }

    const socio = benefactores.find((p) => p.id === form.padre_id);
    const jugador = cadetes.find((d) => d.perfil_id === form.deportista_id);
    toast.success(`${socio?.nombre} quedó vinculado con ${jugador?.perfiles?.nombre}`, {
      description: 'Ahora las cuotas que emitás para esta familia se le asignan a este socio.',
    });
    setForm({ padre_id: '', deportista_id: '', tipo_vinculo: 'padre' });
    await cargar();
  }

  async function desvincular() {
    if (!aDesvincular) return;
    const nombreSocio = `${aDesvincular.padre?.nombre ?? ''} ${aDesvincular.padre?.apellido ?? ''}`.trim();
    const nombreCadete = `${aDesvincular.hijo?.nombre ?? ''} ${aDesvincular.hijo?.apellido ?? ''}`.trim();

    const { error } = await db.delete('familias', { id: aDesvincular.id });
    if (error) { toast.error(error); return; }

    // Las cuotas cuelgan de la familia con ON DELETE CASCADE, así que al
    // desvincular se borran también las pendientes de esa familia. Avisarlo
    // es obligatorio: alguien puede desvincular por error y perder meses de
    // historial de cobranza sin darse cuenta.
    toast.success('Vínculo eliminado', {
      description: `Se desvincularon ${nombreSocio} y ${nombreCadete}. Revisá las cuotas de esa familia: las pendientes se borraron.`,
    });
    setADesvincular(null);
    await cargar();
  }

  const nadaParaVincular = benefactoresLibres.length === 0 && cadetesLibres.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vínculos familiares"
        description="Asociá un socio benefactor con el jugador que responde por sus cuotas."
      />

      <Hint>
        El vínculo define a quién se le cobra y a qué jugador se le imputa la
        cuota. Sin vínculo, la familia no aparece en la cobranza.
      </Hint>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Vínculos activos" value={familias.length} tone="brand" icon={<Link2 className="h-4 w-4" />} />
        <StatCard
          label="Socios sin vincular"
          value={benefactoresLibres.length}
          hint="No responden por ningún jugador"
          tone={benefactoresLibres.length > 0 ? 'warn' : 'ok'}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Jugadores sin vincular"
          value={cadetesLibres.length}
          hint="Sin socio responsable"
          tone={cadetesLibres.length > 0 ? 'warn' : 'ok'}
          icon={<UserCheck className="h-4 w-4" />}
        />
      </div>

      {/* Alta */}
      <Panel title="Nueva vinculación" description="Elegí el socio y el jugador que se asocian">
        {nadaParaVincular ? (
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6" />}
            title="Todo está vinculado"
            description="No quedan socios ni jugadores sin vincular. Si falta alguno, crealo desde la pantalla de Usuarios."
          />
        ) : (
          <form onSubmit={crear} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="socio">Socio benefactor *</Label>
              <Select
                value={form.padre_id || SIN_SEL}
                onValueChange={(v) => setForm({ ...form, padre_id: v === SIN_SEL ? '' : (v ?? '') })}
              >
                <SelectTrigger id="socio"><SelectValue placeholder="Elegí un socio" /></SelectTrigger>
                <SelectContent>
                  {benefactoresLibres.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre} {p.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cadete">Jugador *</Label>
              <Select
                value={form.deportista_id || SIN_SEL}
                onValueChange={(v) => setForm({ ...form, deportista_id: v === SIN_SEL ? '' : (v ?? '') })}
              >
                <SelectTrigger id="cadete"><SelectValue placeholder="Elegí un jugador" /></SelectTrigger>
                <SelectContent>
                  {cadetesLibres.map((d) => (
                    <SelectItem key={d.id} value={d.perfil_id}>
                      {d.perfiles?.nombre} {d.perfiles?.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vinculo">Tipo de vínculo</Label>
              <Select
                value={form.tipo_vinculo}
                onValueChange={(v) => v && setForm({ ...form, tipo_vinculo: v })}
              >
                <SelectTrigger id="vinculo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VINCULOS.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-3">
              <Button type="submit" disabled={guardando}>
                <Link2 className="h-4 w-4" />
                {guardando ? 'Vinculando…' : 'Vincular'}
              </Button>
            </div>
          </form>
        )}
      </Panel>

      {/* Listado */}
      <Panel
        title="Vínculos activos"
        description={`${familias.length} ${familias.length === 1 ? 'vínculo' : 'vínculos'}`}
        bodyClassName="p-0"
      >
        {familias.length === 0 ? (
          <EmptyState
            icon={<Link2 className="h-6 w-6" />}
            title="Todavía no hay vínculos"
            description="Usá el formulario de arriba para asociar el primer socio con su jugador."
          />
        ) : (
          <ul className="divide-y divide-line">
            {familias.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                {/* flex-wrap: los dos bloques de persona y la flecha no
                    entraban en una línea angosta y se cortaban a la mitad. */}
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                  <div className="flex min-w-0 flex-1 basis-40 items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-bold text-brand">
                      {iniciales(f.padre?.nombre, f.padre?.apellido)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-main">
                        {f.padre?.nombre} {f.padre?.apellido}
                      </p>
                      <p className="truncate text-xs text-dim" title={f.padre?.correo}>{f.padre?.correo}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 text-dim">
                    <ArrowRight className="h-4 w-4" />
                    <span className="text-[10px]">{ETIQUETA_VINCULO[f.tipo_vinculo] ?? f.tipo_vinculo}</span>
                  </div>

                  <div className="flex min-w-0 flex-1 basis-40 items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-info/15 text-[11px] font-bold text-info">
                      {iniciales(f.hijo?.nombre, f.hijo?.apellido)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-main">
                        {f.hijo?.nombre} {f.hijo?.apellido}
                      </p>
                      <p className="truncate text-xs text-dim" title={f.hijo?.correo}>{f.hijo?.correo}</p>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill tone="ok">Vigente</StatusPill>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-dim hover:text-danger"
                    onClick={() => setADesvincular(f)}
                    aria-label={`Desvincular a ${f.padre?.nombre}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Confirmar
        abierto={!!aDesvincular}
        onCerrar={() => setADesvincular(null)}
        onConfirmar={desvincular}
        titulo="Desvincular la familia"
        descripcion={`${aDesvincular?.padre?.nombre} ${aDesvincular?.padre?.apellido} va a quedar desvinculado de ${aDesvincular?.hijo?.nombre} ${aDesvincular?.hijo?.apellido}. ATENCIÓN: las cuotas pendientes de esta familia se borran junto con el vínculo.`}
        textoConfirmar="Desvincular"
      />
    </div>
  );
}
