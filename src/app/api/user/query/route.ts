import { NextRequest, NextResponse } from 'next/server';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { query, execute, insert, uuid } from '@/lib/db';
import { requireAuth, type AuthUser } from '@/lib/auth';
import { TABLES_BY_ROLE } from '@/lib/constants';
import { getView, buildViewSql } from '@/lib/views';
import { esDirectiva } from '@/lib/roles';
import { aplicarFiltrosPublicos } from '@/lib/publico';

const ALLOWED_OPERATIONS = ['select', 'insert', 'update', 'delete'] as const;
const MAX_LIMIT = 1000;

const TABLE_COLUMNS: Record<string, string[]> = {
  perfiles: ['id', 'usuario_id', 'rol', 'nombre', 'apellido', 'dni', 'cuil', 'correo', 'telefono', 'direccion', 'foto_url', 'created_at', 'updated_at'],
  deportistas: ['id', 'perfil_id', 'dni_frente_url', 'dni_fondo_url', 'club_activo', 'fecha_inscripcion', 'observaciones', 'created_at'],
  familias: ['id', 'padre_perfil_id', 'deportista_perfil_id', 'tipo_vinculo', 'created_at'],
  cuotas: ['id', 'familia_id', 'tipo_socio', 'monto', 'monto_pagado', 'mes', 'anio', 'estado', 'metodo_pago', 'comprobante_url', 'fecha_pago', 'created_at'],
  finanzas: ['id', 'tipo', 'concepto', 'monto', 'fecha', 'categoria', 'metodo_pago', 'descripcion', 'comprobante_url', 'created_by', 'created_at'],
  notificaciones: ['id', 'titulo', 'mensaje', 'tipo', 'destinatario_rol', 'enviada_email', 'created_by', 'created_at'],
  notificaciones_usuarios: ['id', 'notificacion_id', 'usuario_id', 'leida', 'created_at'],
  fotos_galeria: ['id', 'subido_por', 'url', 'descripcion', 'es_video', 'created_at'],
  canchas: ['id', 'nombre', 'descripcion', 'capacidad', 'activa'],
  reservas: ['id', 'cancha_id', 'usuario_id', 'fecha', 'hora_inicio', 'hora_fin', 'estado', 'notas', 'created_at'],
  contacto_publico: ['id', 'nombre', 'correo', 'telefono', 'mensaje', 'leido', 'created_at'],
  partidos: ['id', 'fecha', 'hora', 'rival', 'escudo_url', 'cancha', 'es_local', 'competencia', 'jornada', 'estado', 'goles_nuestros', 'goles_rival', 'resultado', 'notas', 'created_by', 'created_at'],
  comunicados: ['id', 'titulo', 'resumen', 'contenido', 'tipo', 'estado', 'imagen_url', 'autor_id', 'destacado', 'fecha_publicacion', 'created_at', 'updated_at'],
  horarios_entrenamiento: ['id', 'dia', 'hora_inicio', 'hora_fin', 'tipo', 'descripcion', 'nivel', 'activo', 'orden', 'created_at', 'updated_at'],
  sponsors: ['id', 'nombre', 'logo_url', 'sitio_web', 'tier', 'descripcion', 'activo', 'orden', 'created_at', 'updated_at'],
};

const IDENT_RE = /^[A-Za-z0-9_]+$/;

// ---------------------------------------------------------------------------
// Autorización por fila (reemplaza la RLS de Supabase)
// ---------------------------------------------------------------------------

// Tablas que un socio solo puede leer/escribir sobre SUS filas (o, en el caso
// del socio benefactor, sobre las de sus hijos vinculados).
// La directiva usa /api/admin/query, asi que no entra por aca.
function ownerCondition(table: string, user: AuthUser): { cond: string; params: any[] } | null {
  if (esDirectiva(user.rol)) return null;
  switch (table) {
    case 'perfiles':
      return { cond: 'id = ?', params: [user.id] };
    case 'deportistas':
      return user.rol === 'socio_cadete'
        ? { cond: 'perfil_id = ?', params: [user.id] }
        : { cond: 'perfil_id IN (SELECT deportista_perfil_id FROM familias WHERE padre_perfil_id = ?)', params: [user.id] };
    case 'familias':
      return { cond: 'padre_perfil_id = ?', params: [user.id] };
    case 'cuotas':
      return { cond: 'familia_id IN (SELECT id FROM familias WHERE padre_perfil_id = ?)', params: [user.id] };
    case 'reservas':
      return { cond: 'usuario_id = ?', params: [user.id] };
    case 'notificaciones':
      return { cond: "(destinatario_rol = 'todos' OR destinatario_rol = ?)", params: [user.rol] };
    case 'notificaciones_usuarios':
      return { cond: 'usuario_id = ?', params: [user.id] };
    case 'push_subscriptions':
      return { cond: 'usuario_id = ?', params: [user.id] };
    case 'fotos_galeria':
      return { cond: 'subido_por = ?', params: [user.id] };
    default:
      return null;
  }
}

