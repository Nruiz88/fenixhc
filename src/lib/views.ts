// Vistas de solo lectura con JOINs, en el servidor.
//
// Por qué: el endpoint genérico de queries filtra las columnas solicitadas
// contra un whitelist plano, así que no puede resolver la sintaxis de
// joins embebidos de Supabase (`*, perfiles(nombre)`). En vez de inventar
// un parser de joins (superficie de ataque innecesaria), cada pantalla que
// necesita datos relacionados usa una VISTA nombrada y fija de acá.
//
// Reglas de seguridad:
//  - El SQL es estático: no se interpola nada del cliente, solo `?` bindeados.
//  - Cada vista declara su propio scope por rol (`scope`), que es la
//    equivalente de la RLS que tenía Supabase.
//  - `shape` reconstruye el objeto anidado con la misma forma que devolvía
//    PostgREST (row.perfiles, row.familias) para no tocar el JSX.

import type { AuthUser } from './auth';
import { esDirectiva } from './roles';

export interface ViewDef {
  /** SQL estático. Usa `?` para los parámetros. */
  sql: string;
  /**
   * Parámetros de filtrado por rol. Recibe el usuario y devuelve los binds.
   * Para el admin se devuelven los params sin restricting.
   */
  scope: (user: AuthUser, params: ViewParams) => any[];
  /** Convierte la fila plana del JOIN en la forma anidada que espera la UI. */
  shape: (row: any) => any;
  /** True si el usuario tiene permiso para leer esta vista. */
  allowed: (user: AuthUser) => boolean;
}

export interface ViewParams {
  limit?: number;
  mes?: number;
  anio?: number;
}

const MAX_LIMIT = 1000;

// `LIMIT ?` con prepared statements no es fiable en todas las versiones de
// MySQL/MariaDB, así que el límite se interpola como entero ya sanitizado
// (mismo criterio que usa el endpoint genérico).
function limitClause(p: ViewParams): string {
  const n = Math.floor(Number(p.limit));
  const safe = Number.isFinite(n) && n > 0 ? Math.min(n, MAX_LIMIT) : MAX_LIMIT;
  return `LIMIT ${safe}`;
}

/** Reemplaza el token {LIMIT} de una vista por la cláusula ya sanitizada. */
export function buildViewSql(sql: string, params: ViewParams): string {
  if (!sql.includes('{LIMIT}')) return sql;
  return sql.replace('{LIMIT}', limitClause(params));
}

// --- Constructores de objeto anidado -------------------------------------

const perfil = (row: any, prefijo: string) => {
  const id = row[`${prefijo}_id`];
  if (!id) return null;
  return {
    id,
    nombre: row[`${prefijo}_nombre`],
    apellido: row[`${prefijo}_apellido`],
    dni: row[`${prefijo}_dni`],
    cuil: row[`${prefijo}_cuil`],
    correo: row[`${prefijo}_correo`],
    // `email` es un alias de `correo`: el JSX de /admin/pagos busca `email`.
    email: row[`${prefijo}_correo`],
    telefono: row[`${prefijo}_telefono`],
    direccion: row[`${prefijo}_direccion`],
  };
};

// --- VISTAS ADMIN --------------------------------------------------------

const ADMIN_DEPORTISTAS: ViewDef = {
  allowed: (u) => esDirectiva(u.rol),
  sql: `
    SELECT d.id, d.perfil_id, d.club_activo, d.fecha_inscripcion, d.observaciones,
           d.dni_frente_url, d.dni_fondo_url, d.created_at,
           p.id AS p_id, p.nombre AS p_nombre, p.apellido AS p_apellido,
           p.dni AS p_dni, p.cuil AS p_cuil, p.correo AS p_correo,
           p.telefono AS p_telefono, p.direccion AS p_direccion
    FROM deportistas d
    LEFT JOIN perfiles p ON p.id = d.perfil_id
    ORDER BY p.apellido, p.nombre
    {LIMIT}`,
  scope: () => [],
  shape: (r) => ({ ...r, perfiles: perfil(r, 'p') }),
};

