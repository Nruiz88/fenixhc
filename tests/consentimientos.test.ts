import { describe, it, expect } from 'vitest';
import {
  edadCumplida,
  fechaMayoria,
  esMenor,
  fechaNacimientoValida,
  esRepresentanteLegitimado,
  opinionVeda,
  validarConsentimientos,
  opinionVeda as op,
  FINALIDADES,
  FINALIDADES_REVOCABLES,
  FINALIDADES_OBLIGATORIAS,
  TODAS_LAS_FINALIDADES,
  EDAD_MAYORIA,
} from '@/lib/consentimientos';

// Estas reglas son las que van a sostener un reclamo. Si una de ellas cambia,
// el club deja de poder responder por qué hizo lo que hizo, así que el
// objetivo de la batería es que quede escrito qué se espera, no solo que el
// código pase.

describe('edad', () => {
  it('cumple años el día exacto, no el promedio', () => {
    // Un pibe que cumple 18 el 3 de marzo es mayor DESDE el 3 de marzo. Si esto
    // se calculara dividiendo días, el club trataría sus datos de menor un día
    // de más, y el día que lo consulte el menor se cae todo.
    const ref = new Date(2026, 2, 3); // 3 de marzo de 2026
    expect(edadCumplida('2008-03-03', ref)).toBe(18);
    expect(edadCumplida('2008-03-04', ref)).toBe(17);
  });

  it('no cumple años un dia antes', () => {
    expect(edadCumplida('2008-03-04', new Date(2026, 2, 3))).toBe(17);
    expect(edadCumplida('2008-03-04', new Date(2026, 2, 4))).toBe(18);
  });

  it('arrastra los meses cortos sin correrse', () => {
    // 29 de febrero: el que nacio en un ano bisiesto cumple el 28 en los que no.
    expect(fechaNacimientoValida('2012-02-29')).toBe(true);
    expect(edadCumplida('2012-02-29', new Date(2026, 1, 27))).toBe(13);
    expect(edadCumplida('2012-02-29', new Date(2026, 1, 28))).toBe(14);
  });

  it('rechaza fechas que no existen', () => {
    // new Date(2026, 1, 31) es 3 de marzo. Si pasara, un 31 de febrero
    // cargado a mano se convertiría en una edad distinta sin avisar.
    expect(fechaNacimientoValida('2026-02-31')).toBe(false);
    expect(fechaNacimientoValida('2026-13-01')).toBe(false);
    expect(fechaNacimientoValida('26-01-01')).toBe(false);
    expect(fechaNacimientoValida('')).toBe(false);
    expect(fechaNacimientoValida(null)).toBe(false);
  });

  it('rechaza edades imposibles', () => {
    expect(fechaNacimientoValida('1920-01-01')).toBe(false);
    expect(fechaNacimientoValida('2026-01-01')).toBe(true);
    expect(fechaNacimientoValida('2020-01-01')).toBe(true);
  });

  it('distingue mayor de menor', () => {
    expect(esMenor('2015-06-01', new Date(2026, 8, 30))).toBe(true);
    expect(esMenor('2000-06-01', new Date(2026, 8, 30))).toBe(false);
    // Sin fecha no se afirma nada: inventar "es menor" sería peor que no saber.
    expect(esMenor(null)).toBeNull();
  });

  it('calcula la fecha en que se alcanza la mayoria', () => {
    const f = fechaMayoria('2010-05-20')!;
    expect(f.getFullYear()).toBe(2028);
    expect(f.getMonth()).toBe(4);
    expect(f.getDate()).toBe(20);
    expect(EDAD_MAYORIA).toBe(18);
  });
});

describe('representacion', () => {
  it('solo padre, madre o tutor son representantes legitimados', () => {
    expect(esRepresentanteLegitimado('padre')).toBe(true);
    expect(esRepresentanteLegitimado('madre')).toBe(true);
    expect(esRepresentanteLegitimado('tutor')).toBe(true);
    expect(esRepresentanteLegitimado('abuela')).toBe(false);
    expect(esRepresentanteLegitimado(null)).toBe(false);
    expect(esRepresentanteLegitimado(undefined)).toBe(false);
  });
});

describe('opinion del menor', () => {
  it('solo la opinion en contra veda', () => {
    expect(opinionVeda('en_contra')).toBe(true);
    expect(opinionVeda('a_favor')).toBe(false);
    // No consultado NO veda: en muchos casos el chico no tiene edad para
    // entenderlo y consultarle seria una violencia.
    expect(opinionVeda('no_consultado')).toBe(false);
    expect(opinionVeda(null)).toBe(false);
  });

  it('op es el mismo export, por si alguien importa los dos nombres', () => {
    expect(op).toBe(opinionVeda);
  });
});

