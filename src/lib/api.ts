// Unified API client for admin and user queries

import { alLogin, ERROR_SESION_VENCIDA } from './sesion';

interface QueryOptions {
  table: string;
  columns?: string;
  filters?: Record<string, any>;
  data?: any;
  limit?: number;
  order?: { column: string; ascending?: boolean };
  single?: boolean;
  view?: string;
}

async function apiQuery<T = any>(
  endpoint: string,
  options: QueryOptions
): Promise<{ data: T | null; error: string | null }> {
  try {
    // Una vista se pide en lugar de una tabla: se manda `view` y sin `table`.
    const payload = options.view
      ? { operation: 'select', view: options.view, limit: options.limit }
      : { operation: 'select', ...options };
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 401) {
      alLogin();
      return { data: null, error: ERROR_SESION_VENCIDA };
    }
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data ?? null, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Error de red' };
  }
}

async function apiMutate<T = any>(
  endpoint: string,
  operation: string,
  table: string,
  data?: any,
  filters?: Record<string, any>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation, table, data, filters }),
    });
    if (res.status === 401) {
      alLogin();
      return { data: null, error: ERROR_SESION_VENCIDA };
    }
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data ?? null, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Error de red' };
  }
}

function createDb(endpoint: string) {
  return {
    select: <T = any>(table: string, columns?: string, filters?: Record<string, any>, options?: Partial<QueryOptions>) =>
      apiQuery<T>(endpoint, { table, columns, filters, ...options }),
    insert: <T = any>(table: string, data: any) =>
      apiMutate<T>(endpoint, 'insert', table, data),
    upsert: <T = any>(table: string, data: any) =>
      apiMutate<T>(endpoint, 'upsert', table, data),
    update: <T = any>(table: string, data: any, filters: Record<string, any>) =>
      apiMutate<T>(endpoint, 'update', table, data, filters),
    delete: (table: string, filters: Record<string, any>) =>
      apiMutate(endpoint, 'delete', table, undefined, filters),
    /**
     * Consulta una vista nombrada (JOINs predefinidos en el servidor).
     * Reemplaza a la sintaxis de joins embebidos de Supabase.
     */
    view: <T = any>(view: string, options?: { limit?: number }) =>
      apiQuery<T>(endpoint, { table: '', view, ...options } as any),
  };
}

/** User API client (requires authentication) */
export const userDb = createDb('/api/user/query');
