export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireModulo } from '@/lib/auth';
import { query } from '@/lib/db';
import { money, percent, fecha } from '@/lib/format';
import { PageHeader, StatCard, Panel, EmptyState, StatusPill } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { BarrasComposicion } from '@/components/admin/charts';
import {
  Users, UserCheck, Wallet, TrendingUp, TrendingDown, Calendar,
  AlertCircle, ArrowRight, Clock, CheckCircle2,
} from 'lucide-react';

const n = (v: unknown): number => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

export default async function AdminDashboard() {
  const auth = await requireModulo('dashboard');
  if ('error' in auth) redirect('/');

  const mesActual = new Date().getMonth() + 1;
  const anioActual = new Date().getFullYear();

  const [sociosRows, jugadoresRows, cuotasMes, caja, reservas, notifs, proximos, categorias] =
    await Promise.all([
      query<{ c: number }>("SELECT COUNT(*) AS c FROM perfiles WHERE rol = 'socio_benefactor'"),
      query<{ c: number }>('SELECT COUNT(*) AS c FROM deportistas'),
      query<any>(
        `SELECT COUNT(*) AS emitidas,
                COALESCE(SUM(monto), 0) AS montoEmitido,
                COALESCE(SUM(CASE WHEN estado='pagada' THEN monto ELSE 0 END), 0) AS cobrado
         FROM cuotas WHERE anio = ? AND mes = ?`,
        [anioActual, mesActual]
      ),
      query<any>(
        `SELECT
           COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END), 0) AS ingresos,
           COALESCE(SUM(CASE WHEN tipo='egreso'  THEN monto ELSE 0 END), 0) AS egresos
         FROM finanzas
         WHERE DATE_FORMAT(fecha, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`
      ),
      query<any>(
        `SELECT r.id, r.fecha, r.hora_inicio, r.hora_fin, r.estado, c.nombre AS cancha
         FROM reservas r
         LEFT JOIN canchas c ON c.id = r.cancha_id
         WHERE r.fecha >= CURDATE()
         ORDER BY r.fecha, r.hora_inicio
         LIMIT 5`
      ),
      query<any>('SELECT * FROM notificaciones ORDER BY created_at DESC LIMIT 4'),
      query<any>(
        `SELECT fecha, hora, rival, estado, es_local FROM partidos
         WHERE fecha >= CURDATE() ORDER BY fecha LIMIT 4`
      ),
      query<any>(
        `SELECT categoria, SUM(monto) AS total
         FROM finanzas
         WHERE tipo = 'egreso'
           AND DATE_FORMAT(fecha, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
         GROUP BY categoria ORDER BY total DESC LIMIT 5`
      ),
    ]);

  const socios = n(sociosRows[0]?.c);
  const jugadores = n(jugadoresRows[0]?.c);
  const emitida = n(cuotasMes[0]?.montoEmitido);
  const cobrado = n(cuotasMes[0]?.cobrado);
  const cobranza = emitida > 0 ? cobrado / emitida : 0;

  const ingresosMes = n(caja[0]?.ingresos);
  const egresosMes = n(caja[0]?.egresos);
  const resultado = ingresosMes - egresosMes;

  const egresosPorCat = categorias.map((c: any) => ({
    etiqueta: c.categoria || 'Sin categoría',
    valor: n(c.total),
    porcentaje: egresosMes > 0 ? n(c.total) / egresosMes : 0,
  }));

  // Lo primero que ve alguien nuevo: una tarea pendiente concreta, no un
  // número suelto. Si la cobranza del mes está floja, lo primero que aparece
  // es el enlace a la lista de pendientes.
  const pendientes = emitida - cobrado;
  const cobranzaFloja = emitida > 0 && cobranza < 0.7;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel del club"
        description="Resumen del mes en curso y lo que necesita atención."
      />

      {cobranzaFloja && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/25 bg-warn/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-warn">
              Quedan {money(pendientes)} de cuotas sin cobrar
            </p>
            <p className="text-xs text-warn/80">
              Se emitió {money(emitida)} y se cobró {money(cobrado)} ({percent(cobranza, 0)}).
            </p>
          </div>
          <Button size="sm" render={<Link href="/admin/pagos" />}>
            Ver pendientes <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Cifras del mes */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ingresos del mes"
          value={money(ingresosMes)}
          hint={`Caja: ${mesActual}/${anioActual}`}
          tone="ok"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Egresos del mes"
          value={money(egresosMes)}
          hint={`${categorias.length} categorías`}
          tone="danger"
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <StatCard
          label="Resultado del mes"
          value={money(resultado)}
          hint={ingresosMes > 0 ? `Margen ${percent(resultado / ingresosMes, 1)}` : 'Sin ingresos cargados'}
          tone={resultado >= 0 ? 'ok' : 'danger'}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Cobranza"
          value={emitida > 0 ? percent(cobranza, 0) : '—'}
          hint={`${money(cobrado)} de ${money(emitida)}`}
          tone={cobranza >= 0.8 ? 'ok' : cobranza >= 0.5 ? 'warn' : 'danger'}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      {/* Personas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Socios benefactores"
          value={socios}
          hint="Personas responsables de cuotas y reservas"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Jugadores inscriptos"
          value={jugadores}
          hint="Fichas con documentos e historial"
          icon={<UserCheck className="h-4 w-4" />}
        />
      </div>

      {/* Agenda + egresos */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          title="Próximos partidos"
          description="Agenda deportiva"
          actions={
            <Button size="sm" variant="ghost" render={<Link href="/admin/partidos" />}>
              Ver todos
            </Button>
          }
          bodyClassName="p-0"
        >
          {proximos.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-6 w-6" />}
              title="No hay partidos programados"
              description="Cuando carguen el calendario, los próximos partidos aparecen acá."
              action={<Button size="sm" render={<Link href="/admin/partidos" />}>Cargar un partido</Button>}
            />
          ) : (
            <ul className="divide-y divide-line">
              {proximos.map((p: any, i: number) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-main">{p.rival}</p>
                    <p className="text-xs text-dim">
                      {fecha(p.fecha)}{p.hora ? ` · ${p.hora.slice(0, 5)}` : ''} · {p.es_local ? 'Local' : 'Visitante'}
                    </p>
                  </div>
                  <StatusPill tone={p.estado === 'programado' ? 'info' : 'neutral'}>{p.estado}</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Próximas reservas de cancha"
          description="Turnos confirmados"
          actions={
            <Button size="sm" variant="ghost" render={<Link href="/admin/reservas" />}>
              Ver todas
            </Button>
          }
          bodyClassName="p-0"
        >
          {reservas.length === 0 ? (
            <EmptyState
              icon={<Clock className="h-6 w-6" />}
              title="Sin reservas próximas"
              description="Los turnos que toman los socios se listan acá por fecha."
            />
          ) : (
            <ul className="divide-y divide-line">
              {reservas.map((r: any) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-main">{r.cancha || 'Cancha'}</p>
                    <p className="text-xs text-dim">
                      {fecha(r.fecha)} · {String(r.hora_inicio).slice(0, 5)} a {String(r.hora_fin).slice(0, 5)}
                    </p>
                  </div>
                  <StatusPill tone={r.estado === 'confirmada' ? 'ok' : 'neutral'}>{r.estado}</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Egresos + avisos */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          title="En qué se fue la plata este mes"
          description={`Total ${money(egresosMes)}`}
          actions={
            <Button size="sm" variant="ghost" render={<Link href="/admin/contabilidad" />}>
              Contabilidad
            </Button>
          }
        >
          <BarrasComposicion datos={egresosPorCat} vacio="No hay egresos cargados este mes." />
        </Panel>

        <Panel
          title="Avisos recientes"
          bodyClassName="p-0"
          actions={
            <Button size="sm" variant="ghost" render={<Link href="/admin/notificaciones" />}>
              Ver todas
            </Button>
          }
        >
          {notifs.length === 0 ? (
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="No hay avisos"
              description="Los comunicados que envíes a la directiva aparecerán en esta lista."
            />
          ) : (
            <ul className="divide-y divide-line">
              {notifs.map((x: any) => (
                <li key={x.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-main">{x.titulo}</p>
                      <p className="truncate text-xs text-dim">{x.mensaje}</p>
                    </div>
                    <StatusPill
                      tone={x.tipo === 'urgente' ? 'danger' : x.tipo === 'pago' ? 'warn' : 'info'}
                    >
                      {x.tipo}
                    </StatusPill>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
