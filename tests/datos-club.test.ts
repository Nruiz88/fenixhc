import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CLUB_INFO } from '@/lib/constants';

// Datos de relleno que se colaron en el sitio mas de una vez. No son un
// detalle: el club publico nombre, domicilio, telefono y correo, y en cada
// ocasion quedo una copia vieja en alguna pagina.
//
// El sintoma siempre es el mismo. Se corrige una pagina, el dato queda bien
// ahi, y el sitio sigue mostrando otra direccion en otra pagina. Pasó con
// "Av. Libertador 1234, CABA" y con el +54 11 5551 2345.
//
// Estos tests barrean todo src/ para que un dato inventado no pueda volver a
// publicarse sin que la suite lo marque.

const SRC = join(process.cwd(), 'src');

// Datos que ya se corrigieron y no deben reaparecer en ningun archivo de src.
const FICTICIOS: Array<{ patron: RegExp; motivo: string }> = [
  { patron: /Av\.\s*Libertador/i, motivo: 'domicilio de ejemplo, el club queda en Castelli 4306' },
  { patron: /info@clubhockey/i, motivo: 'correo de ejemplo, el club usa accfenixroller@gmail.com' },
  { patron: /clubhockey\.com\.ar/i, motivo: 'dominio de ejemplo, el club es fenixhockey.com.ar' },
  { patron: /5551[\s-]?2345/, motivo: 'telefono de ejemplo, el club usa +54 9 299 416-9607' },
  { patron: /541155512345/, motivo: 'WhatsApp de ejemplo en formato wa.me' },
  { patron: /91x55/i, motivo: 'medidas de una cancha propia, el club entrena en Ruca Che' },
  { patron: /C[eé]sped\s+sint[eé]tico/i, motivo: 'cancha propia que el club no tiene' },
  { patron: /sobre\s*hierba/i, motivo: 'deporte que el club no practica' },
  { patron: /\b1995\b/, motivo: 'fundacion inventada, el club se fundo en 2026' },
  { patron: /25\s*a[nñ]os\s+de\s+historia/i, motivo: 'antiguedad inventada' },
  { patron: /admin@club\.com/i, motivo: 'correo de ejemplo, no es del club' },
  { patron: /\+54\s*11\b/, motivo: 'prefijo de Buenos Aires, el club esta en Neuquen' },
  // "CABA" sola, sin domicilio: aparecio en el placeholder de un input de
  // contacto y en un comentario de ejemplo de rateLimit.
  { patron: /\bCABA\b/, motivo: 'referencia a Ciudad de Buenos Aires, el club esta en Neuquen' },
];

function archivosSrc(dir: string = SRC, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      archivosSrc(p, acc);
    } else if (/\.(ts|tsx)$/.test(e) && !e.endsWith('.d.ts')) {
      acc.push(p);
    }
  }
  return acc;
}

/** Quita comentarios para noemarker datos que solo se mencionan al documentar. */
function sinComentarios(c: string): string {
  return c
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('datos de contacto del club', () => {
  it('CLUB_INFO tiene los datos reales', () => {
    expect(CLUB_INFO.address).toBe('Castelli 4306, Neuquén Capital');
    expect(CLUB_INFO.phone).toBe('+54 9 299 416-9607');
    expect(CLUB_INFO.email).toBe('accfenixroller@gmail.com');
    expect(CLUB_INFO.foundedYear).toBe(2026);
  });

  it('el WhatsApp de CLUB_INFO corresponde al teléfono real', () => {
    // El enlace se deriva del teléfono, así que no pueden desincronizarse.
    // Se compara sin el 9 de móvil, que en wa.me no va.
    const soloDigitos = CLUB_INFO.whatsapp.replace(/\D/g, '');
    const delTelefono = CLUB_INFO.phone.replace(/\D/g, '').replace(/^549/, '54');
    expect(soloDigitos).toBe(delTelefono);
  });

  it('el enlace de WhatsApp no queda con el 9 de móvil', () => {
    // wa.me con el 9 de más abre un número inexistente y el club pierde los
    // mensajes. Es el error clásico al copiar el número que figura en la web.
    expect(CLUB_INFO.whatsapp).not.toContain('/549');
    expect(CLUB_INFO.whatsapp).toBe('https://wa.me/542994169607');
  });

  it('el domicilio y la sede de entrenamiento no son lo mismo', () => {
    // Son dos cosas distintas y se confundieron: el club no es dueño de Ruca
    // Che, entrena ahí. Por eso address y trainingVenue son campos distintos.
    expect(CLUB_INFO.trainingVenue).toBe('Estadio Ruca Che');
    expect(CLUB_INFO.address).not.toContain('Ruca Che');
  });
});

describe('no quedan datos de relleno en src/', () => {
  const archivos = archivosSrc();

  it('el barrido encuentra archivos (si no, no está Chequeando nada)', () => {
    // Guarda contra un test que pasa en verde porque el glob no matchea nada.
    expect(archivos.length).toBeGreaterThan(100);
  });

  for (const { patron, motivo } of FICTICIOS) {
    it(`ningún archivo usa ${patron} (${motivo})`, () => {
      const infractores: string[] = [];
      for (const f of archivos) {
        const original = readFileSync(f, 'utf8');
        const contenido = sinComentarios(original);
        if (patron.test(contenido)) {
          const linea = contenido.split('\n').findIndex((l) => patron.test(l)) + 1;
          infractores.push(`${relative(SRC, f)}:${linea}`);
        }
      }
      expect(infractores).toEqual([]);
    });
  }
});

describe('los correos salen de un remitente que el club puede autenticar', () => {
  it('el remitente por defecto usa el dominio verificado en Resend', () => {
    // Si EMAIL_FROM faltara, se usa este valor. Antes era clubhockey.com.ar,
    // un dominio inexistente: Resend rechazaba el envío y el alta de socios
    // quedaba sin correo de verificación.
    const email = readFileSync(join(SRC, 'lib', 'email.ts'), 'utf8');
    const fallback = /EMAIL_FROM\s*\|\|\s*'([^']+)'/.exec(email)?.[1];
    expect(fallback).toBeTruthy();
    expect(fallback).toContain('@fenixhockey.com.ar');
  });
});

describe('los datos del club no están escritos a mano fuera de la fuente', () => {
  // La causa raíz de los datos viejos: cada página tenía su copia. Por eso
  // corregir una no alcanzaba. CLUB_INFO tiene que ser el único lugar.
  const archivos = archivosSrc();

  it('el correo del club solo se escribe en la fuente y en el remitente', () => {
    // Permitidos: la fuente (constants.ts) y lib/email.ts, que define el
    // remitente. Cualquier otro archivo debería leer CLUB_INFO.email.
    const permitidos = new Set([
      join('lib', 'constants.ts'),
      join('lib', 'email.ts'),
    ]);
    const infractores: string[] = [];
    for (const f of archivos) {
      const rel = relative(SRC, f);
      if (permitidos.has(rel)) continue;
      if (readFileSync(f, 'utf8').includes('accfenixroller@gmail.com')) infractores.push(rel);
    }
    expect(infractores).toEqual([]);
  });
});