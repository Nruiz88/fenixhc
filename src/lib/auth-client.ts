// Auth helpers using cookie-based JWT auth (no Supabase client)

import type { Rol } from './roles';

export interface AuthUser {
  id: string;
  rol: Rol;
  nombre: string;
  apellido: string;
  email: string;
}

export interface LoginResult {
  user?: AuthUser;
  error?: string;
  /** Presente cuando la contraseña es correcta pero el email no verificó. */
  code?: string;
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
export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error, code: json.code };
    return { user: json.user };
  } catch {
    return { error: 'Error de conexión' };
  }
}

/** Reenvía el email de verificación (exige email + contraseña). */
export async function resendVerification(email: string, password: string): Promise<{ error?: string; message?: string; devVerificationUrl?: string }> {
  try {
    const res = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error };
    return { message: json.message, devVerificationUrl: json.devVerificationUrl };
  } catch {
    return { error: 'Error de conexión' };
  }
}

// Register
export async function register(data: any): Promise<{ userId?: string; error?: string; devVerificationUrl?: string }> {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error };
    return { userId: json.userId, devVerificationUrl: json.devVerificationUrl };
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