// Lectura compartida: galería, canchas y horarios se ven entre todos.
const SHARED_READ = new Set(['fotos_galeria', 'canchas', 'horarios_entrenamiento', 'partidos', 'comunicados', 'sponsors']);

// Operaciones de escritura que un SOCIO no puede hacer en absoluto.
// (La directiva entra por /api/admin/query, asi que no pasa por aca.)
const WRITE_BLOCKED_POR_SOCIO: Record<string, string[]> = {
  perfiles: ['insert', 'delete'],
  deportistas: ['insert', 'delete'], // el propio deportista sube sus DNI (ver UPDATABLE_COLUMNS)
  cuotas: ['insert', 'delete'],
  notificaciones: ['insert', 'update', 'delete'],
  canchas: ['insert', 'update', 'delete'],
  finanzas: ['insert', 'update', 'delete'],
  contacto_publico: ['select', 'update', 'delete'], // el listado es solo del admin
};

// Columnas que un SOCIO puede modificar en tablas sensibles
const UPDATABLE_POR_SOCIO: Record<string, string[]> = {
  // El padre solo sube el comprobante. `monto_pagado` NO puede estar acá: si
  // lo estuviera, un socio podría marcar su propia cuota como pagada por el
  // monto que quiera y salirse del recargo. Lo escribe la tesorería al
  // aprobar, desde el panel.
  cuotas: ['comprobante_url', 'metodo_pago'],
  perfiles: ['nombre', 'apellido', 'telefono', 'direccion', 'foto_url'],
  reservas: ['estado', 'notas'],
  familias: ['tipo_vinculo'],
  deportistas: ['dni_frente_url', 'dni_fondo_url', 'observaciones'],
  notificaciones_usuarios: ['leida'],
  fotos_galeria: ['descripcion'],
};

// Columnas que se rellenan automáticamente en inserts de usuarios no-admin
function forcedInsertValues(table: string, user: AuthUser): Record<string, any> | null {
  if (esDirectiva(user.rol)) return {};
  switch (table) {
    case 'familias': return { padre_perfil_id: user.id };
    case 'reservas': return { usuario_id: user.id };
    case 'fotos_galeria': return { subido_por: user.id };
    case 'notificaciones_usuarios': return { usuario_id: user.id };
    default: return {};
  }
}

// ---------------------------------------------------------------------------

function buildConditions(table: string, filters?: Record<string, any>): { conds: string[]; params: any[] } {
  const allowedCols = new Set(TABLE_COLUMNS[table] || []);
  const conds: string[] = [];
  const params: any[] = [];
  if (!filters) return { conds, params };

  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined) continue;
    if (!allowedCols.has(key) || !IDENT_RE.test(key)) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) { conds.push('1 = 0'); continue; }
      conds.push(`${key} IN (${value.map(() => '?').join(',')})`);
      params.push(...value);
      continue;
    }
    if (typeof value === 'object' && 'op' in value) {
      const { op, val } = value;
      switch (op) {
        case 'in': conds.push(`${key} IN (${(val || []).map(() => '?').join(',')})`); params.push(...(val || [])); break;
        case 'like': conds.push(`${key} LIKE ?`); params.push(`%${val}%`); break;
        case 'gt': conds.push(`${key} > ?`); params.push(val); break;
        case 'gte': conds.push(`${key} >= ?`); params.push(val); break;
        case 'lt': conds.push(`${key} < ?`); params.push(val); break;
        case 'lte': conds.push(`${key} <= ?`); params.push(val); break;
        case 'neq': conds.push(`${key} != ?`); params.push(val); break;
        default: conds.push(`${key} = ?`); params.push(val);
      }
    } else {
      conds.push(`${key} = ?`);
      params.push(value);
    }
  }
  return { conds, params };
}

