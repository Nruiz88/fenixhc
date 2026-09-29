import { NextRequest, NextResponse } from 'next/server';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { query, insert, uuid } from '@/lib/db';

// Endpoint publico (sin autenticacion) para paginas: home, galeria,
// comunicados, entrenamientos y formulario de contacto.
const PUBLIC_SELECT_TABLES = [
  'comunicados',
  'fotos_galeria',
  'sponsors',
  'horarios_entrenamiento',
  'partidos',
  'canchas',
];

const PUBLIC_INSERT_TABLES = ['contacto_publico'];

const MAX_LIMIT = 100;

const PUBLIC_COLUMNS: Record<string, string[]> = {
  comunicados: ['id', 'titulo', 'resumen', 'contenido', 'tipo', 'estado', 'imagen_url', 'autor_id', 'destacado', 'fecha_publicacion', 'created_at', 'updated_at'],
  fotos_galeria: ['id', 'subido_por', 'url', 'descripcion', 'es_video', 'created_at'],
  sponsors: ['id', 'nombre', 'logo_url', 'sitio_web', 'tier', 'descripcion', 'activo', 'orden', 'created_at'],
  horarios_entrenamiento: ['id', 'dia', 'hora_inicio', 'hora_fin', 'tipo', 'descripcion', 'nivel', 'activo', 'orden', 'created_at'],
  partidos: ['id', 'fecha', 'hora', 'rival', 'escudo_url', 'cancha', 'es_local', 'competencia', 'jornada', 'estado', 'goles_nuestros', 'goles_rival', 'resultado', 'notas', 'created_at'],
  canchas: ['id', 'nombre', 'descripcion', 'capacidad', 'activa'],
};

const IDENT_RE = /^[A-Za-z0-9_]+$/;

function buildWhere(table: string, filters?: Record<string, any>): { clause: string; params: any[] } {
  if (!filters) return { clause: '', params: [] };
  const allowed = new Set(PUBLIC_COLUMNS[table] || []);
  const conditions: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined) continue;
    if (!allowed.has(key) || !IDENT_RE.test(key)) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) { conditions.push('1 = 0'); continue; }
      conditions.push(`${key} IN (${value.map(() => '?').join(',')})`);
      params.push(...value);
      continue;
    }
    if (typeof value === 'object' && 'op' in value) {
      const { op, val } = value;
      switch (op) {
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

export async function POST(request: NextRequest) {
  try {
    const leido = await leerJson(request);
    if (!leido.ok) return RESP_BAD_JSON();
    const body = leido.data as any;
    const { table, operation = 'select', filters, data, columns, limit, order, single } = body;

    if (!table) {
      return NextResponse.json({ error: 'Tabla requerida' }, { status: 400 });
    }

    if (operation === 'insert') {
      if (!PUBLIC_INSERT_TABLES.includes(table)) {
        return NextResponse.json({ error: 'Tabla no válida' }, { status: 403 });
      }
      if (!data || typeof data !== 'object') {
        return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 });
      }

      const allowed: Record<string, string[]> = {
        contacto_publico: ['nombre', 'correo', 'telefono', 'mensaje'],
      };
      const filtered: Record<string, any> = {};
      for (const k of allowed[table]) {
        if (data[k]) filtered[k] = String(data[k]).slice(0, 1000);
      }
      if (!filtered.nombre || !filtered.correo || !filtered.mensaje) {
        return NextResponse.json({ error: 'Nombre, correo y mensaje son obligatorios' }, { status: 400 });
      }

      const keys = Object.keys(filtered);
      const id = uuid();
      await insert(
        `INSERT INTO ${table} (id, ${keys.join(',')}) VALUES (?, ${keys.map(() => '?').join(',')})`,
        [id, ...keys.map((k) => filtered[k])]
      );
      return NextResponse.json({ data: { id } });
    }

    if (operation !== 'select') {
      return NextResponse.json({ error: 'Operación no válida' }, { status: 400 });
    }

    if (!PUBLIC_SELECT_TABLES.includes(table)) {
      return NextResponse.json({ error: 'Tabla no válida' }, { status: 403 });
    }

    const allowedSet = new Set(PUBLIC_COLUMNS[table] || []);
    const requestedCols = columns
      ? columns.split(',').map((c: string) => c.trim()).filter((c: string) => c && allowedSet.has(c))
      : [];
    const selectCols = requestedCols.length > 0 ? requestedCols.join(', ') : '*';

    const { clause, params } = buildWhere(table, filters);
    const orderBy = order?.column && allowedSet.has(order.column)
      ? ` ORDER BY ${order.column}${order.ascending ? ' ASC' : ' DESC'}`
      : '';
    const limitClause = ` LIMIT ${Math.min(Number(limit) || MAX_LIMIT, MAX_LIMIT)}`;

    const rows = await query(`SELECT ${selectCols} FROM ${table}${clause}${orderBy}${limitClause}`, params);
    if (single) return NextResponse.json({ data: rows.length > 0 ? rows[0] : null });
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Public query error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
