'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { money, percent } from '@/lib/format';
import { PageHeader, Panel, EmptyState, Hint } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Confirmar } from '@/components/admin/confirmar';
import { Plus, Trash2, Save, RotateCcw, Calculator, Lock } from 'lucide-react';

interface VencimientoForm {
  id?: string;
  dia: number;
  porcentaje: number;
  etiqueta: string;
  activo: boolean;
}

const NOMBRES_MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

export default function AdminConfiguracionCuotas() {
  const [montoBase, setMontoBase] = useState('');
  const [vencimientos, setVencimientos] = useState<VencimientoForm[]>([]);
  const [original, setOriginal] = useState<{ montoBase: string; vencimientos: VencimientoForm[] } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aRestablecer, setARestablecer] = useState(false);
  const [sinPermiso, setSinPermiso] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch('/api/admin/config-cuota');
      const json = await res.json();
      if (res.status === 403) {
        setSinPermiso(true);
        return;
      }
      if (!res.ok) throw new Error(json.error);

      const v = json.data.vencimientos.map((x: any) => ({
        id: x.id,
        dia: Number(x.dia),
        porcentaje: Number(x.porcentaje),
        etiqueta: x.etiqueta ?? `Vence el día ${x.dia}: +${Number(x.porcentaje)}%`,
        activo: !!x.activo,
      }));

      setMontoBase(String(json.data.montoBase));
      setVencimientos(v);
      setOriginal({ montoBase: String(json.data.montoBase), vencimientos: v });
    } catch (err: any) {
      toast.error('No se pudo cargar la configuración', { description: err.message });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  const montoNum = Number(montoBase);
  const montoValido = Number.isFinite(montoNum) && montoNum > 0;
  const diasUnicos = new Set(vencimientos.map((v) => v.dia)).size === vencimientos.length;
  const vencimientosValidos = vencimientos.every(
    (v) => v.dia >= 1 && v.dia <= 31 && v.porcentaje >= 0 && v.porcentaje <= 100
  );

  const hayCambios =
    !!original &&
    (montoBase !== original.montoBase ||
      JSON.stringify(vencimientos) !== JSON.stringify(original.vencimientos));

  /** Ejemplo en vivo: cuánto se le cobraría hoy a una cuota vencida en cada hito. */
  function ejemploTotal(dia: number, porcentaje: number): number {
    if (!montoValido) return 0;
    return Math.round(montoNum * (1 + porcentaje / 100) * 100) / 100;
  }

  async function guardar() {
    if (!montoValido) { toast.error('El monto tiene que ser un número mayor a cero'); return; }
    if (!diasUnicos) { toast.error('No puede haber dos vencimientos el mismo día'); return; }
    if (!vencimientosValidos) { toast.error('Revisá los días (1-31) y los porcentajes (0-100)'); return; }

    setGuardando(true);
    try {
      const res = await fetch('/api/admin/config-cuota', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montoBase: montoNum,
          vencimientos: vencimientos.map((v, i) => ({
            id: v.id,
            dia: v.dia,
            porcentaje: v.porcentaje,
            etiqueta: v.etiqueta || null,
            activo: v.activo,
            orden: i + 1,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      // Se recarga para traer los ids de los hitos nuevos: el backend los
      // genera, y sin ellos el próximo guardado los borraría por no coincidir.
      await cargar();
      toast.success('Configuración guardada', {
        description: 'El recargo se recalcula solo en las cuotas pendientes. Las ya cobradas no cambian.',
      });
    } catch (err: any) {
      toast.error('No se pudo guardar', { description: err.message });
    } finally {
      setGuardando(false);
    }
  }

  function restablecer() {
    if (!original) return;
    setMontoBase(original.montoBase);
    setVencimientos(original.vencimientos);
    setARestablecer(false);
    toast.success('Se restauraron los valores guardados. No se guardó nada todavía.');
  }

  function actualizar(i: number, cambio: Partial<VencimientoForm>) {
    setVencimientos((v) => v.map((x, j) => (j === i ? { ...x, ...cambio } : x)));
  }

  function agregar() {
    const usados = new Set(vencimientos.map((v) => v.dia));
    let dia = 10;
    while (usados.has(dia) && dia <= 31) dia++;
    if (dia > 31) { toast.error('No quedan días libres. Eliminá un vencimiento primero.'); return; }
    setVencimientos((v) => [...v, { dia, porcentaje: 0, etiqueta: '', activo: true }]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cuotas y vencimientos"
        description="El precio de la cuota y el recargo por atraso."
        actions={
          <Button onClick={guardar} disabled={guardando || !hayCambios || !montoValido}>
            <Save className="h-4 w-4" />
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        }
      />

      <Hint>
        El recargo se calcula al momento de cobrar, no queda guardado en la
        cuota. Si cambiás un porcentaje, las cuotas pendientes se recalculan
        solas y las ya cobradas no se tocan.
      </Hint>

      {cargando ? (
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-xl bg-surface" />
          <div className="h-64 animate-pulse rounded-xl bg-surface" />
        </div>
      ) : sinPermiso ? (
        <Panel>
          <EmptyState
            icon={<Lock className="h-6 w-6" />}
            title="No tenés permiso para cambiar esto"
            description="El precio de la cuota y los porcentajes de recargo los modifica la administración del club. Pedile que los ajuste."
          />
        </Panel>
      ) : (
        <>
          {/* Monto base */}
          <Panel title="Monto de la cuota" description="Lo que paga el socio antes de cualquier recargo">
            <div className="max-w-sm space-y-2">
              <Label htmlFor="monto">Valor mensual</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-dim">$</span>
                <Input
                  id="monto"
                  type="number"
                  inputMode="decimal"
                  step="100"
                  min="0"
                  value={montoBase}
                  onChange={(e) => setMontoBase(e.target.value)}
                  className="pl-7 text-lg font-semibold tabular"
                  aria-invalid={!montoValido && montoBase !== ''}
                />
              </div>
              {montoBase !== '' && !montoValido && (
                <p className="text-xs text-danger">El monto tiene que ser un número mayor a cero.</p>
              )}
              <p className="text-xs text-dim">
                Este valor es el que se precarga al registrar un pago. En cada
                cuota se puede escribir otro monto si hace falta.
              </p>
            </div>
          </Panel>

          {/* Vencimientos */}
          <Panel
            title="Recargo por atraso"
            description="Tramos que se aplican según el día del mes siguiente al de la cuota"
            actions={
              <>
                <Button variant="outline" size="sm" onClick={agregar} disabled={vencimientos.length >= 10}>
                  <Plus className="h-4 w-4" />Agregar tramo
                </Button>
                {hayCambios && (
                  <Button variant="ghost" size="sm" onClick={() => setARestablecer(true)}>
                    <RotateCcw className="h-4 w-4" />Deshacer
                  </Button>
                )}
              </>
            }
          >
            <p className="mb-4 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted">
              La cuota de <strong className="text-main">marzo</strong> se vence el 10 de{' '}
              <strong className="text-main">abril</strong>. Si no se paga ese día, arranca el
              primer tramo. El día se cuenta sobre el mes siguiente:{' '}
              {NOMBRES_MES.map((m, i) => (
                <span key={m}>
                  {i > 0 && ', '}
                  {m}
                </span>
              ))}. En meses cortos se usa el último día real, así que un
              vencimiento el día 30 cae el 28 de febrero.
            </p>

            {vencimientos.length === 0 ? (
              <p className="py-6 text-center text-sm text-dim">
                No hay tramos de recargo cargados. Sin ellos no se aplica ningún recargo.
              </p>
            ) : (
              <div className="space-y-3">
                {vencimientos
                  .slice()
                  .sort((a, b) => a.dia - b.dia)
                  .map((v) => {
                    const indiceReal = vencimientos.indexOf(v);
                    return (
                      <div
                        key={indiceReal}
                        className={`rounded-lg border p-3 transition-colors ${
                          v.activo ? 'border-line bg-surface-2' : 'border-line bg-surface opacity-60'
                        }`}
                      >
                        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[auto_1fr_auto]">
                          <div className="space-y-1.5">
                            <Label htmlFor={`dia-${indiceReal}`}>Día del mes</Label>
                            <Input
                              id={`dia-${indiceReal}`}
                              type="number"
                              min="1"
                              max="31"
                              value={v.dia}
                              onChange={(e) => actualizar(indiceReal, { dia: Number(e.target.value) })}
                              className="w-20 tabular"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor={`pct-${indiceReal}`}>Recargo</Label>
                            <div className="relative">
                              <Input
                                id={`pct-${indiceReal}`}
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={v.porcentaje}
                                onChange={(e) => actualizar(indiceReal, { porcentaje: Number(e.target.value) })}
                                className="w-28 pr-8 tabular"
                              />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-dim">%</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => actualizar(indiceReal, { activo: !v.activo })}
                              aria-label={v.activo ? 'Desactivar tramo' : 'Activar tramo'}
                              title={v.activo ? 'Desactivar' : 'Activar'}
                            >
                              {v.activo ? 'Activo' : 'Inactivo'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-dim hover:text-danger"
                              onClick={() => setVencimientos((arr) => arr.filter((_, j) => j !== indiceReal))}
                              aria-label="Eliminar tramo"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Simulación: lo que la contabilidad necesita ver para
                            decidir, sin tener que emitir una cuota de prueba. */}
                        {montoValido && v.activo && (
                          <p className="mt-2.5 flex items-center gap-1.5 border-t border-line pt-2.5 text-xs text-dim">
                            <Calculator className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              Cuota de {money(montoNum)} → a partir del día {v.dia} del mes
                              siguiente se cobrarán{' '}
                              <strong className="text-main">{money(ejemploTotal(v.dia, v.porcentaje))}</strong>{' '}
                              ({percent(v.porcentaje / 100, 0)} de recargo)
                            </span>
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {!diasUnicos && (
              <p className="mt-3 text-xs text-danger">
                Hay dos tramos con el mismo día. Sólo se aplicaría el último.
              </p>
            )}
          </Panel>

          <Confirmar
            abierto={aRestablecer}
            onCerrar={() => setARestablecer(false)}
            onConfirmar={restablecer}
            titulo="Descartar los cambios"
            descripcion="Se vuelven a los valores que están guardados ahora. Los cambios que hiciste en esta pantalla se pierden."
            textoConfirmar="Descartar"
          />
        </>
      )}
    </div>
  );
}
