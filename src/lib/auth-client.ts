// Auth helpers using cookie-based JWT auth (no Supabase client)

export interface AuthUser {
  id: string;
  rol: 'admin' | 'padre' | 'deportista';
  nombre: string;
  apellido: string;
  email: string;
}

export interface AuthResponse {
  user: (AuthUser & { perfil?: any }) | null;
}

// Get current authenticated user from server
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return json.user;
  } catch {
    return null;
  }
}

// Login
export async function login(email: string, password: string): Promise<{ user?: AuthUser; error?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error };
    return { user: json.user };
  } catch {
    return { error: 'Error de conexión' };
  }
}

// Register
export async function register(data: any): Promise<{ userId?: string; error?: string }> {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error };
    return { userId: json.userId };
  } catch {
    return { error: 'Error de conexión' };
  }
}

// Logout
export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {}
}

// Create a "client-like" interface for backwards compatibility
// This mimics what pages expect from a Supabase client
export function createClient() {
  return {
    auth: {
      async getUser() {
        const user = await getCurrentUser();
        return { data: { user } };
      },
      async getSession() {
        const user = await getCurrentUser();
        return { data: { session: user ? { user } : null } };
      },
      async signOut() {
        await logout();
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const result = await login(email, password);
        if (result.error) return { data: { user: null }, error: { message: result.error } };
        return { data: { user: result.user }, error: null };
      },
      onAuthStateChange(callback: (event: string, session: any) => void) {
        // Simple polling implementation
        let lastUser: any = null;
        const check = async () => {
          const user = await getCurrentUser();
          const changed = JSON.stringify(user) !== JSON.stringify(lastUser);
          if (changed) {
            lastUser = user;
            callback(user ? 'SIGNED_IN' : 'SIGNED_OUT', user ? { user } : null);
          }
        };
        check();
        const interval = setInterval(check, 30000);
        return { data: { subscription: { unsubscribe: () => clearInterval(interval) } } };
      },
    },
    // Database query through API
    from(table: string) {
      return buildQuery(table, '/api/user/query');
    },
  };
}

// Build a query chain compatible with Supabase's query builder
function buildQuery(table: string, endpoint: string) {
  let state: any = { table, filters: {}, columns: '*', limit: undefined, order: undefined, single: false };

  const chain: any = {
    select(cols = '*') { state.columns = cols; return chain; },
    insert(data: any) { state.operation = 'insert'; state.data = data; return chain; },
    upsert(data: any) { state.operation = 'upsert'; state.data = data; return chain; },
    update(data: any) { state.operation = 'update'; state.data = data; return chain; },
    delete() { state.operation = 'delete'; return chain; },

    eq(col: string, val: any) { state.filters[col] = val; return chain; },
    neq(col: string, val: any) { state.filters[col] = { op: 'neq', val }; return chain; },
    gt(col: string, val: any) { state.filters[col] = { op: 'gt', val }; return chain; },
    gte(col: string, val: any) { state.filters[col] = { op: 'gte', val }; return chain; },
    lt(col: string, val: any) { state.filters[col] = { op: 'lt', val }; return chain; },
    lte(col: string, val: any) { state.filters[col] = { op: 'lte', val }; return chain; },
    like(col: string, val: any) { state.filters[col] = { op: 'like', val }; return chain; },
    in(col: string, val: any[]) { state.filters[col] = { op: 'in', val }; return chain; },
    is(col: string, val: any) { if (val === null) state.filters[col] = null; return chain; },

    order(col: string, opts?: { ascending?: boolean }) { state.order = { column: col, ascending: opts?.ascending ?? false }; return chain; },
    limit(n: number) { state.limit = n; return chain; },
    single() { state.single = true; return chain; },

    async then(resolve: any, reject?: any) {
      try {
        const operation = state.operation || 'select';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation, table: state.table, columns: state.columns,
            filters: state.filters, data: state.data,
            limit: state.limit, order: state.order, single: state.single,
          }),
        });
        const json = await res.json();
        if (!res.ok) return resolve({ data: null, error: { message: json.error } });
        const data = json.data !== undefined ? json.data : null;
        return resolve({ data, error: null });
      } catch (err: any) {
        return resolve({ data: null, error: { message: err.message } });
      }
    },
  };

  return chain;
}