describe('catalogo de finalidades', () => {
  it('la contabilidad nunca depende del consentimiento', () => {
    // Si esto cambia, revocar el consentimiento de un socio le borra los pagos
    // del club y el club queda sin contabilidad.
    expect(FINALIDADES_OBLIGATORIAS).toEqual(['cuotas_contabilidad']);
    expect(FINALIDADES.cuotas_contabilidad.baseLegal).toBe('obligacion_legal');
    expect(FINALIDADES_REVOCABLES).not.toContain('cuotas_contabilidad');
    expect(FINALIDADES_REVOCABLES).not.toContain('inscripcion');
  });

  it('lo que mas pesa para un menor exige consentimiento expreso y su opinion', () => {
    for (const id of ['documentacion_dni', 'datos_deportivos', 'imagenes'] as const) {
      expect(FINALIDADES[id].expreso, id).toBe(true);
      expect(FINALIDADES[id].requiereOpinionMenor, id).toBe(true);
    }
  });

  it('cada finalidad explica que pasa si se dice que no', () => {
    for (const id of TODAS_LAS_FINALIDADES) {
      expect(FINALIDADES[id].siNo.length, id).toBeGreaterThan(20);
      expect(FINALIDADES[id].datos.length, id).toBeGreaterThan(10);
    }
  });
});

describe('validacion del alta', () => {
  const base = {
    consentimiento: { marcadas: [...FINALIDADES_REVOCABLES] },
    menor: { nombre: 'Lautaro', fechaNacimiento: '2014-05-10' },
    vinculo: 'madre',
    esAltaDeMenor: true,
  };

  it('acepta un alta de menor bien formada', () => {
    const r = validarConsentimientos({ ...base, menor: { ...base.menor, opinion: 'a_favor' } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.finalidades).toContain('documentacion_dni');
      expect(r.opinion).toBe('a_favor');
    }
  });

  it('agrega la contabilidad sola, sin casilla', () => {
    const r = validarConsentimientos({ ...base, menor: { ...base.menor, opinion: 'a_favor' } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.finalidades).toContain('cuotas_contabilidad');
  });

  it('exige el vinculo del representante', () => {
    const r = validarConsentimientos({ ...base, vinculo: 'abuela' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/madre, el padre o la persona tutora/);
  });

  it('exige la fecha de nacimiento aunque todavia no se sepa si es menor', () => {
    // Este es el bucle que se cerraba: sin fecha no hay edad, y sin edad la
    // regla "pedile la fecha" no llegaba a dispararse. Lo resuelve el
    // esAltaDeMenor del formulario, no el cálculo.
    const r = validarConsentimientos({
      ...base,
      menor: { nombre: 'Lautaro', fechaNacimiento: null },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/fecha de nacimiento/);
  });

  it('no pide vinculo ni fecha cuando el alta NO es de un jugador', () => {
    const r = validarConsentimientos({
      consentimiento: { marcadas: [] },
      menor: { nombre: 'Marcelo' },
      vinculo: null,
      esAltaDeMenor: false,
    });
    expect(r.ok).toBe(true);
  });

  it('la opinion en contra veda aunque el representante haya firmado', () => {
    // Es el punto del diseno. Si la madre firma y el chico dice que no, el
    // club no sube la foto del DNI.
    const r = validarConsentimientos({
      ...base,
      menor: { ...base.menor, opinion: 'en_contra' },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no está de acuerdo/);
  });

  it('la opinion en contra veda CADA finalidad marcada que la pida', () => {
    // "No" del menor no es para una casilla: si no quiere la foto del DNI,
    // tampoco quiere su foto en la galería. Las dos requieren su opinión.
    const r = validarConsentimientos({
      ...base,
      consentimiento: { marcadas: ['imagenes'] },
      menor: { ...base.menor, opinion: 'en_contra' },
    });
    expect(r.ok).toBe(false);
  });

  it('la opinion en contra no veda lo que no exige la opinion del menor', () => {
    // Las comunicaciones no le hacen falta al chico para opinar: se las
    // resuelve el representante y listo.
    const r = validarConsentimientos({
      ...base,
      consentimiento: { marcadas: ['comunicaciones'] },
      menor: { ...base.menor, opinion: 'en_contra' },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.finalidades).toContain('comunicaciones');
  });

  it('un adulto no es vetado por una opinion en contra', () => {
    const r = validarConsentimientos({
      consentimiento: { marcadas: [] },
      menor: { nombre: 'Adulto', fechaNacimiento: '1990-01-01', opinion: 'en_contra' },
      vinculo: null,
      esAltaDeMenor: false,
    });
    expect(r.ok).toBe(true);
  });

  it('descarta finalidades que no existen en el catalogo', () => {
    const r = validarConsentimientos({
      ...base,
      consentimiento: { marcadas: ['documentacion_dni', 'inventada', 'datos_deportivos'] },
      menor: { ...base.menor, opinion: 'a_favor' },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.finalidades).not.toContain('inventada' as never);
  });

  it('no rechaza el alta por no marcar lo expreso: decir que no es un derecho', () => {
    // Si esto fallara, el club estaría comprando el consentimiento: la
    // inscripcion quedaria atada a que digan que si a la foto del DNI.
    const r = validarConsentimientos({
      ...base,
      consentimiento: { marcadas: [] },
      menor: { ...base.menor, opinion: 'no_consultado' },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.finalidades).not.toContain('documentacion_dni');
      // Lo único que queda es la contabilidad, que es obligación legal.
      expect(r.finalidades).toEqual(['cuotas_contabilidad']);
    }
  });

  it('la opinión por defecto es que no se consultó, no que está de acuerdo', () => {
    const r = validarConsentimientos({ ...base });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.opinion).toBe('no_consultado');
  });
});
