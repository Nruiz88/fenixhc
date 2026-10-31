'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Panel, Hint, StatusPill, EmptyState, type StatusTone } from '@/components/admin/ui';
import { fechaHora, money } from '@/lib/format';
import {
  AlertTriangle, Check, Copy, CreditCard, ExternalLink, KeyRound,
  Loader2, Lock, Save, ShieldCheck, Trash2,
} from 'lucide-react';

// Configuración de cobros online.
//
// Solo el rol `admin` puede ver esta pantalla: el endpoint devuelve 403 para
// cualquier otro cargo, incluso para el presidente. Las credenciales permiten
// cobrar en nombre del club y ver toda su cuenta de MercadoPago.

interface CuotaEnPago {
  id: string;
  total: number;
  mes: number;
  anio: number;
}

interface PagoMP {
  id: string;
  preferencia_id: string | null;
  pago_id: string | null;
  monto: number;
  moneda: string;
  estado: string;
  estado_detalle: string | null;
  metodo_pago: string | null;
  cuotas: CuotaEnPago[];
  created_at: string;
}

interface ConfigMP {
  habilitado: boolean;
  accessTokenCargado: boolean;
  accessTokenFinal: string | null;
  publicKey: string;
  webhookSecretCargado: boolean;
  webhookUrl: string;
  entorno: 'test' | 'produccion' | null;
  errorCredenciales: boolean;
  pagos: PagoMP[];
}

function mensajeError(err: unknown): string {
  return err instanceof Error ? err.message : 'Error desconocido';
}

const TONO_PAGO: Record<string, { tone: StatusTone; label: string }> = {
  aprobado: { tone: 'ok', label: 'Aprobado' },
  pendiente: { tone: 'warn', label: 'Pendiente' },
  en_proceso: { tone: 'info', label: 'En proceso' },
  autorizado: { tone: 'info', label: 'Autorizado' },
  rechazado: { tone: 'danger', label: 'Rechazado' },
  cancelado: { tone: 'danger', label: 'Cancelado' },
  reembolsado: { tone: 'warn', label: 'Reembolsado' },
  contracargo: { tone: 'danger', label: 'Contracargo' },
  revision: { tone: 'warn', label: 'En revisión' },
  error: { tone: 'danger', label: 'Error' },
};

