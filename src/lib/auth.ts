import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';

const SECRET = process.env.JWT_SECRET || 'fenix-roller-hockey-secret-key-change-in-production';
const COOKIE_NAME = 'fenix_token';
const EXPIRES_IN = '7d';

export interface AuthUser {
  id: string;
  rol: 'admin' | 'padre' | 'deportista';
  nombre: string;
  apellido: string;
  email: string;
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Create JWT token
export function createToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, rol: user.rol, nombre: user.nombre, apellido: user.apellido, email: user.email },
    SECRET,
    { expiresIn: EXPIRES_IN }
  );
}

// Verify JWT token
export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, SECRET) as AuthUser;
  } catch {
    return null;
  }
}

// Set auth cookie in response
export function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

// Clear auth cookie
export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
}

// Get token from request (cookie or Authorization header)
export function getTokenFromRequest(request: NextRequest): string | null {
  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (cookie) return cookie;
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

// Get current user from request (server-side)
export async function getCurrentUser(request?: NextRequest): Promise<AuthUser | null> {
  let token: string | null = null;

  if (request) {
    token = getTokenFromRequest(request);
  } else {
    // For API routes without explicit request
    const store = await cookies();
    token = store.get(COOKIE_NAME)?.value || null;
  }

  if (!token) return null;
  return verifyToken(token);
}

// Require authentication - returns user or error
export async function requireAuth(roles?: string[]): Promise<{ user: AuthUser } | { error: string; status: number }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'No autenticado', status: 401 };
  }
  if (roles && !roles.includes(user.rol)) {
    return { error: 'Sin permisos', status: 403 };
  }
  return { user };
}

// Authenticate from request (for middleware)
export function authenticateFromRequest(request: NextRequest): AuthUser | null {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

export { COOKIE_NAME };
