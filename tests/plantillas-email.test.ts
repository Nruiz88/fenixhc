import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Plantillas de Resend con fallback al HTML embebido.
 *
 * Los tres HTML de `emails/` son la fuente de la verdad para poder reproducir
 * o auditar un correo; el dashboard de Resend es donde la directiva los edita.
 * Los dos caminos tienen que estarSYNC: si cambia un texto, cambia en el
 * archivo, no solo en el dashboard.
 */

const EMPRESA = 'Fenix Roller Hockey';

const PLANTILLAS = [
  { archivo: 'verificacion.html', variables: ['{{nombre}}', '{{link}}'] },
  { archivo: 'recuperacion.html', variables: ['{{nombre}}', '{{link}}', '{{minutos}}'] },
  { archivo: 'aviso-cuota.html', variables: ['{{nombre}}', '{{mensaje}}'] },
] as const;

describe('plantillas de correo', () => {
  it('los tres archivos existen y declaran las variables que el código manda', () => {
    for (const { archivo, variables } of PLANTILLAS) {
      const html = readFileSync(join(__dirname, '../emails', archivo), 'utf8');
      for (const v of variables) {
        expect(html, `${archivo} deberia usar ${v}`).toContain(v);
      }
    }
  });

  it('el aviso de cuota conserva los saltos de linea del mensaje', () => {
    // `mensaje` llega con \n, no con <br>. Sin `white-space: pre-line` el
    // correo entero llega en una sola linea y hay que adivinar donde corta.
    const html = readFileSync(join(__dirname, '../emails/aviso-cuota.html'), 'utf8');
    const i = html.lastIndexOf('{{mensaje}}');
    expect(i).toBeGreaterThan(0);
    expect(html.slice(i - 400, i)).toContain('white-space: pre-line');
  });

  it('las tres dicen de que club son, sin depender de una imagen', () => {
    // Con el bloqueo de imagens activo no se ve ningun logo. Si la franja de
    // arriba queda en blanco, el correo no dice de donde viene.
    for (const { archivo } of PLANTILLAS) {
      const html = readFileSync(join(__dirname, '../emails', archivo), 'utf8');
      expect(html, `${archivo} no menciona la empresa`).toContain(EMPRESA);
    }
  });

  it('el correo de recuperacion conserva las cuatro frases que evitan el phishing', () => {
    // Si alguien edita la plantilla en el dashboard y saca una de estas, el
    // correo vuelve a ser el anzuelo que el club temia.
    const html = readFileSync(join(__dirname, '../emails/recuperacion.html'), 'utf8');
    const texto = html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');

    expect(texto).toContain('vence en');
    expect(texto).toContain('una sola vez');
    expect(texto).toMatch(/no lo pediste|no hiciste/i);
    expect(texto).toMatch(/te va a pedir tu clave por correo, nunca/i);
  });

  it('cada enlace va acompanado del link en texto plano', () => {
    // Si el boton no se ve o no funciona, la persona necesita una salida.
    for (const { archivo } of PLANTILLAS.filter((p) => p.archivo !== 'aviso-cuota.html')) {
      const html = readFileSync(join(__dirname, '../emails', archivo), 'utf8');
      const ocurrencias = html.split('{{link}}').length - 1;
      expect(ocurrencias, `${archivo} deberia repetir {{link}}`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('fallback cuando no hay plantilla cargada', () => {
  it('idPlantilla devuelve undefined si la variable no esta', async () => {
    // Es lo que hace segura la funcion: sin ID se usa el HTML embebido. El
    // enlace de verificacion y el de recuperacion son lo unico que activa una
    // cuenta, asi que ese camino no puede romperse.
    const antes = process.env.RESEND_TEMPLATE_VERIFICACION;
    delete process.env.RESEND_TEMPLATE_VERIFICACION;

    const { idPlantilla } = await import('@/lib/email');
    expect(idPlantilla('RESEND_TEMPLATE_VERIFICACION')).toBeUndefined();

    process.env.RESEND_TEMPLATE_VERIFICACION = '   '; // solo espacios
    expect(idPlantilla('RESEND_TEMPLATE_VERIFICACION')).toBeUndefined();

    process.env.RESEND_TEMPLATE_VERIFICACION = 'abc-123';
    expect(idPlantilla('RESEND_TEMPLATE_VERIFICACION')).toBe('abc-123');

    if (antes === undefined) delete process.env.RESEND_TEMPLATE_VERIFICACION;
    else process.env.RESEND_TEMPLATE_VERIFICACION = antes;
  });

  it('los tres correos pasan la plantilla con su id y sus variables', () => {
    const email = readFileSync(join(__dirname, '../src/lib/email.ts'), 'utf8');
    expect(email).toContain('plantilla?: Plantilla');

    const verificacion = readFileSync(join(__dirname, '../src/lib/verification.ts'), 'utf8');
    expect(verificacion).toContain('RESEND_TEMPLATE_VERIFICACION');

    const recuperacion = readFileSync(join(__dirname, '../src/lib/recuperacion.ts'), 'utf8');
    expect(recuperacion).toContain('RESEND_TEMPLATE_RECUPERACION');

    const avisos = readFileSync(join(__dirname, '../src/lib/avisos-db.ts'), 'utf8');
    expect(avisos).toContain('RESEND_TEMPLATE_AVISO');
  });
});