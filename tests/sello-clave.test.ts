import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import jwt from 'jsonwebtoken';

// Sellar la clave dentro del token es lo que hace revocables las sesiones sin
// tabla de sesiones. Si el sello falta o no se compara, el robo de clave deja
// abierta la sesión del ladrón durante 7 días, que es el problema que motiva
// todo esto.
//
// Lo que se juzga acá:
//
//   - Que un token sin sello NO se acepte. Aceptarlo dejaría abierta la puerta
//     de los tokens más viejos, que son los que un ladrón viene teniendo desde
//     antes de que existiera esta protección.
//   - Que la comparación contra la base esté en la puerta de los DATOS y no en
//     el proxy: el proxy es sincrónico y corre en cada request, no puede
//     consultar la base. Pero si la comparación quedara solo en el proxy,
//     bastaría con que el proxy seEQUIVOCARA para que el token viejo pasara.
//   - Que cambiar la clave se marque SIEMPRE, y que el propio usuario que la
//     cambia no quede deslogueado por su propio cambio.
//
// Las reglas puras se prueban con tokens reales. La consulta a la base no se
// puede probar sin MariaDB, así que se fija por la FORMA del código.

const leer = (ruta: string) => readFileSync(join(__dirname, '..', ruta), 'utf8');

const AUTH = leer('/src/lib/auth.ts');
const LOGIN = leer('/src/app/api/auth/login/route.ts');
const PASSWORD = leer('/src/app/api/auth/password/route.ts');
const SESION = leer('/src/lib/sesion.ts');

/**
 * El código sin comentarios.
 *
 * Hay comentarios que nombran justamente lo que no se debe hacer —"POR QUÉ NO
 * SE CACHEA"—. Buscar esas palabras en el archivo entero daría un aprobado
 * falso o, peor, obligaría a escribir los comentarios en clave inglesa para
 * que el test no los confunda con código.
 */
const sinComentarios = (texto: string) =>
  texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

const SECRET = 'secreto-de-prueba-para-el-sello-de-clave';
const USUARIO = {
  id: 'u1',
  rol: 'admin' as const,
  nombre: 'Ana',
  apellido: 'Perez',
  email: 'ana@club.com',
};

let auth: typeof import('@/lib/auth');

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  auth = await import('@/lib/auth');
});

afterAll(() => {
  delete process.env.JWT_SECRET;
});

describe('el sello de clave', () => {
  it('el token lleva dentro el momento del ultimo cambio de clave', () => {
    const token = auth.createToken(USUARIO, new Date('2026-01-15T10:00:00Z'));
    const payload = jwt.decode(token) as Record<string, unknown>;

    expect(payload.pc).toBe(
      Math.floor(new Date('2026-01-15T10:00:00Z').getTime() / 1000)
    );
  });

  it('acepta las tres formas que puede devolver la base', () => {
    // El driver devuelve DATE como objeto Date, pero un SELECT crudo puede
    // devolver texto, y un `new Date(undefined)` da Invalid Date. Un `pc: NaN`
    // pasa cualquier comparación: o sea, ningún token se revocaría nunca, sin
    // que se note.
    const esperado = Math.floor(new Date('2026-01-15T10:00:00Z').getTime() / 1000);

    expect(auth.aSegundos(new Date('2026-01-15T10:00:00Z'))).toBe(esperado);
    expect(auth.aSegundos('2026-01-15T10:00:00Z')).toBe(esperado);
    expect(auth.aSegundos(1768471200)).toBe(1768471200);

    // Lo indefinido y lo invalido dan 0, nunca NaN.
    expect(auth.aSegundos(null)).toBe(0);
    expect(auth.aSegundos(undefined)).toBe(0);
    expect(auth.aSegundos('no es una fecha')).toBe(0);
    expect(auth.aSegundos(new Date('no es una fecha'))).toBe(0);
  });

  it('un token sin sello se rechaza', () => {
    const sinSello = jwt.sign(USUARIO, SECRET, { expiresIn: '1h' });

    expect(auth.verifyToken(sinSello)).toBeNull();
  });

  it('un sello que no es un numero se rechaza', () => {
    // Un `pc` en texto o NaN no se puede comparar contra la base. Aceptarlo
    // sería aceptar un token que no se puede revocar.
    for (const pc of ['1768471200', NaN, null, {}]) {
      const raro = jwt.sign({ ...USUARIO, pc }, SECRET, { expiresIn: '1h' });
      expect(auth.verifyToken(raro), `pc = ${String(pc)}`).toBeNull();
    }
  });

  it('un token con sello bien formado se verifica', () => {
    const token = auth.createToken(USUARIO, new Date('2026-01-15T10:00:00Z'));
    const user = auth.verifyToken(token);

    expect(user?.id).toBe('u1');
    expect(user?.rol).toBe('admin');
  });
});

