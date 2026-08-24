// Client-side helper for user-scoped queries through the API

interface QueryOptions {
  table: string;
  columns?: string;
  filters?: Record<string, any>;
  data?: any;
  limit?: number;
  order?: { column: string; ascending?: boolean };
  single?: boolean;
}

export async function userQuery<T = any>(options: QueryOptions): Promise<{ data: T | null; error: string | null }> {
  const res = await fetch('/api/user/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation: 'select', ...options }),
  });
  if (res.status === 401) return { data: null, error: 'No autenticado' };
  const json = await res.json();
  if (!res.ok) return { data: null, error: json.error };
  return { data: json.data ?? null, error: null };
}

export async function userMutate<T = any>(operation: string, table: string, data?: any, filters?: Record<string, any>): Promise<{ data: T | null; error: string | null }> {
  const res = await fetch('/api/user/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, table, data, filters }),
  });
  if (res.status === 401) return { data: null, error: 'No autenticado' };
  const json = await res.json();
  if (!res.ok) return { data: null, error: json.error };
  return { data: json.data ?? null, error: null };
}

export const udb = {
  select: <T = any>(table: string, columns?: string, filters?: Record<string, any>, options?: Partial<QueryOptions>) =>
    userQuery<T>({ table, columns, filters, ...options }),
  insert: <T = any>(table: string, data: any) =>
    userMutate<T>('insert', table, data),
  update: <T = any>(table: string, data: any, filters: Record<string, any>) =>
    userMutate<T>('update', table, data, filters),
};
