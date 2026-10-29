import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Reglas del alta de un jugador y su verificación.
 *
 * El caso que las motivó: el padre crea la cuenta del hijo, el correo se pierde
 * o el chico abre el enlace días después, y la cuenta queda bloqueada sin que
 * nadie pueda destrabarla desde la familia.
 */

const leer = (ruta: string) => readFileSync(join(__dirname, '..', ruta), 'utf8');

const VERIFICACION = leer('src/lib/verification.ts');
const REGISTRO = leer('src/app/api/auth/register/route.ts');
const ENDPOINT = leer('src/app/api/user/verificacion-hijo/route.ts');

describe('verificación del jugador', () => {
  it('el enlace dura una semana, no un día', () => {
    expect(VERIFICACION).toMatch(/TTL_DIAS = 7/);
    expect(VERIFICACION).toMatch(/TTL_HORAS = TTL_DIAS \* 24/);
  });

  it('el alta avisa si el correo del hijo salió o falló', () => {
    // Antes el resultado del envío se ignoraba: la cuenta quedaba bloqueada y
    // la pantalla decía "revisá tu correo" sin saber si había salido.
    expect(REGISTRO).toMatch(/hijoEnvio = await enviarVerificacion/);
    expect(REGISTRO).toMatch(/childVerificationSent/);
    expect(REGISTRO).toMatch(/No se pudo enviar la verificación al hijo/);
  });

  it('el padre solo reenvía a un hijo vinculado y sin verificar', () => {
    expect(ENDPOINT).toMatch(/requireAuth\(\['socio_benefactor'\]\)/);
    expect(ENDPOINT).toMatch(
      /f\.padre_perfil_id = \? AND f\.deportista_perfil_id = \?/
    );
    expect(ENDPOINT).toMatch(/if \(hijo\.email_verificado\)/);
  });

  it('un error real de envío no expone el token en la respuesta', () => {
    // Solo el modo dev (sin API key) devuelve el link en pantalla.
    expect(VERIFICACION).toMatch(
      /devToken: motivo === 'sin-key' \? token : undefined/
    );
  });
});