describe('donde vive la comparacion con la base', () => {
  it('esta en la puerta de los datos, no en el proxy', () => {
    // El proxy corre en cada request y verifyToken es sincronica: no puede
    // consultar la base. getCurrentUser es async y es la puerta real, porque
    // todos los datos autenticados entran por /api con requireAuth.
    expect(AUTH).toMatch(/getCurrentUser[\s\S]{0,3000}SELECT password_changed_at/);
  });

  it('verifyToken no toca la base', () => {
    // Si la revocacion estuviera en verifyToken, habria que hacerla async y el
    // proxy dejaria de funcionar, o peor: alguien la saca por ser "solo una
    // consulta mas" y la revocacion desaparece en silencio.
    const cuerpo = AUTH.slice(
      AUTH.indexOf('export function verifyToken'),
      AUTH.indexOf('export async function getCurrentUser')
    );

    expect(sinComentarios(cuerpo)).not.toMatch(/await|queryOne|query\(|SELECT/i);
  });

  it('descarta el token cuyo sello es anterior al de la base', () => {
    // La regla: si la base se actualizó DESPUÉS de que el token se emitió, el
    // token nació de una clave que ya no existe.
    expect(AUTH).toMatch(/aSegundos\(actual\.pc\) > user\.pc/);
  });

  it('no cachea la comprobacion', () => {
    // Un caché de 30 segundos abriría una ventana en la que la revocación no
    // surte efecto: se cambia la clave y el ladrón entra treinta segundos más.
    // Una consulta por primary key es sub-milisegundo. Optimizar esto despues
    // vale, pero solo con la basura a la vista.
    const cuerpo = AUTH.slice(
      AUTH.indexOf('export async function getCurrentUser'),
      AUTH.indexOf('export async function requireAuth')
    );

    expect(sinComentarios(cuerpo)).not.toMatch(/new Map|cache|CACHE|TtlMap|setTimeout|TTL/i);
  });

  it('un token de un usuario que ya no existe no sirve', () => {
    // Si el usuario desaparece, el token no puede autenticar a nadie.
    expect(AUTH).toMatch(/if \(!actual\) return null/);
  });
});

describe('los tres caminos que cambian la clave', () => {
  it('el login sella el token con el valor de la base', () => {
    // Con un valor supuesto en vez de leido, un reloj desfasado entre Node y
    // MariaDB desloguearia al propio usuario que acaba de entrar.
    expect(LOGIN).toMatch(/password_changed_at FROM usuarios/);
    expect(sinComentarios(LOGIN)).toMatch(/createToken\([\s\S]{0,300}user\.password_changed_at/);
  });

  it('cambiar la clave renueva el sello siempre', () => {
    // "Siempre" incluye cuando la clave nueva resulta ser la misma: si alguien
    // tiene el dispositivo abierto y la clave se cambia desde otro lado, esa
    // sesion tiene que morir igual.
    expect(PASSWORD).toMatch(/SET password_hash = \?, password_changed_at = NOW\(\)/);
  });

  it('el que cambia la clave no se desloguea a si mismo', () => {
    // El token reemitido tiene que llevar el sello NUEVO. Si reusara el viejo,
    // cambiar la clave seria un cierre de sesion para uno mismo.
    expect(PASSWORD).toMatch(/SELECT password_changed_at FROM usuarios WHERE id/);
    expect(PASSWORD).toMatch(/createToken\(auth\.user, sellado\?\.password_changed_at\)/);
  });
});

describe('la sesion caida se ve como sesion caida', () => {
  it('un 401 manda al login en vez de dejar la pantalla vacia', () => {
    // Con el sello, un 401 pasa en el uso normal: alguien cambia la clave desde
    // el celu y sigue con el navegador abierto. Devolver data null sin mas
    // traduce "tu sesion vencio" por "la pagina esta rota".
    for (const archivo of ['api.ts', 'userQuery.ts']) {
      const codigo = readFileSync(join(__dirname, `../src/lib/${archivo}`), 'utf8');
      const untreated = [...codigo.matchAll(/res\.status === 401\)\s*return/g)];

      expect(untreated, `${archivo} devuelve 401 sin redirigir`).toHaveLength(0);
      expect(codigo).toMatch(/alLogin\(\)/);
    }
  });

  it('redirige una sola vez, aunque el panel cargue cinco tablas en paralelo', () => {
    // Sin la bandera, el login se abriria cinco veces y la ultima navegacion
    // gana.
    expect(SESION).toMatch(/let redirigiendo = false/);
    expect(SESION).toMatch(/if \(redirigiendo\) return/);
  });

  it('el login devuelve a la persona a donde estaba', () => {
    expect(SESION).toMatch(/pathname \+ window\.location\.search/);
    expect(SESION).toMatch(/redirect=/);
  });
});
