import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fechaNacimientoValida } from '@/lib/consentimientos';

const REGISTRO = readFileSync(join(__dirname, '../src/app/registro/page.tsx'), 'utf8');
const PANTALLA = readFileSync(
  join(__dirname, '../src/app/admin/privacidad/consentimientos/page.tsx'),
  'utf8'
);
const RUTA = readFileSync(
  join(__dirname, '../src/app/api/admin/consentimientos/route.ts'),
  'utf8'
);

describe('fecha de nacimiento en la bandeja de consentimientos', () => {
  it('la pantalla tiene un campo para cargarla', () => {
    expect(PANTALLA).toContain('accion: \'fecha_nacimiento\'');
    expect(PANTALLA).toContain('Guardar fecha');
  });

  it('no se puede registrar un consentimiento sin fecha cargada', () => {
    // Sin fecha, `menor_al_otorgar` queda en false y el club anota "otorgado,
    // persona adulta" sobre alguien que puede tener 12 años. Un registro así no
    // puede sostener nada.
    expect(PANTALLA).toContain('disabled={ocupado || !detalle.persona.fecha_nacimiento}');
    expect(PANTALLA).toMatch(/Cargá primero la fecha de nacimiento/);
  });

  it('la ruta valida la fecha y avisa si no hay ficha', () => {
    expect(RUTA).toContain('fechaNacimientoValida(fecha_nacimiento)');
    expect(RUTA).toContain('sinFicha: true');
  });

  it('rechaza fechas imposibles o imposibles de edad', () => {
    expect(fechaNacimientoValida('2015-04-10')).toBe(true);
    expect(fechaNacimientoValida('2015-02-31')).toBe(false); // 31 de febrero
    expect(fechaNacimientoValida('')).toBe(false);
    expect(fechaNacimientoValida('1920-01-01')).toBe(false); // > 100 años
    expect(fechaNacimientoValida(null)).toBe(false);
  });
});

describe('registro en pasos', () => {
  it('son tres pasos para un benefactor y dos para un cadete', () => {
    // El paso del hijo solo existe para quien puede dar de alta a un jugador:
    // un cadete no tiene a quién inscribir.
    expect(REGISTRO).toContain("['cuenta', 'hijo', 'consentimientos']");
    expect(REGISTRO).toContain("['cuenta', 'consentimientos']");
  });

  it('cada paso valida lo suyo antes de avanzar', () => {
    // Con los campos repartidos, el `required` del navegador solo miraría lo
    // que está en pantalla. La validación es del paso.
    expect(REGISTRO).toContain('function bloqueo()');
    expect(REGISTRO).toMatch(/if \(paso === 'cuenta'\)/);
    expect(REGISTRO).toMatch(/if \(paso === 'hijo' && cargaHijo\)/);
    expect(REGISTRO).toMatch(/if \(paso === 'consentimientos' && !aceptaPrivacidad\)/);
  });

  it('no se puede pasar del paso del hijo sin email, contraseña ni fecha', () => {
    // Las tres cosas se descubrían del lado del servidor, con un mensaje que no
    // señalaba el campo.
    expect(REGISTRO).toMatch(/!form\.hijo_email\.trim\(\)/);
    expect(REGISTRO).toMatch(/form\.hijo_password\.length < 6/);
    expect(REGISTRO).toMatch(/!form\.hijo_fecha_nacimiento/);
  });

  it('el email del jugador no puede ser el mismo que el del titular', () => {
    // El backend lo rechaza, pero avisarlo acá evita un viaje redondo.
    expect(REGISTRO).toMatch(/El email del hijo tiene que ser distinto al tuyo/);
  });

  it('el bloque del jugador deja de mostrarse siempre para un benefactor', () => {
    // Antes el bloque entero se renderizaba siempre, con la etiqueta "opcional"
    // adelante: se veía tanto si se queria dar de alta a alguien como si no.
    expect(REGISTRO).toMatch(/paso === 'hijo' &&/);
    expect(REGISTRO).toContain('{cargaHijo && (');
  });

  it('sigue mandando las finalidades del jugador en su propio campo', () => {
    // La separación de consentimientos es lo que impide que una casilla del
    // padre cuente como del hijo. No se puede perder al reestructurar.
    expect(REGISTRO).toContain('payload.consentimientosHijo = consentimientosHijo');
    expect(REGISTRO).not.toMatch(/\[\.\.\.consentimientos,\s*\.\.\.consentimientosHijo\]/);
  });

  it('se puede volver al paso anterior', () => {
    expect(REGISTRO).toContain('function retroceder()');
    expect(REGISTRO).toContain('Atrás');
  });
});