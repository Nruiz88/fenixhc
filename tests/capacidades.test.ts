import { describe, it, expect } from 'vitest';
import {
  puede,
  capacidadesDe,
  esTesorero,
  CAPACIDADES,
  CAPACIDADES_POR_ROL,
  ETIQUETA_CAPACIDAD,
  type Capacidad,
} from '@/lib/capacidades';
import { ROLES } from '@/lib/roles';

// Esta matriz decide si un tesorero puede ver el estado de cuenta o si un
// vocal puede leer las notas internas. Si cambia por error y nadie se da cuenta,
// el club se entera por un reclamo. Por eso está fijada por tests y no por
// buena fe.

describe('completitud de la matriz', () => {
  it('todo rol del catálogo tiene una entrada', () => {
    for (const rol of ROLES) {
      expect(Array.isArray(CAPACIDADES_POR_ROL[rol]), `falta el rol ${rol}`).toBe(true);
    }
  });

  it('toda capacidad tiene etiqueta y ninguna es inventada', () => {
    for (const c of CAPACIDADES) {
      expect(ETIQUETA_CAPACIDAD[c], `sin etiqueta: ${c}`).toBeTruthy();
    }
    for (const lista of Object.values(CAPACIDADES_POR_ROL)) {
      for (const c of lista) {
        expect(CAPACIDADES).toContain(c as Capacidad);
      }
    }
  });
});

describe('lo que pediste, cargo por cargo', () => {
  it('PRESIDENTE: todo', () => {
    for (const c of CAPACIDADES) {
      expect(puede('presidente', c), `presidente no puede ${c}`).toBe(true);
    }
  });

  it('SECRETARIO: parte administrativo y documentos del legajo, sin plata', () => {
    expect(puede('secretario', 'ver_parte_administrativo')).toBe(true);
    expect(puede('secretario', 'descargar_documentos_legajo')).toBe(true);
    expect(puede('secretario', 'publicar_comunicacion_interna')).toBe(true);
    expect(puede('secretario', 'comunicar_padres')).toBe(true);

    // El acta es suya. El estado de cuenta lo firma el tesorero y lo aprueba el
    // presidente: que lo vea no aporta y expone datos del banco.
    expect(puede('secretario', 'ver_parte_financiero')).toBe(false);
    expect(puede('secretario', 'emitir_recibos')).toBe(false);
    expect(puede('secretario', 'cargar_facturas')).toBe(false);
  });

  it('TESORERO: ingresos y egresos, recibos, facturas e inventario', () => {
    expect(puede('tesorero', 'ver_parte_financiero')).toBe(true);
    expect(puede('tesorero', 'cargar_facturas')).toBe(true);
    expect(puede('tesorero', 'emitir_recibos')).toBe(true);
    expect(puede('tesorero', 'comunicar_padres')).toBe(true);
    expect(puede('tesorero', 'ver_inventario')).toBe(true);
    expect(puede('tesorero', 'gestionar_inventario')).toBe(true);
    expect(puede('tesorero', 'gestionar_prestamos')).toBe(true);
    expect(puede('tesorero', 'ver_comunicacion_interna')).toBe(true);
    expect(puede('tesorero', 'ver_fotos')).toBe(true);

    // La parte administrativa es de la secretaría.
    expect(puede('tesorero', 'ver_parte_administrativo')).toBe(false);
    // Y no escribe la nota interna: escribe el parte financiero.
    expect(puede('tesorero', 'publicar_comunicacion_interna')).toBe(false);
  });

  it('VOCAL: mira fotos y comunicación interna, y nada más', () => {
    expect(puede('vocal_titular', 'ver_fotos')).toBe(true);
    expect(puede('vocal_titular', 'ver_comunicacion_interna')).toBe(true);

    // Un vocal que publica una comunicación interna decide qué ve el resto de
    // la junta. Eso no lo hace nadie que no sea presidencia o secretaría.
    expect(puede('vocal_titular', 'publicar_comunicacion_interna')).toBe(false);
    expect(puede('vocal_titular', 'comunicar_padres')).toBe(false);
    expect(puede('vocal_titular', 'ver_parte_financiero')).toBe(false);
    expect(puede('vocal_titular', 'descargar_documentos_legajo')).toBe(false);
    expect(puede('vocal_titular', 'gestionar_seguro')).toBe(false);
  });
});

describe('reglas que no dependen del cargo', () => {
  it('titular y suplente ven lo mismo en esta sección', () => {
    // Se configuraron igual. El cargo se distingue en otras cosas, no en si
    // leer una nota interna.
    expect(capacidadesDe('vocal_titular')).toEqual(capacidadesDe('vocal_suplente'));
  });

  it('ningún socio entra a la junta', () => {
    for (const c of CAPACIDADES) {
      expect(puede('socio_benefactor', c), `socio_benefactor: ${c}`).toBe(false);
      expect(puede('socio_cadete', c), `socio_cadete: ${c}`).toBe(false);
    }
    expect(capacidadesDe('socio_benefactor')).toEqual([]);
  });

  it('quien no tiene rol no puede nada', () => {
    // Sin esto, una petición sin sesiónValidada —o con un rol que ya no está
    // en el catálogo— entraría como si fuera admin.
    for (const c of CAPACIDADES) {
      expect(puede(null, c)).toBe(false);
      expect(puede(undefined, c)).toBe(false);
      expect(puede('inventado', c)).toBe(false);
      expect(puede('', c)).toBe(false);
    }
  });

  it('solo el tesorero es el tesorero', () => {
    expect(esTesorero('tesorero')).toBe(true);
    expect(esTesorero('presidente')).toBe(false);
    expect(esTesorero('admin')).toBe(false);
    expect(esTesorero(null)).toBe(false);
  });

  it('el admin puede todo lo que el presidente puede', () => {
    // El admin es la mano derecha de la presidencia. Si el presidente puede
    // algo y el admin no, la adiantada la tiene el admin.
    const dePresidente = capacidadesDe('presidente');
    const deAdmin = capacidadesDe('admin');
    for (const c of dePresidente) {
      expect(deAdmin, `admin no puede ${c}`).toContain(c);
    }
  });
});
