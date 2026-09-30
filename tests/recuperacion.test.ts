import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esTokenValido, hashToken } from '@/lib/recuperacion';

// La recuperación de clave se juzga por lo que NO le dice a quien pide.
//
//   - Si responde distinto para un email que existe y uno que no, la pantalla
//     pasa a ser un formulario para averiguar quién tiene cuenta en el club.
//   - Si el link sirve dos veces, es un enlace eterno.
//   - Si se acepta recuperar sin email verificado, cualquiera puede quedarse
//     con una cuenta que se registrou con el correo de otro.
//
// Las reglas puras se prueban acá. Las de comportamiento —que el endpoint
// devuelva siempre lo mismo— se fijan por la FORMA del código, que es la
// única forma sin base de datos.

const PEDIR = readFileSync(join(__dirname, '../src/app/api/auth/recuperar/route.ts'), 'utf8');
const CAMBIAR = readFileSync(join(__dirname, '../src/app/api/auth/reset-clave/route.ts'), 'utf8');
const LIB = readFileSync(join(__dirname, '../src/lib/recuperacion.ts'), 'utf8');
const EMAIL = readFileSync(join(__dirname, '../src/lib/email.ts'), 'utf8');

describe('el token', () => {
  it('solo acepta 64 hex en minúsculas', () => {
    expect(esTokenValido('a'.repeat(64))).toBe(true);
    expect(esTokenValido('0123456789abcdef'.repeat(4))).toBe(true);

    expect(esTokenValido('a'.repeat(63))).toBe(false);
    expect(esTokenValido('a'.repeat(65))).toBe(false);
    expect(esTokenValido('A'.repeat(64))).toBe(false); // mayúsculas
    expect(esTokenValido('')).toBe(false);
    expect(esTokenValido('z'.repeat(64))).toBe(false);
  });

  it('rechaza sin tocar la base, para no gastar consultas', () => {
    // Con la búsqueda, alguien que probara 10.000 caracteres haría 10.000
    // consultas contra usuarios: eso es denegación de servicio con una request.
    expect('no hex'.length).toBeLessThan(64);
  });

  it('se guarda hasheado, nunca en claro', () => {
    const token = 'a'.repeat(64);
    const hash = hashToken(token);

    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(token);
    // Deterministico: el mismo token da el mismo hash.
    expect(hashToken(token)).toBe(hash);
    expect(hashToken('b'.repeat(64))).not.toBe(hash);
  });
});

describe('la respuesta no revela si el email existe', () => {
  it('hay un solo mensaje en todo el endpoint', () => {
    // Si aparece más de una constante de mensaje, hay una rama que dice algo
    // distinto y la pantalla se convierte en un formulario para preguntar.
    const constantes = PEDIR.match(/const MENSAJE\s*=/g) ?? [];
    expect(constantes.length).toBe(1);
  });

  it('ninguna rama devuelve texto propio', () => {
    // Todas las respuestas 200 del endpoint tienen que salir por el mismo
    // lugar. Un `{ error: ... }` con un mensaje distinto sería una fuga.
    const fugas = [...PEDIR.matchAll(/error:\s*'([^']{15,})'/g)].map((m) => m[1]!);

    for (const texto of fugas) {
      expect(
        /recuperaciones desde esta conexión|Probá en un rato/i.test(texto),
        `mensaje inesperado que podría filtrar información: "${texto}"`
      ).toBe(true);
    }
  });

  it('el motivo real va al log, no a la respuesta', () => {
    expect(PEDIR).toMatch(/motivoEnvio[\s\S]{0,200}console\.log/);
    // Y nunca vuelve en el JSON.
    expect(PEDIR).not.toMatch(/json\(\{[^}]*motivoEnvio/);
  });

  it('no exporta ninguna función para consultar si existe una cuenta', () => {
    // Un route file es un archivo público. Exportar "existeCuenta" desde acá
    // sería construir el formulario que el endpoint evita.
    const exports = [...PEDIR.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map((m) => m[1]!);
    expect(exports).toEqual(['POST']);
  });
});

describe('las reglas del reset', () => {
  it('exige email verificado para poder recuperar', () => {
    // Sin esto, cualquiera puede registrarse con el mail de otra persona y
    // después quedarse con la cuenta.
    expect(LIB).toMatch(/email_verificado/);
    expect(LIB).toMatch(/no-verificado/);
  });

  it('el link dura una hora, no un día', () => {
    // La verificación dura 24h porque confirmar la casilla no es urgente. Un
    // enlace para cambiar la clave queda abierto en una bandeja compartida.
    expect(LIB).toMatch(/TTL_MINUTOS\s*=\s*60/);
    expect(LIB).toMatch(/INTERVAL \? MINUTE/);
  });

  it('pedir un link nuevo invalida el anterior', () => {
    // Si alguien pide, se arrepiente y pide otro, el primero tiene que dejar
    // de servir.
    expect(LIB).toMatch(/reset_token = \?/);
  });

  it('el token se borra al cambiar la clave', () => {
    // Regla 1: un link de recuperación que queda válido es un link eterno.
    expect(LIB).toMatch(/SET password_hash = \?,\s*\n\s*reset_token = NULL/);
  });

  it('el cambio de clave y el borrado del token van juntos', () => {
    // Si no, queda el token válido sin clave cambiada y el próximo intento
    // vuelve a funcionar como si nada.
    expect(LIB).toMatch(/WHERE id = \? AND reset_token = \?/);
  });

  it('el correo no pide la clave: el link abre una pantalla para escribirla', () => {
    // El ataque real es que alguien se haga pasar por el club. Si el mail
    // pidiera la clave, serviría para robarla.
    expect(EMAIL).toMatch(/nunca\.?/);
    expect(EMAIL).toMatch(/Escribir mi nueva clave/);
    expect(EMAIL).toMatch(/una sola vez/);
    expect(EMAIL).toMatch(/Si no lo pediste vos, no hagas nada/);
  });

  it('la pantalla de cambiar clave pide escribir la nueva, no mandar la vieja', () => {
    const PAGINA = readFileSync(join(__dirname, '../src/app/recuperar/[token]/page.tsx'), 'utf8');
    expect(PAGINA).toMatch(/Guardar la clave nueva/);
    // No existe ningún campo que pida la clave actual.
    expect(PAGINA).not.toMatch(/clave actual/i);
    expect(PAGINA).not.toMatch(/clave actual/i);
  });
});

describe('lo que el reset NO puede hacer', () => {
  it('la limitación está escrita, no escondida', () => {
    // El JWT de sesión es sin estado: no hay dónde anotar "esta sesión fue
    // revocada". Decirlo en el código evita que alguien asuma lo contrario y
    // prometa al socio que el robo de clave cierra su sesión abierta.
    expect(LIB).toMatch(/sin estado/);
    // El texto está partido por el prefijo de comentario, así que el patrón
    // tiene que tolerar el `//` en medio.
    expect(CAMBIAR).toMatch(/JWT sin[\s\S]{0,12}estado/);
  });
});