const ADMIN_CUOTAS: ViewDef = {
  allowed: (u) => esDirectiva(u.rol),
  sql: `
    SELECT c.id, c.familia_id, c.tipo_socio, c.monto,
           COALESCE(c.monto_pagado, 0) AS monto_pagado, c.mes, c.anio, c.estado,
           c.metodo_pago, c.comprobante_url, c.fecha_pago, c.created_at,
           c.vencimiento_override,
           f.id AS f_id,
           pp.id AS padre_id, pp.nombre AS padre_nombre, pp.apellido AS padre_apellido,
           pp.dni AS padre_dni, pp.correo AS padre_correo, pp.telefono AS padre_telefono,
           dp.id AS hijo_id, dp.nombre AS hijo_nombre, dp.apellido AS hijo_apellido,
           dp.dni AS hijo_dni, dp.correo AS hijo_correo, dp.telefono AS hijo_telefono
    FROM cuotas c
    INNER JOIN familias f ON f.id = c.familia_id
    LEFT JOIN perfiles pp ON pp.id = f.padre_perfil_id
    LEFT JOIN perfiles dp ON dp.id = f.deportista_perfil_id
    ORDER BY c.anio DESC, c.mes DESC
    {LIMIT}`,
  scope: () => [],
  shape: (r) => ({
    ...r,
    familias: { id: r.f_id, padre: perfil(r, 'padre'), hijo: perfil(r, 'hijo') },
  }),
};

const ADMIN_FAMILIAS: ViewDef = {
  allowed: (u) => esDirectiva(u.rol),
  sql: `
    SELECT f.id, f.padre_perfil_id, f.deportista_perfil_id, f.tipo_vinculo, f.created_at,
           pp.id AS padre_id, pp.nombre AS padre_nombre, pp.apellido AS padre_apellido,
           pp.dni AS padre_dni, pp.correo AS padre_correo, pp.telefono AS padre_telefono,
           dp.id AS hijo_id, dp.nombre AS hijo_nombre, dp.apellido AS hijo_apellido,
           dp.dni AS hijo_dni, dp.correo AS hijo_correo, dp.telefono AS hijo_telefono
    FROM familias f
    LEFT JOIN perfiles pp ON pp.id = f.padre_perfil_id
    LEFT JOIN perfiles dp ON dp.id = f.deportista_perfil_id
    ORDER BY pp.apellido, dp.apellido
    {LIMIT}`,
  scope: () => [],
  shape: (r) => ({ ...r, padre: perfil(r, 'padre'), hijo: perfil(r, 'hijo') }),
};

const ADMIN_DEPORTISTAS_LIGEROS: ViewDef = {
  allowed: (u) => esDirectiva(u.rol),
  sql: `
    SELECT d.id, d.perfil_id, d.club_activo, d.fecha_inscripcion,
           p.id AS p_id, p.nombre AS p_nombre, p.apellido AS p_apellido, p.dni AS p_dni
    FROM deportistas d
    LEFT JOIN perfiles p ON p.id = d.perfil_id
    ORDER BY p.apellido
    {LIMIT}`,
  scope: () => [],
  shape: (r) => ({ ...r, perfiles: perfil(r, 'p') }),
};

const ADMIN_RESERVAS: ViewDef = {
  allowed: (u) => esDirectiva(u.rol),
  sql: `
    SELECT r.id, r.cancha_id, r.usuario_id, r.fecha, r.hora_inicio, r.hora_fin,
           r.estado, r.notas, r.created_at,
           c.id AS c_id, c.nombre AS c_nombre,
           p.id AS p_id, p.nombre AS p_nombre, p.apellido AS p_apellido
    FROM reservas r
    LEFT JOIN canchas c ON c.id = r.cancha_id
    LEFT JOIN perfiles p ON p.id = r.usuario_id
    ORDER BY r.fecha DESC, r.hora_inicio DESC
    {LIMIT}`,
  scope: () => [],
  shape: (r) => ({ ...r, canchas: { id: r.c_id, nombre: r.c_nombre }, perfiles: perfil(r, 'p') }),
};

// --- VISTAS USUARIO (scoped) --------------------------------------------

const USUARIO_DEPORTISTAS: ViewDef = {
  allowed: (u) => u.rol === 'socio_cadete' || esDirectiva(u.rol),
  sql: `
    SELECT d.id, d.perfil_id, d.club_activo, d.fecha_inscripcion, d.observaciones,
           d.dni_frente_url, d.dni_fondo_url, d.created_at,
           p.id AS p_id, p.nombre AS p_nombre, p.apellido AS p_apellido,
           p.dni AS p_dni, p.correo AS p_correo, p.telefono AS p_telefono
    FROM deportistas d
    LEFT JOIN perfiles p ON p.id = d.perfil_id
    WHERE d.perfil_id = ?
    {LIMIT}`,
  scope: (u) => [u.id],
  shape: (r) => ({ ...r, perfiles: perfil(r, 'p') }),
};

const PADRE_HIJOS: ViewDef = {
  allowed: (u) => u.rol === 'socio_benefactor' || esDirectiva(u.rol),
  sql: `
    SELECT f.id, f.tipo_vinculo, f.created_at,
           p.id AS p_id, p.nombre AS p_nombre, p.apellido AS p_apellido,
           p.dni AS p_dni, p.correo AS p_correo, p.telefono AS p_telefono
    FROM familias f
    LEFT JOIN perfiles p ON p.id = f.deportista_perfil_id
    WHERE f.padre_perfil_id = ?
    ORDER BY p.nombre
    {LIMIT}`,
  scope: (u) => [u.id],
  shape: (r) => ({ ...r, perfiles: perfil(r, 'p') }),
};