function buildOrderBy(table: string, order?: { column: string; ascending?: boolean }): string {
  if (!order) return '';
  const allowedCols = new Set(TABLE_COLUMNS[table] || []);
  if (!allowedCols.has(order.column) || !IDENT_RE.test(order.column)) return '';
  const dir = order.ascending ? 'ASC' : 'DESC';
  return ` ORDER BY ${order.column} ${dir}`;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;

    const leido = await leerJson(request);
    if (!leido.ok) return RESP_BAD_JSON();
    const body = leido.data as any;
    const { table, view, operation = 'select', filters, data, columns, limit, order, single } = body;

    // Vista nombrada (JOINs predefinidos en el servidor). Solo lectura.
    // Cada vista aplica su propio scope por rol: es la equivalente de la RLS.
    if (view) {
      if (operation !== 'select') {
        return NextResponse.json({ error: 'Las vistas solo admiten lectura' }, { status: 400 });
      }
      const def = getView(view);
      if (!def || !def.allowed(user)) {
        return NextResponse.json({ error: 'Vista no válida' }, { status: 403 });
      }
      const rows = await query(buildViewSql(def.sql, { limit }), def.scope(user, { limit }));
      return NextResponse.json({ data: rows.map(def.shape) });
    }

    if (!table || !TABLES_BY_ROLE[user.rol]?.includes(table)) {
      return NextResponse.json({ error: 'Tabla no válida para tu rol' }, { status: 403 });
    }

    if (!ALLOWED_OPERATIONS.includes(operation)) {
      return NextResponse.json({ error: 'Operación no válida' }, { status: 400 });
    }

    const esDir = esDirectiva(user.rol);
    const blocked = WRITE_BLOCKED_POR_SOCIO[table] || [];
    if (!esDir && blocked.includes(operation)) {
      return NextResponse.json({ error: 'No tenés permisos para esta operación' }, { status: 403 });
    }

    const allowedCols = TABLE_COLUMNS[table] || [];
    const owner = esDir ? null : ownerCondition(table, user);
    const needsOwner = !esDir && owner !== null && !SHARED_READ.has(table);

    // Condiciones de fila: filtros del cliente + condición de propiedad
    const { conds, params: filterParams } = buildConditions(table, filters);
    if (owner && (needsOwner || operation !== 'select')) {
      conds.push(owner.cond);
      filterParams.push(...owner.params);
    }

    // Lo que no se publica no se lee. Sin esta línea un socio podía pedir
    // `comunicados` con columns '*' y leerse los borradores de la directiva:
    // `comunicados` está en SHARED_READ, así que el ownerCondition no lo
    // cubría. Las reglas viven en lib/publico.ts y las comparten el endpoint
    // público y este, para que no diverjan.
    if (!esDir) aplicarFiltrosPublicos(table, conds, filterParams);

    const clause = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';

    switch (operation) {
      case 'select': {
        const selectCols = columns
          ? columns.split(',').map((c: string) => c.trim()).filter((c: string) => allowedCols.includes(c)).join(', ') || '*'
          : '*';
        const orderBy = buildOrderBy(table, order);
        const limitClause = ` LIMIT ${Math.min(Number(limit) || MAX_LIMIT, MAX_LIMIT)}`;
        const rows = await query(`SELECT ${selectCols} FROM ${table}${clause}${orderBy}${limitClause}`, filterParams);
        if (single) return NextResponse.json({ data: rows.length > 0 ? rows[0] : null });
        return NextResponse.json({ data: rows });
      }

      case 'insert': {
        if (!data || typeof data !== 'object') return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 });
        const forced = forcedInsertValues(table, user);
        if (forced === null) return NextResponse.json({ error: 'No tenés permisos' }, { status: 403 });
        const filteredData: any = {};
        for (const [k, v] of Object.entries(data)) { if (allowedCols.includes(k)) filteredData[k] = v; }
        Object.assign(filteredData, forced);
        if (!filteredData.id) filteredData.id = uuid();
        const keys = Object.keys(filteredData);
        await insert(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`, Object.values(filteredData));
        return NextResponse.json({ data: filteredData });
      }

      case 'update': {
        if (!data || typeof data !== 'object') return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 });
        if (!clause) return NextResponse.json({ error: 'Filtros requeridos' }, { status: 400 });
        const cols = esDir ? allowedCols : (UPDATABLE_POR_SOCIO[table] || []);
        const filteredData: any = {};
        for (const [k, v] of Object.entries(data)) { if (cols.includes(k)) filteredData[k] = v; }
        const keys = Object.keys(filteredData);
        if (keys.length === 0) return NextResponse.json({ error: 'No podés modificar esas columnas' }, { status: 403 });
        const sets = keys.map(k => `${k} = ?`).join(', ');
        const result = await execute(`UPDATE ${table} SET ${sets}${clause}`, [...Object.values(filteredData), ...filterParams]);
        return NextResponse.json({ data: { affected: result.affectedRows } });
      }

      case 'delete': {
        if (!clause) return NextResponse.json({ error: 'Filtros requeridos' }, { status: 400 });
        const result = await execute(`DELETE FROM ${table}${clause}`, filterParams);
        return NextResponse.json({ data: { affected: result.affectedRows } });
      }

      default:
        return NextResponse.json({ error: 'Operación no válida' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('User query error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
