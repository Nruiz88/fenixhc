import { describe, it, expect } from 'vitest';
import {
  normalizarRoles, rolPrincipal, esDirectiva, tieneModulo,
  portalDeRoles, tieneRol, etiquetasDeRoles, type Rol,
} from '@/lib/roles';
import { puede, capacidadesDe, esTesorero } from '@/lib/capacidades';

// Varios roles por persona: el caso real es un socio benefactor que además
// es secretario. Estas pruebas fijan las dos reglas que no son obvias:
//
//  - los permisos se SUMAN (no gana el rol principal);
//  - el portal de entrada lo decide la jerarquía, pero el proxy deja entrar
//    a los dos portales porque mira la lista completa.

describe('normalización de roles', () => {
  it('acepta una lista con repetidos y descarta valores desconocidos', () => {
    expect(normalizarRoles(['secretario', 'socio_benefactor', 'secretario', 'hacker']))
      .toEqual(['secretario', 'socio_benefactor']);
  });

  it('acepta el JSON tal como puede venir de MariaDB', () => {
    expect(normalizarRoles('["socio_benefactor","tesorero"]'))
      .toEqual(['tesorero', 'socio_benefactor']);
  });

  it('usa el rol viejo como respaldo y nunca devuelve una lista vacía', () => {
    expect(normalizarRoles(null, 'socio_cadete')).toEqual(['socio_cadete']);
    expect(normalizarRoles([], undefined)).toEqual(['socio_benefactor']);
  });

  it('el principal es el de mayor jerarquía, no el primero del array', () => {
    expect(rolPrincipal(['socio_benefactor', 'admin'])).toBe('admin');
    expect(rolPrincipal(['socio_benefactor', 'secretario'])).toBe('secretario');
    expect(rolPrincipal(['socio_cadete', 'socio_benefactor'])).toBe('socio_benefactor');
  });

  it('etiqueta todos los roles para mostrarlos juntos', () => {
    expect(etiquetasDeRoles(['secretario', 'socio_benefactor']))
      .toBe('Secretario · Socio Benefactor');
  });
});

describe('permisos con varios roles', () => {
  const roles: Rol[] = ['socio_benefactor', 'secretario'];

  it('un solo rol de directiva alcanza para entrar al panel', () => {
    expect(esDirectiva(roles)).toBe(true);
    expect(esDirectiva('socio_benefactor')).toBe(false);
  });

  it('los módulos se suman entre todos los roles', () => {
    // Secretario aporta socios/comunicados; el socio no aporta módulos, pero
    // tampoco los quita.
    expect(tieneModulo(roles, 'socios')).toBe(true);
    expect(tieneModulo(roles, 'finanzas')).toBe(false);

    // Tesorero + secretario: la unión incluye el dinero y la secretaría.
    expect(tieneModulo(['secretario', 'tesorero'], 'finanzas')).toBe(true);
    expect(tieneModulo(['secretario', 'tesorero'], 'socios')).toBe(true);
  });

  it('las capacidades de la junta también se suman', () => {
    const ambos = ['secretario', 'tesorero'] as Rol[];
    expect(puede(ambos, 'ver_parte_administrativo')).toBe(true); // secretario
    expect(puede(ambos, 'ver_parte_financiero')).toBe(true);     // tesorero
    expect(capacidadesDe(ambos)).toEqual(
      expect.arrayContaining(['ver_parte_administrativo', 'ver_parte_financiero'])
    );
    expect(esTesorero(ambos)).toBe(true);
  });

  it('un socio que además es secretario conserva su portal de socio', () => {
    expect(tieneRol(roles, 'socio_benefactor')).toBe(true);
    // El portal de entrada es el panel, pero la ruta de socio sigue habilitada.
    expect(portalDeRoles(roles)).toBe('/admin/dashboard');
    expect(portalDeRoles(['socio_benefactor', 'socio_cadete']))
      .toBe('/socio-benefactor/dashboard');
  });
});
