import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// El borrado de cuentas toca datos de personas y, si se equivoca, puede
// llevarse puestos pagos reales. Estos tests fijan las protecciones que no
// pueden quedar solo en la interfaz: la API es la que manda.

const FUENTE = readFileSync(
  resolve(__dirname, '../src/app/api/admin/delete-user/route.ts'),
  'utf8'
);
const PANEL = readFileSync(
  resolve(__dirname, '../src/app/admin/usuarios/page.tsx'),
  'utf8'
);

describe('eliminar usuario exige permisos y confirmación', () => {
  it('solo lo puede hacer quien administra usuarios', () => {
    expect(FUENTE).toContain("requireModulo('usuarios')");
  });

  it('exige confirmación explícita', () => {
    expect(FUENTE).toContain('requiereConfirmacion');
    expect(FUENTE).toMatch(/if \(!confirmar\)/);
  });

  it('no permite borrarse a uno mismo', () => {
    expect(FUENTE).toMatch(/id === auth\.user\.id/);
  });
});

describe('eliminar usuario no rompe la contabilidad ni la administración', () => {
  it('rechaza borrar al único administrador', () => {
    expect(FUENTE).toMatch(/No se puede eliminar al único administrador/);
    expect(FUENTE).toContain("JSON_CONTAINS(COALESCE(roles, JSON_ARRAY()), '\"admin\"')");
  });

  it('consulta cuotas y recibos antes de borrar', () => {
    expect(FUENTE).toMatch(/FROM cuotas/);
    expect(FUENTE).toMatch(/FROM recibos/);
    expect(FUENTE).toMatch(/Dar de baja/);
  });

  it('explica cuando una FK impide el borrado en vez de filtrar el SQL', () => {
    expect(FUENTE).toContain('ER_ROW_IS_REFERENCED_2');
    expect(FUENTE).toContain('status: 409');
  });

  it('usa consultas parametrizadas, nunca el id interpolado', () => {
    expect(FUENTE).not.toMatch(/DELETE FROM usuarios[^;]*\$\{/);
    expect(FUENTE).toContain('DELETE FROM usuarios WHERE id = ?');
  });
});

describe('el panel ofrece la eliminación', () => {
  it('llama al endpoint propio con el id y la confirmación', () => {
    expect(PANEL).toContain("fetch('/api/admin/delete-user'");
    expect(PANEL).toMatch(/id: aEliminar\.id,\s*confirmar: true/);
  });

  it('deshabilita el botón en la propia cuenta', () => {
    expect(PANEL).toMatch(/disabled=\{u\.id === miId\}/);
  });
});
