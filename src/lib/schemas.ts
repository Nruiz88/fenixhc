// Esquemas de validación compartidos (zod).
//
// Antes cada endpoint repetía sus propias reglas a mano
// (`password.length < 6`, regex de email sueltas, etc.), lo que hacía fácil
// que se quedaran inconsistentes entre sí. Acá viven en un solo lugar.

import { z } from 'zod';

export const MIN_PASSWORD_LENGTH = 6;

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'El email es obligatorio')
  .max(255, 'El email es demasiado largo')
  .email('Email inválido');

// bcrypt trunca a 72 bytes: no tiene sentido aceptar más.
export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
  .max(72, 'La contraseña no puede superar los 72 caracteres');

export const dniSchema = z
  .string()
  .trim()
  .min(1, 'El DNI es obligatorio')
  .max(20, 'El DNI es demasiado largo');

export const nombreSchema = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(100, 'El nombre es demasiado largo');

export const apellidoSchema = z
  .string()
  .trim()
  .min(1, 'El apellido es obligatorio')
  .max(100, 'El apellido es demasiado largo');

export const telefonoSchema = z.string().trim().max(30, 'El teléfono es demasiado largo');

export const direccionSchema = z.string().trim().max(255, 'La dirección es demasiado larga');

export const cuilSchema = z
  .string()
  .trim()
  .max(20, 'El CUIL es demasiado largo')
  .optional()
  .or(z.literal(''))
  .transform((v) => (v ? v : null));

/** Roles que puede crear el admin. El registro público NO usa este. */
export const ROLES = ['admin', 'padre', 'deportista'] as const;
export const rolAdminSchema = z.enum(ROLES, { message: 'Rol inválido' });

/** Roles que admite el registro público (nunca admin: ver register/route.ts). */
export const ROLES_PUBLICOS = ['padre', 'deportista'] as const;
export const rolPublicoSchema = z.enum(ROLES_PUBLICOS, { message: 'Rol inválido' });

/** Convierte el error de zod en algo que se pueda mandar al cliente. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message || 'Datos inválidos';
}
