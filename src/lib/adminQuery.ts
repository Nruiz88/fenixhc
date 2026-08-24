// Client-side helper to query Supabase through the admin API endpoint

interface QueryOptions {
  table: string;
  columns?: string;
  filters?: Record<string, any>;
  data?: any;
  limit?: number;
  order?: { column: string; ascending?: boolean };
  single?: boolean;
}

export async function adminQuery<T = any>(options: QueryOptions): Promise<{ data: T | null; error: string | null }> {
  const res = await fetch('/api/admin/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation: 'select', ...options }),
  });
  const json = await res.json();
  if (!res.ok) return { data: null, error: json.error };
  return { data: json.data ?? null, error: null };
}

export async function adminMutate<T = any>(operation: string, table: string, data?: any, filters?: Record<string, any>): Promise<{ data: T | null; error: string | null }> {
  const res = await fetch('/api/admin/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, table, data, filters }),
  });
  const json = await res.json();
  if (!res.ok) return { data: null, error: json.error };
  return { data: json.data ?? null, error: null };
}

// Convenience wrapper
export const db = {
  select: <T = any>(table: string, columns?: string, filters?: Record<string, any>, options?: Partial<QueryOptions>) =>
    adminQuery<T>({ table, columns, filters, ...options }),
  
  insert: <T = any>(table: string, data: any) =>
    adminMutate<T>('insert', table, data),
  
  upsert: <T = any>(table: string, data: any) =>
    adminMutate<T>('upsert', table, data),
  
  update: <T = any>(table: string, data: any, filters: Record<string, any>) =>
    adminMutate<T>('update', table, data, filters),
  
  delete: (table: string, filters: Record<string, any>) =>
    adminMutate('delete', table, undefined, filters),
};
