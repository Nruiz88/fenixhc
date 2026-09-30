import { NextRequest, NextResponse } from 'next/server';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { query, execute, insert, uuid } from '@/lib/db';
import { requireDirectiva } from '@/lib/auth';
import { TABLES_BY_ROLE } from '@/lib/constants';
import { getView, buildViewSql } from '@/lib/views';

const ALLOWED_OPERATIONS = ['select', 'insert', 'update', 'delete', 'upsert'] as const;
const MAX_LIMIT = 1000;

// Whitelist of columns per table for safety
const TABLE_COLUMNS: Record<string, string[]> = {
  perfiles: ['id', 'usuario_id', 'rol', 'nombre', 'apellido', 'dni', 'cuil', 'correo', 'telefono', 'direccion', 'foto_url', 'created_at', 'updated_at'],
  // Solo lectura de estado de cuentas. `password_hash`, `verification_token`
  // y los expiry NO están en la lista a propósito: si aparecieran, el endpoint
  // genérico permitiría escribir texto plano en la columna de la contraseña
  // o leer los tokens de verificación de cualquier usuario. El alta, la
  // edición y el cambio de contraseña van por /api/admin/create-user y
  // /api/admin/update-user, que hashean y validan.
  usuarios: ['id', 'email', 'rol', 'email_verificado', 'verification_sent_at', 'created_at', 'updated_at'],
  deportistas: ['id', 'perfil_id', 'dni_frente_url', 'dni_fondo_url', 'club_activo', 'fecha_inscripcion', 'observaciones', 'created_at'],
  familias: ['id', 'padre_perfil_id', 'deportista_perfil_id', 'tipo_vinculo', 'created_at'],
  cuotas: ['id', 'familia_id', 'tipo_socio', 'monto', 'mes', 'anio', 'estado', 'metodo_pago', 'comprobante_url', 'fecha_pago', 'created_at'],
  finanzas: ['id', 'tipo', 'concepto', 'monto', 'fecha', 'categoria', 'metodo_pago', 'descripcion', 'comprobante_url', 'created_by', 'created_at'],
  notificaciones: ['id', 'titulo', 'mensaje', 'tipo', 'destinatario_rol', 'enviada_email', 'created_by', 'created_at'],
  notificaciones_usuarios: ['id', 'notificacion_id', 'usuario_id', 'leida', 'created_at'],
  fotos_galeria: ['id', 'subido_por', 'url', 'descripcion', 'es_video', 'created_at'],
  canchas: ['id', 'nombre', 'descripcion', 'capacidad', 'activa'],
  reservas: ['id', 'cancha_id', 'usuario_id', 'fecha', 'hora_inicio', 'hora_fin', 'estado', 'notas', 'created_at'],
  push_subscriptions: ['id', 'usuario_id', 'endpoint', 'p256dh', 'auth', 'created_at'],
  contacto_publico: ['id', 'nombre', 'correo', 'telefono', 'mensaje', 'leido', 'created_at'],
  partidos: ['id', 'fecha', 'hora', 'rival', 'escudo_url', 'cancha', 'es_local', 'competencia', 'jornada', 'estado', 'goles_nuestros', 'goles_rival', 'resultado', 'notas', 'created_by', 'created_at'],
  comunicados: ['id', 'titulo', 'resumen', 'contenido', 'tipo', 'estado', 'imagen_url', 'autor_id', 'destacado', 'fecha_publicacion', 'created_at', 'updated_at'],
  horarios_entrenamiento: ['id', 'dia', 'hora_inicio', 'hora_fin', 'tipo', 'descripcion', 'nivel', 'activo', 'orden', 'created_at', 'updated_at'],
  sponsors: ['id', 'nombre', 'logo_url', 'sitio_web', 'tier', 'descripcion', 'activo', 'orden', 'created_at', 'updated_at'],
};

const IDENT_RE = /^[A-Za-z0-9_]+$/;