export default function AdminMercadoPago() {
  const [config, setConfig] = useState<ConfigMP | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [sinPermiso, setSinPermiso] = useState(false);

  const [habilitado, setHabilitado] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [quitarToken, setQuitarToken] = useState(false);
  const [quitarSecreto, setQuitarSecreto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  function aplicar(data: ConfigMP) {
    setConfig(data);
    setHabilitado(data.habilitado);
    setPublicKey(data.publicKey ?? '');
    setAccessToken('');
    setWebhookSecret('');
    setQuitarToken(false);
    setQuitarSecreto(false);
  }

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch('/api/admin/mercadopago', { cache: 'no-store' });
      const json = await res.json();
      if (res.status === 403) { setSinPermiso(true); return; }
      if (!res.ok) throw new Error(json.error);
      aplicar(json.data as ConfigMP);
    } catch (err) {
      toast.error('No se pudo cargar la configuración', { description: mensajeError(err) });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    let vigente = true;
    // La carga se dispara después del primer render: `cargar()` toca estado,
    // y hacerlo en el cuerpo del efecto provoca un render en cascada.
    (async () => {
      await Promise.resolve();
      if (vigente) await cargar();
    })();
    return () => { vigente = false; };
  }, []);

  async function guardar() {
    setGuardando(true);
    try {
      const body: Record<string, unknown> = { habilitado };

      if (accessToken.trim()) body.accessToken = accessToken.trim();
      else if (quitarToken) body.accessToken = null;

      if (publicKey !== (config?.publicKey ?? '')) body.publicKey = publicKey;

      if (webhookSecret.trim()) body.webhookSecret = webhookSecret.trim();
      else if (quitarSecreto) body.webhookSecret = null;

      const res = await fetch('/api/admin/mercadopago', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      aplicar(json.data as ConfigMP);
      toast.success('Configuración guardada', {
        description: habilitado
          ? 'El botón de pago online ya aparece en el portal de los socios.'
          : 'Los cobros online quedaron pausados. Las cuotas pendientes siguen visibles.',
      });
    } catch (err) {
      toast.error('No se pudo guardar', { description: mensajeError(err) });
    } finally {
      setGuardando(false);
    }
  }

  async function copiarWebhook() {
    if (!config?.webhookUrl) return;
    try {
      await navigator.clipboard.writeText(config.webhookUrl);
      setCopiado(true);
      toast.success('URL del webhook copiada');
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('No se pudo copiar. Copiala a mano del campo de abajo.');
    }
  }

  if (cargando) {
    return (
      <div className="space-y-4">
        <div className="h-56 animate-pulse rounded-xl bg-surface" />
        <div className="h-40 animate-pulse rounded-xl bg-surface" />
      </div>
    );
  }

  if (sinPermiso) {
    return (
      <Panel>
        <EmptyState
          icon={<Lock className="h-6 w-6" />}
          title="Solo el administrador puede configurar MercadoPago"
          description="Estas credenciales permiten cobrar en nombre del club. Si necesitás cambiar algo, pedile al administrador de la cuenta."
        />
      </Panel>
    );
  }

  if (!config) {
    return (
      <Panel>
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="No se pudo cargar la configuración"
          description="Revisá la conexión y volvé a intentar."
          action={<Button onClick={cargar}>Reintentar</Button>}
        />
      </Panel>
    );
  }

  const hayCambios =
    habilitado !== config.habilitado ||
    !!accessToken.trim() ||
    publicKey !== (config.publicKey ?? '') ||
    !!webhookSecret.trim() ||
    quitarToken ||
    quitarSecreto;

  return (
    <div className="space-y-6">
      {config.errorCredenciales && (
        <Hint tone="warn">
          Había credenciales guardadas que no se pudieron descifrar (por ejemplo,
          después de cambiar el JWT_SECRET). Volvé a ingresarlas: no se perdió
          ningún dato de las cuotas.
        </Hint>
      )}

      {!habilitado && (
        <Hint>
          El cobro online está pausado. Los socios siguen viendo sus cuotas y
          pueden subir el comprobante de una transferencia. El botón de
          MercadoPago aparece solo cuando habilitás los cobros.
        </Hint>
      )}

      <Panel
        title="Credenciales de MercadoPago"
        description="Se guardan cifradas en la base. El token completo nunca se muestra de nuevo."
        actions={
          config.entorno && (
            <StatusPill tone={config.entorno === 'test' ? 'warn' : 'ok'}>
              {config.entorno === 'test' ? 'Credenciales de prueba' : 'Producción'}
            </StatusPill>
          )
        }
      >
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="mp-token">Access Token *</Label>
            {config.accessTokenCargado && !quitarToken && (
              <p className="text-xs text-dim">
                Guardado: <span className="font-mono">••••••••{config.accessTokenFinal}</span>
                {' '}
                <button
                  type="button"
                  onClick={() => { setQuitarToken(true); setHabilitado(false); }}
                  className="inline-flex items-center gap-1 text-danger hover:underline"
                >
                  <Trash2 className="h-3 w-3" />Borrar
                </button>
              </p>
            )}
            {quitarToken && (
              <p className="flex items-center gap-2 text-xs text-warn">
                El token se va a borrar al guardar.
                <button type="button" onClick={() => setQuitarToken(false)} className="underline">
                  Deshacer
                </button>
              </p>
            )}
            <Input
              id="mp-token"
              type="password"
              autoComplete="off"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={config.accessTokenCargado ? 'Dejalo vacío para conservar el actual' : 'APP_USR-... o TEST-...'}
            />
            <p className="text-[11px] text-dim">
              MercadoPago Developers → tu aplicación → Credenciales. Con un token
              que empieza con <span className="font-mono">TEST-</span> se usa el
              checkout de prueba.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mp-public">Public Key</Label>
            <Input
              id="mp-public"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="APP_USR-... o TEST-..."
              autoComplete="off"
            />
            <p className="text-[11px] text-dim">
              Opcional por ahora: el cobro usa Checkout Pro con redirección y no
              la necesita. Se guarda para cuando se agregue el checkout embebido.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mp-secret">Secreto del webhook</Label>
            {config.webhookSecretCargado && !quitarSecreto && (
              <p className="text-xs text-dim">
                Configurado.{' '}
                <button
                  type="button"
                  onClick={() => setQuitarSecreto(true)}
                  className="inline-flex items-center gap-1 text-danger hover:underline"
                >
                  <Trash2 className="h-3 w-3" />Borrar
                </button>
              </p>
            )}
            {quitarSecreto && (
              <p className="flex items-center gap-2 text-xs text-warn">
                El secreto se va a borrar al guardar.
                <button type="button" onClick={() => setQuitarSecreto(false)} className="underline">
                  Deshacer
                </button>
              </p>
            )}
            <Input
              id="mp-secret"
              type="password"
              autoComplete="off"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={config.webhookSecretCargado ? 'Dejalo vacío para conservar el actual' : 'El secreto que muestra MercadoPago en Webhooks'}
            />
            <p className="text-[11px] text-dim">
              Recomendado. Sin secreto, el webhook igual se valida consultando el
              pago a la API, pero con secreto se descarta antes cualquier POST falso.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-main">Cobros online habilitados</p>
              <p className="text-xs text-dim">
                Muestra el botón de pago con MercadoPago en “Mis cuotas”.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={habilitado}
              aria-label="Habilitar cobros online con MercadoPago"
              onClick={() => setHabilitado((v) => !v)}
              className={
                habilitado
                  ? 'relative h-7 w-12 shrink-0 rounded-full bg-ok/80 transition-colors'
                  : 'relative h-7 w-12 shrink-0 rounded-full bg-surface-3 transition-colors'
              }
            >
              <span
                className={
                  habilitado
                    ? 'absolute right-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform'
                    : 'absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform'
                }
              />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <Button onClick={guardar} disabled={guardando || !hayCambios}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            {!hayCambios && (
              <span className="text-xs text-dim">No hiciste ningún cambio todavía.</span>
            )}
          </div>
        </div>
      </Panel>

      <Panel
        title="URL de notificaciones (webhook)"
        description="Pegala en MercadoPago Developers → tu aplicación → Webhooks."
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-main">
            {config.webhookUrl}
          </code>
          <Button variant="outline" onClick={copiarWebhook}>
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiado ? 'Copiada' : 'Copiar'}
          </Button>
        </div>
        <div className="mt-4 grid gap-3 text-xs text-muted sm:grid-cols-3">
          <p className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
            En Webhooks elegí el evento <strong className="text-main">Pagos</strong>.
          </p>
          <p className="flex items-start gap-2">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            Copiá también el secreto de firma y pegalo arriba.
          </p>
          <p className="flex items-start gap-2">
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            Con credenciales de prueba, las tarjetas de prueba de MercadoPago no
            mueven dinero real.
          </p>
        </div>
        <Hint>
          Para que MercadoPago pueda llamar a esta URL, la app tiene que estar
          publicada y <span className="font-mono">APP_URL</span> tiene que ser la
          dirección pública (https). Un webhook a localhost nunca llega.
        </Hint>
      </Panel>

      <Panel
        title="Últimos cobros online"
        description="Los pagos aprobados marcan la cuota como pagada. Lo que quedó en revisión necesita que la tesorería lo mire."
        bodyClassName="p-0"
      >
        {config.pagos.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="h-6 w-6" />}
            title="Todavía no hay cobros online"
            description="Cuando un socio pague una cuota con MercadoPago, el intento va a aparecer acá."
          />
        ) : (
          <ul className="divide-y divide-line">
            {config.pagos.map((p) => {
              const tono = TONO_PAGO[p.estado] ?? { tone: 'neutral' as StatusTone, label: p.estado };
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-main">{money(p.monto)}</p>
                      <StatusPill tone={tono.tone}>{tono.label}</StatusPill>
                      {p.cuotas.length > 0 && (
                        <span className="text-[11px] text-dim">
                          {p.cuotas.length} {p.cuotas.length === 1 ? 'cuota' : 'cuotas'}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-dim">
                      {fechaHora(p.created_at)}
                      {p.pago_id ? ` · pago ${p.pago_id}` : ''}
                      {p.estado_detalle ? ` · ${p.estado_detalle}` : ''}
                    </p>
                  </div>
                  {p.pago_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      render={
                        <a
                          href="https://www.mercadopago.com.ar/activities"
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                    >
                      <ExternalLink className="h-4 w-4" />Ver en MercadoPago
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
