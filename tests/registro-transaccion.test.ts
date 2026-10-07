import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validarConsentimientos } from '@/lib/consentimientos';

const REGISTRO = readFileSync(
  join(__dirname, '../src/app/registro/page.tsx'),
  'utf8'
);
const RUTA = readFileSync(
  join(__dirname, '../src/app/api/auth/register/route.ts'),
  'utf8'
);

/**
 * El alta de un padre con su hijo a cargo escribía en cinco tablas SIN
 * transacción, y mandaba las finalidades del padre y del hijo en una sola
 * lista mezclada. Los dos bugs salieron de lo mismo: tratar el alta como una
 * sola operación indivisible cuando son dos personas con datos distintos.
 */
describe('alta de socio benefactor con hijo a cargo', () => {
  it('las finalidades del hijo van en su propio campo, no mezcladas con las del padre', () => {
    // La unión es lo que rompía: el backend no podía saber de quién era cada
    // casilla, así que una del padre contaba como del hijo.
    expect(REGISTRO).not.toMatch(/\[\.\.\.consentimientos,\s*\.\.\.consentimientosHijo\]/);
    expect(REGISTRO).toContain('payload.consentimientosHijo = consentimientosHijo');

    // Y el backend tiene que leerlas de campos distintos.
    expect(RUTA).toContain('consentimientosHijoRaw');
    const hijo = RUTA.slice(RUTA.indexOf('consHijo = validarConsentimientos'));
    expect(hijo.slice(0, 400)).toContain('consentimientosHijoRaw');
  });

  it('el padre que marca una finalidad para si mismo no bloquea el alta del hijo', () => {
    // Repro del bug: con la lista mezclada, esta llamada devolvía 400.
    const marcadasDelPadre = ['documentacion_dni', 'datos_deportivos'];
    const marcadasDelHijo: string[] = [];

    const r = validarConsentimientos({
      consentimiento: { marcadas: marcadasDelHijo },
      menor: { nombre: 'Hijo', fechaNacimiento: '2015-04-10', opinion: 'en_contra' },
      vinculo: 'madre',
      esAltaDeMenor: true,
    });

    expect(r.ok).toBe(true);

    // Y el veto sigue vigente cuando la finalidad ES del hijo: separar las
    // listas no puede servir de puerta para registrar al menor en contra de su
    // opinión.
    const veda = validarConsentimientos({
      consentimiento: { marcadas: marcadasDelPadre },
      menor: { nombre: 'Hijo', fechaNacimiento: '2015-04-10', opinion: 'en_contra' },
      vinculo: 'madre',
      esAltaDeMenor: true,
    });
    expect(veda.ok).toBe(false);
  });

  it('las escrituras del alta van dentro de una transacción', () => {
    expect(RUTA).toContain('transaccion(');

    // El padre y el hijo tienen que escribirse con la MISMA conexión, no con el
    // pool: un INSERT por el pool se confirma solo y el rollback no lo alcanza.
    const bloque = RUTA.slice(RUTA.indexOf('transaccion(async (conn)'));
    expect(bloque).toContain('conn.execute');

    // No puede quedar ni un `insert(` (que usa el pool) dentro de la transacción.
    expect(bloque).not.toMatch(/\bawait insert\(/);
  });

  it('el correo se manda despues del commit, no dentro de la transacción', () => {
    const finDeTransaccion = RUTA.indexOf('return { tokenPadre, tokenHijo };');
    const envio = RUTA.indexOf('enviarVerificacion({');
    expect(finDeTransaccion).toBeGreaterThan(-1);
    // Mandar el correo desde adentro dejaría la transacción abierta durante una
    // llamada a la red, y un email que salió no se puede deshacer con rollback.
    expect(envio).toBeGreaterThan(finDeTransaccion);
  });

  it('la fecha de nacimiento del hijo es obligatoria solo si se lo esta dando de alta', () => {
    // Con `required` fijo se le pediría la fecha a un padre que solo quiere su
    // propia cuenta: el bloque se renderiza para todo benefactor.
    expect(REGISTRO).toContain('required={cargaHijo}');
    expect(REGISTRO).toContain('const cargaHijo =');
  });
});