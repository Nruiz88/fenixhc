import { describe, it, expect } from 'vitest';
import { ROLES_DIRECTIVA, ROL_LABEL, ROLES, type Rol, esDirectiva, tieneModulo } from '@/lib/roles';

// Estas reglas son las que impiden que un cambio de rol deje al club sin
// administrare. Son reglas de negocio, no de framework, y por eso se fijan
// con tests en vez de quedar sólo en el endpoint: el endpoint valida en
// runtime, pero estas funciones son la referencia compartida y un cambio acá
// rompe el comportamiento aunque el endpoint siga igual.

describe('roles y permisos', () => {
  it('los seis cargos de directiva acceden al panel', () => {
    expect(ROLES_DIRECTIVA).toEqual([
      'admin', 'presidente', 'secretario', 'tesorero', 'vocal_titular', 'vocal_suplente',
    ]);
    for (const r of ROLES_DIRECTIVA) {
      expect(esDirectiva(r)).toBe(true);
    }
  });

  it('los socios no son directiva', () => {
    expect(esDirectiva('socio_benefactor')).toBe(false);
    expect(esDirectiva('socio_cadete')).toBe(false);
  });

  it('ningún socio entra a ningún módulo del panel', () => {
    // Ni siquiera al dashboard: antes les daba un panel vacío y confundía.
    for (const m of ['dashboard', 'usuarios', 'finanzas', 'contabilidad'] as const) {
      expect(tieneModulo('socio_benefactor', m)).toBe(false);
      expect(tieneModulo('socio_cadete', m)).toBe(false);
    }
  });

  it('admin y presidente ven todo', () => {
    for (const m of ['usuarios', 'contabilidad', 'configuracion', 'pagos', 'finanzas'] as const) {
      expect(tieneModulo('admin', m)).toBe(true);
      expect(tieneModulo('presidente', m)).toBe(true);
    }
  });

  it('el tesorero entra a contabilidad pero no a usuarios', () => {
    expect(tieneModulo('tesorero', 'contabilidad')).toBe(true);
    expect(tieneModulo('tesorero', 'pagos')).toBe(true);
    expect(tieneModulo('tesorero', 'usuarios')).toBe(false);
  });

  it('el secretario no toca el dinero', () => {
    expect(tieneModulo('secretario', 'socios')).toBe(true);
    expect(tieneModulo('secretario', 'finanzas')).toBe(false);
    expect(tieneModulo('secretario', 'contabilidad')).toBe(false);
  });

  it('los vocales solo consultan', () => {
    expect(tieneModulo('vocal_titular', 'socios')).toBe(true);
    expect(tieneModulo('vocal_titular', 'pagos')).toBe(false);
    expect(tieneModulo('vocal_titular', 'finanzas')).toBe(false);
  });

  it('todo rol tiene etiqueta en español', () => {
    // Si se agrega un rol al enum y se olvida la etiqueta, la interfaz muestra
    // el valor crudo (vocal_titular) al usuario final.
    for (const r of ROLES) {
      expect(ROL_LABEL[r as Rol]).toBeTruthy();
      expect(ROL_LABEL[r as Rol]).not.toBe(r);
    }
  });
});
