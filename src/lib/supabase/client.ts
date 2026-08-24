import { createBrowserClient } from '@supabase/ssr';

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (client) return client;
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    // During build time, return a mock client
    return null as unknown as ReturnType<typeof createBrowserClient>;
  }
  
  client = createBrowserClient(supabaseUrl, supabaseKey);
  return client;
}
