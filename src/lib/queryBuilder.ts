import type { SupabaseClient } from '@supabase/supabase-js';

interface FilterValue {
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in';
  val: any;
}

interface QueryOptions {
  table: string;
  columns?: string;
  filters?: Record<string, any>;
  data?: any;
  limit?: number;
  order?: { column: string; ascending?: boolean };
  single?: boolean;
  maxLimit?: number;
}

export function buildSelectQuery(
  supabase: SupabaseClient,
  options: QueryOptions
) {
  const { table, columns = '*', filters, limit, order, single, maxLimit = 1000 } = options;

  let query: any = supabase.from(table).select(columns);

  if (filters) {
    query = applyFilters(query, filters);
  }

  if (order) {
    query = query.order(order.column, { ascending: order.ascending ?? false });
  }

  if (limit) {
    query = query.limit(Math.min(limit, maxLimit));
  }

  if (single) {
    query = query.single();
  }

  return query;
}

export function buildUpdateQuery(
  supabase: SupabaseClient,
  table: string,
  data: any,
  filters?: Record<string, any>
) {
  let query = supabase.from(table).update(data);
  if (filters) query = applyFilters(query, filters);
  return query.select();
}

export function buildDeleteQuery(
  supabase: SupabaseClient,
  table: string,
  filters?: Record<string, any>
) {
  let query = supabase.from(table).delete();
  if (filters) query = applyFilters(query, filters);
  return query;
}

function applyFilters(query: any, filters: Record<string, any>) {
  for (const [key, value] of Object.entries(filters)) {
    if (value && typeof value === 'object' && 'op' in value) {
      const { op, val } = value as FilterValue;
      switch (op) {
        case 'eq': query = query.eq(key, val); break;
        case 'neq': query = query.neq(key, val); break;
        case 'gt': query = query.gt(key, val); break;
        case 'gte': query = query.gte(key, val); break;
        case 'lt': query = query.lt(key, val); break;
        case 'lte': query = query.lte(key, val); break;
        case 'like': query = query.like(key, val); break;
        case 'in': query = query.in(key, val); break;
      }
    } else {
      query = query.eq(key, value);
    }
  }
  return query;
}

export async function executeQuery(
  supabase: SupabaseClient,
  operation: string,
  options: QueryOptions
) {
  const { table, data } = options;

  switch (operation) {
    case 'select': {
      const { data: result, error } = await buildSelectQuery(supabase, options);
      if (error) throw error;
      return result;
    }
    case 'insert': {
      const { data: result, error } = await supabase.from(table).insert(data).select();
      if (error) throw error;
      return result;
    }
    case 'upsert': {
      const { data: result, error } = await supabase.from(table).upsert(data).select();
      if (error) throw error;
      return result;
    }
    case 'update': {
      const { data: result, error } = await buildUpdateQuery(supabase, table, data, options.filters);
      if (error) throw error;
      return result;
    }
    case 'delete': {
      const { error } = await buildDeleteQuery(supabase, table, options.filters);
      if (error) throw error;
      return null;
    }
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}
