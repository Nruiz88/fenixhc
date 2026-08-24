// Unified API client for admin and user queries

interface QueryOptions {
  table: string;
  columns?: string;
  filters?: Record<string, any>;
  data?: any;
  limit?: number;
  order?: { column: string; ascending?: boolean };
  single?: boolean;
}

async function apiQuery<T = any>(
  endpoint: string,
  options: QueryOptions
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'select', ...options }),
    });
    if (res.status === 401) return { data: null, error: 'No autenticado' };
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
    if (res.status === 401) return { data: null, error: 'No autenticado' };
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
  };
}

/** Admin API client (requires admin role) */
export const adminDb = createDb('/api/admin/query');

/** User API client (requires authentication) */
export const userDb = createDb('/api/user/query');
