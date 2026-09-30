import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Estos son guards de autorización. Un guard que se rompe no rompe la
// pantalla: rompe la promesa que le hacemos a la persona que la está mirando.
// Por eso se fijan con tests sobre el fuente, que es donde se pueden
// relajar sin que nada se avise.

const FUENTE_USER = readFileSync(
  resolve(__dirname, '../src/app/api/user/query/route.ts'),
  'utf8'
);
const FUENTE_ADMIN = readFileSync(
  resolve(__dirname, '../src/app/api/admin/query/route.ts'),
  'utf8'
);

describe('un socio no puede tocar el monto pagado', () => {
  it('monto_pagado no está entre las columnas que un socio puede escribir', () => {
    const bloque = FUENTE_USER.slice(
      FUENTE_USER.indexOf('UPDATABLE_POR_SOCIO'),
      FUENTE_USER.indexOf('];', FUENTE_USER.indexOf('UPDATABLE_POR_SOCIO'))
    );
    const lineaCuotas = bloque.split('\n').find((l) => l.includes('cuotas:')) ?? '';
    expect(lineaCuotas).not.toContain('monto_pagado');
    expect(lineaCuotas).not.toContain('estado');
    expect(lineaCuotas).not.toContain('monto');
  });

  it('un socio no puede insertar ni borrar cuotas', () => {
    expect(FUENTE_USER).toMatch(/cuotas:\s*\['insert',\s*'delete'\]/);
  });

  it('el panel sí puede escribir monto_pagado, para que lo que entra quede guardado', () => {
    // Si `monto_pagado` no está en la whitelist del admin, el UPDATE de
    // /admin/pagos lo descarta en silencio: la cuota queda pagada con el
    // monto en NULL y la contabilidad subestima el ingreso.
    expect(FUENTE_ADMIN).toMatch(/cuotas:.*monto_pagado/);
    expect(FUENTE_ADMIN).toMatch(/cuotas:.*vencimiento_override/);
  });
});

describe('whitelist de usuarios', () => {
  it('no expone nunca el hash de la contraseña ni los tokens', () => {
    // Se busca dentro del array de whitelist, no en todo el archivo: los
    // comentarios explican por qué esas columnas están ausentes, y un test
    // que no distingue uno de otro obliga a borrar la explicación.
    const linea = (FUENTE_ADMIN.match(/^\s*usuarios:\s*\[.*$/m) ?? [''])[0];
    expect(linea).not.toContain('password_hash');
    expect(linea).not.toContain('verification_token');
    // Y sí lo que hace falta para gestionar cuentas.
    expect(linea).toContain('email_verificado');
  });

  it('la contraseña solo se cambia por el endpoint propio, que la hashea', () => {
    expect(FUENTE_ADMIN).not.toMatch(/password_hash.*\['/);
  });
});
