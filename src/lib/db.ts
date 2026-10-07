import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'club_fenix',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  charset: 'utf8mb4',
  timezone: '+00:00',
});

// Run a SELECT query, returns rows array
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

// Run a query and return first row or null
export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Run INSERT/UPDATE/DELETE, returns result info
export async function execute(sql: string, params: any[] = []): Promise<mysql.ResultSetHeader> {
  const [result] = await pool.execute(sql, params);
  return result as mysql.ResultSetHeader;
}

// Insert and return the generated ID
export async function insert(sql: string, params: any[] = []): Promise<number> {
  const result = await execute(sql, params);
  return result.insertId;
}

// Generate a UUID v4 (MySQL doesn't have gen_random_uuid)
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Close pool (for tests)
/**
 * Lo mínimo que hace falta para correr un INSERT/UPDATE/DELETE.
 *
 * Sirve para que una función acepte "o el pool o una conexión de una
 * transacción" sin importar cuál. Es lo que permite que algo que hoy abre su
 * propia transacción pase a formar parte de la de otro sin reescribir su SQL.
 */
export interface Ejecutable {
  execute(sql: string, values?: any[]): Promise<any>;
}

/**
 * Corre una función dentro de una transacción: si lanza, se revierte todo.
 *
 * Existe por la baja de datos personales. Ese procedimiento toca seis tablas
 * en un orden que importa, y sin transacción un error a la mitad dejaba el
 * sistema en un estado que no existe en ningún lado: ya se había borrado el
 * DNI y el comprobante cuando falló el paso siguiente, y la persona quedaba
 * a medio anonimizar sin que quedara registro ni se pudiera volver atrás.
 *
 * El callback recibe la conexión: las funciones de este módulo usan el pool,
 * y dentro de una transacción tienen que usar ESTA conexión o las
 * statements se irían por otro lado y el rollback no las alcanzaría.
 */
export async function transaccion<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await fn(conn);
    await conn.commit();
    return resultado;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {
      // Si el rollback falla el error útil es el del primero: reportar el
      // rollback taparía la causa real y dejaría al operador sin saber qué
      // pasó de verdad.
      console.error('Falló el rollback de la transacción:', rollbackErr);
    }
    throw err;
  } finally {
    // Siempre se devuelve la conexión al pool, incluso después de un error:
    // si no, una baja fallida filtraría una conexión y con varios fallos
    // seguidos el pool se quedaría sin conexiones.
    conn.release();
  }
}