function buildWhere(table: string, filters?: Record<string, any>): { clause: string; params: any[] } {
  if (!filters) return { clause: '', params: [] };
  const allowedCols = new Set(TABLE_COLUMNS[table] || []);
  const conditions: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined) continue;
    if (!allowedCols.has(key) || !IDENT_RE.test(key)) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) { conditions.push('1 = 0'); continue; }
      conditions.push(`${key} IN (${value.map(() => '?').join(',')})`);
      params.push(...value);
      continue;
    }
    if (typeof value === 'object' && 'op' in value) {
      const { op, val } = value;
      switch (op) {
        case 'in': conditions.push(`${key} IN (${val.map(() => '?').join(',')})`); params.push(...val); break;
        case 'like': conditions.push(`${key} LIKE ?`); params.push(`%${val}%`); break;
        case 'gt': conditions.push(`${key} > ?`); params.push(val); break;
        case 'gte': conditions.push(`${key} >= ?`); params.push(val); break;
        case 'lt': conditions.push(`${key} < ?`); params.push(val); break;
        case 'lte': conditions.push(`${key} <= ?`); params.push(val); break;
        case 'neq': conditions.push(`${key} != ?`); params.push(val); break;
        default: conditions.push(`${key} = ?`); params.push(val);
      }
    } else {
      conditions.push(`${key} = ?`); params.push(value);
    }
  }
  return { clause: conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '', params };
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
    // Cualquier cargo de directiva entra al panel; el recorte por modulo se
    // hace en la pagina y en los endpoints especificos (finanzas, pagos...).
    const auth = await requireDirectiva();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const leido = await leerJson(request);
    if (!leido.ok) return RESP_BAD_JSON();
    const body = leido.data as any;
    const { table, view, operation = 'select', filters, data, columns, limit, order, single } = body;

    // Vista nombrada (JOINs predefinidos en el servidor). Solo lectura.
    if (view) {
      if (operation !== 'select') {
        return NextResponse.json({ error: 'Las vistas solo admiten lectura' }, { status: 400 });
      }
      const def = getView(view);
      if (!def || !def.allowed(auth.user)) {
        return NextResponse.json({ error: 'Vista no válida' }, { status: 403 });
      }
      const rows = await query(buildViewSql(def.sql, { limit }), def.scope(auth.user, { limit }));
      return NextResponse.json({ data: rows.map(def.shape) });
    }

    if (!table || !TABLES_BY_ROLE.admin.includes(table)) {
      return NextResponse.json({ error: 'Tabla no válida' }, { status: 400 });
    }

    if (!ALLOWED_OPERATIONS.includes(operation)) {
      return NextResponse.json({ error: 'Operación no válida' }, { status: 400 });
    }

    // Whitelist columns
    const allowedCols = TABLE_COLUMNS[table] || [];
    const selectCols = columns
      ? columns.split(',').map((c: string) => c.trim()).filter((c: string) => allowedCols.includes(c)).join(', ') || '*'
      : '*';

    switch (operation) {
      case 'select': {
        const { clause, params } = buildWhere(table, filters);
        const orderBy = buildOrderBy(table, order);
        const limitClause = limit ? ` LIMIT ${Math.min(Number(limit), MAX_LIMIT)}` : ' LIMIT ' + MAX_LIMIT;
        const rows = await query(`SELECT ${selectCols} FROM ${table}${clause}${orderBy}${limitClause}`, params);

        if (single) {
          return NextResponse.json({ data: rows.length > 0 ? rows[0] : null });
        }
        return NextResponse.json({ data: rows });
      }

      case 'insert': {
        if (!data || typeof data !== 'object') {
          return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 });
        }
        const filteredData = filterColumns(data, allowedCols);
        if (Object.keys(filteredData).length === 0) {
          return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 });
        }
        if (!filteredData.id) filteredData.id = uuid();
        const keys = Object.keys(filteredData);
        const placeholders = keys.map(() => '?').join(',');
        await insert(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`, Object.values(filteredData));
        return NextResponse.json({ data: filteredData });
      }

      case 'update': {
        if (!data || typeof data !== 'object') {
          return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 });
        }
        const { clause, params: filterParams } = buildWhere(table, filters);
        if (!clause) return NextResponse.json({ error: 'Filtros requeridos para update' }, { status: 400 });
        const filteredData = filterColumns(data, allowedCols);
        const keys = Object.keys(filteredData);
        if (keys.length === 0) {
          return NextResponse.json({ error: 'No hay columnas válidas para actualizar' }, { status: 400 });
        }
        const sets = keys.map(k => `${k} = ?`).join(', ');
        const result = await execute(`UPDATE ${table} SET ${sets}${clause}`, [...Object.values(filteredData), ...filterParams]);
        return NextResponse.json({ data: { affected: result.affectedRows } });
      }

      case 'delete': {
        const { clause, params } = buildWhere(table, filters);
        if (!clause) return NextResponse.json({ error: 'Filtros requeridos para delete' }, { status: 400 });
        const result = await execute(`DELETE FROM ${table}${clause}`, params);
        return NextResponse.json({ data: { affected: result.affectedRows } });
      }

      case 'upsert': {
        if (!data || typeof data !== 'object') {
          return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 });
        }
        const filteredData = filterColumns(data, allowedCols);
        if (Object.keys(filteredData).length === 0) {
          return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 });
        }
        if (!filteredData.id) filteredData.id = uuid();
        const keys = Object.keys(filteredData);
        const placeholders = keys.map(() => '?').join(',');
        const updates = keys.filter(k => k !== 'id').map(k => `${k} = VALUES(${k})`).join(', ');
        await insert(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})${updates ? ` ON DUPLICATE KEY UPDATE ${updates}` : ''}`, Object.values(filteredData));
        return NextResponse.json({ data: filteredData });
      }

      default:
        return NextResponse.json({ error: 'Operación no válida' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Admin query error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

// Filtra las claves contra el whitelist de la tabla. NUNCA debe devolver
// el `data` original como fallback: las claves se interpolan directo en el
// SQL (INSERT INTO t (keys)), así que devolverlas sin filtrar abría una vía
// de inyección de nombres de columna.
function filterColumns(data: any, allowed: string[]): any {
  const filtered: any = {};
  if (allowed.length === 0) return filtered;
  for (const [k, v] of Object.entries(data)) {
    if (allowed.includes(k) && IDENT_RE.test(k)) filtered[k] = v;
  }
  return filtered;
}
