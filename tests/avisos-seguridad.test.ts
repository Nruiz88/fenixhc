import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emailAviso } from '@/lib/email';

// Avisar a las familias es la pantalla que escribe en nombre del club. Lo
// que se fija acá es que no pueda:
//   - mandar sin el cargo que corresponde
//   - inventar la cifra que se le pide al socio
//   - mandar un aviso a alguien que ya está al día

const RUTA = readFileSync(join(__dirname, '../src/app/api/avisos/route.ts'), 'utf8');
const DB = readFileSync(join(__dirname, '../src/lib/avisos-db.ts'), 'utf8');
const SQL = readFileSync(join(__dirname, '../mariadb/13_avisos_familias.sql'), 'utf8');
const MANUAL = readFileSync(join(__dirname, '../src/lib/manual.ts'), 'utf8');

/** El código sin comentarios, para no encontrar en la explicación lo buscado. */
const codigo = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

describe('quién puede mandar avisos', () => {
  it('las dos operaciones exigen la capacidad, no solo el GET', () => {
    // El filtro solo en el GET deja el POST abierto: era el error clásico de
    // poner la autorización donde se lee y no donde se escribe.
    const permisos = codigo(RUTA).match(/puede\(user\.rol, 'comunicar_padres'\)/g) ?? [];
    expect(permisos.length).toBeGreaterThanOrEqual(2);
  });

  it('devuelve 403 con el nombre de la capacidad', () => {
    expect(RUTA).toMatch(/sinPermiso/);
    expect(RUTA).toMatch(/status: 403/);
  });

  it('no acepta un rol del cuerpo de la petición', () => {
    // `rol` tiene que salir del token verificado, nunca de lo que mande el
    // navegador.
    expect(RUTA).toMatch(/const user = await getCurrentUser/);
    expect(codigo(RUTA)).not.toMatch(/body\.rol|rol:\s*leido\.data\.rol/);
  });
});

describe('la cifra la calcula el servidor, no el que manda', () => {
  it('recalcula la deuda antes de enviar', () => {
    // Si aceptara el monto del cliente, un aviso podría pedir cualquier cifra.
    expect(RUTA).toMatch(/agruparParaAvisar/);
  });

  it('no confía en el texto que trae el cliente para la cifra', () => {
    // El mensaje sí se acepta: es un texto que escribe una persona. Lo que no
    // se acepta es el número que ese texto dice.
    expect(RUTA).toMatch(/mensaje/);
    expect(codigo(RUTA)).not.toMatch(/montoTotal:\s*Number\(/);
  });

  it('se corta si el socio ya no debe nada', () => {
    // Mandar un aviso a una familia al día es la peor forma de que alguien
    // deje de leer los avisos.
    expect(RUTA).toMatch(/409/);
    expect(RUTA).toMatch(/no tiene nada pendiente/);
  });
});

describe('lo que queda registrado', () => {
  it('guarda el texto exacto que salió', () => {
    // Si mañana cambia la plantilla, el registro tiene que seguir diciendo lo
    // que se dijo en marzo.
    expect(SQL).toMatch(/detalle\s+TEXT NOT NULL/);
    expect(DB).toMatch(/mensaje,\s*\n\s*familia\.cuotas/);
  });

  it('congela el monto, porque el recargo sigue subiendo', () => {
    expect(SQL).toMatch(/monto_total/);
    expect(DB).toMatch(/montoTotal \|\| null/);
  });

  it('guarda las cuotas concretas del aviso', () => {
    expect(SQL).toMatch(/cuotas\s+TEXT/);
    expect(DB).toMatch(/cuotas\.map\(\(c\) => c\.id\)\.join\(','\)/);
  });

  it('distingue "se pidió el correo" de "el correo salió"', () => {
    // Sin esto, el club cree que a una familia le llegó un aviso que en realidad no
    // salió porque falta la API key.
    expect(SQL).toMatch(/canal/);
    expect(SQL).toMatch(/resultado/);
    expect(DB).toMatch(/'sin-key'/);
  });

  it('registra quién mandó', () => {
    expect(SQL).toMatch(/enviado_por CHAR\(36\) NOT NULL/);
    expect(DB).toMatch(/enviadoPor/);
  });
});

describe('la notificación del portal', () => {
  it('una por familia, no una por cuota', () => {
    // Una familia con dos hijos y dos cuotas vencidas recibe un aviso.
    expect(DB).toMatch(/Una notificación por familia, no una por cuota/);
  });

  it('el insert de la lista de lectura tolera repetidos', () => {
    // `notificaciones_usuarios` tiene UNIQUE (notificacion_id, usuario_id): un
    // ON DUPLICATE KEY evita el 1062 si se reintenta.
    expect(DB).toMatch(/ON DUPLICATE KEY UPDATE leida = 0/);
  });

  it('va al rol del socio responsable, no al del jugador', () => {
    // A un padre de 14 años no se le manda nada.
    expect(DB).toMatch(/socio_benefactor/);
  });
});

describe('el correo no promete lo que no hace', () => {
  it('la pantalla avisa cuando Resend no está configurado', () => {
    // Callarlo y mandar solo al portal sería hacer creer que salió un correo.
    expect(RUTA).toMatch(/RESEND_API_KEY/);
    expect(RUTA).toMatch(/correoHabilitado/);
  });

  it('sin Resend el aviso va igual al portal', () => {
    // El aviso no puede depender del correo: en el club todavía no hay Resend y
    // esta es la función que resuelve el problema.
    expect(DB).toMatch(/= 'omitido'/);
  });

  it('el texto del aviso se escapa antes de ir al HTML', () => {
    const e = emailAviso({
      nombre: 'Ana',
      mensaje: 'Hola "Ana" & <script>alert(1)</script>',
    });

    expect(e.html).not.toContain('<script>');
    expect(e.html).toContain('&lt;script&gt;');
    expect(e.html).toContain('&amp;');
    // El `text` va sin escapar porque no es HTML: ahí los acentos y las
    // comillas van bien.
    expect(e.text).toContain('&');
  });

  it('el correo no pide datos que habiliten el robo', () => {
    // Un correo que pide la clave por mail sirve para quitársela a alguien.
    const e = emailAviso({ nombre: 'Ana', mensaje: 'Tenés una cuota pendiente.' });

    expect(e.text.toLowerCase()).not.toContain('clave');
    expect(e.text.toLowerCase()).not.toContain('contraseña');
  });
});

describe('la pantalla es alcanzable por el manual', () => {
  it('explica qué es una cuota vencida', () => {
    // La regla "vencida = con recargo" no es obvia. Sin esta tarea, la primera
    // pregunta de quien use la pantalla es por qué no aparece un socio.
    expect(MANUAL).toMatch(/recargo aplicado/);
    expect(MANUAL).toMatch(/primer hito/);
  });
});