const PADRE_CUOTAS: ViewDef = {
  allowed: (u) => u.rol === 'socio_benefactor' || esDirectiva(u.rol),
  sql: `
    SELECT c.id, c.familia_id, c.tipo_socio, c.monto,
           COALESCE(c.monto_pagado, 0) AS monto_pagado, c.mes, c.anio, c.estado,
           c.metodo_pago, c.comprobante_url, c.fecha_pago, c.created_at,
           c.vencimiento_override,
           f.id AS f_id,
           dp.id AS hijo_id, dp.nombre AS hijo_nombre, dp.apellido AS hijo_apellido,
           dp.dni AS hijo_dni, dp.correo AS hijo_correo
    FROM cuotas c
    INNER JOIN familias f ON f.id = c.familia_id
    LEFT JOIN perfiles dp ON dp.id = f.deportista_perfil_id
    WHERE f.padre_perfil_id = ?
    ORDER BY c.anio DESC, c.mes DESC
    {LIMIT}`,
  scope: (u) => [u.id],
  shape: (r) => ({
    ...r,
    familias: { id: r.f_id, padre: null, hijo: perfil(r, 'hijo') },
  }),
};

const USUARIO_RESERVAS: ViewDef = {
  allowed: () => true,
  sql: `
    SELECT r.id, r.cancha_id, r.usuario_id, r.fecha, r.hora_inicio, r.hora_fin,
           r.estado, r.notas, r.created_at,
           c.id AS c_id, c.nombre AS c_nombre
    FROM reservas r
    LEFT JOIN canchas c ON c.id = r.cancha_id
    WHERE r.usuario_id = ?
    ORDER BY r.fecha DESC, r.hora_inicio DESC
    {LIMIT}`,
  scope: (u) => [u.id],
  shape: (r) => ({ ...r, canchas: { id: r.c_id, nombre: r.c_nombre } }),
};

const USUARIO_GALERIA: ViewDef = {
  allowed: () => true,
  sql: `
    SELECT g.id, g.subido_por, g.url, g.descripcion, g.es_video, g.created_at,
           p.id AS p_id, p.nombre AS p_nombre, p.apellido AS p_apellido
    FROM fotos_galeria g
    LEFT JOIN perfiles p ON p.id = g.subido_por
    ORDER BY g.created_at DESC
    {LIMIT}`,
  scope: () => [],
  shape: (r) => ({ ...r, perfiles: perfil(r, 'p') }),
};

/**
 * Notificaciones del usuario con su estado de lectura.
 *
 * La tabla `notificaciones` es una lista por rol (no por usuario), así que
 * el "leída" vive en `notificaciones_usuarios`: una fila por usuario y
 * notificación, con `leida`. El LEFT JOIN marca `leida = 0` cuando el
 * usuario todavía no abrió esa notificación.
 */
const USUARIO_NOTIFICACIONES: ViewDef = {
  allowed: () => true,
  sql: `
    SELECT n.id, n.titulo, n.mensaje, n.tipo, n.destinatario_rol, n.created_at,
           COALESCE(nu.leida, 0) AS leida, nu.id AS lectura_id
    FROM notificaciones n
    LEFT JOIN notificaciones_usuarios nu
           ON nu.notificacion_id = n.id AND nu.usuario_id = ?
    WHERE n.destinatario_rol = 'todos' OR n.destinatario_rol = ?
    ORDER BY n.created_at DESC
    {LIMIT}`,
  scope: (u) => [u.id, u.rol],
  shape: (r) => ({ ...r, leida: Number(r.leida) === 1 }),
};

export const VIEWS: Record<string, ViewDef> = {
  // admin
  admin_deportistas: ADMIN_DEPORTISTAS,
  admin_deportistas_ligeros: ADMIN_DEPORTISTAS_LIGEROS,
  admin_cuotas: ADMIN_CUOTAS,
  admin_familias: ADMIN_FAMILIAS,
  admin_reservas: ADMIN_RESERVAS,
  // usuario
  usuario_deportistas: USUARIO_DEPORTISTAS,
  padre_hijos: PADRE_HIJOS,
  padre_cuotas: PADRE_CUOTAS,
  usuario_reservas: USUARIO_RESERVAS,
  usuario_galeria: USUARIO_GALERIA,
  usuario_notificaciones: USUARIO_NOTIFICACIONES,
};

export function getView(name: string): ViewDef | null {
  return Object.prototype.hasOwnProperty.call(VIEWS, name) ? VIEWS[name] : null;
}
