import { describe, it, expect } from 'vitest';
import {
  validarPedidoPublico,
  normalizarDocumento,
  normalizarMotivo,
  documentoValido,
  componerNotas,
  MOTIVOS_SOLICITUD,
} from '@/lib/baja-solicitud';

// El pedido de baja es el único punto del sistema donde equivocarse no sale
// caro en un número, sino en una persona. Si se acepta un pedido sin DNI, el
// admin no tiene con qué verificar a quién corresponde y termina anonimizando
// a quien se le parece. Estas pruebas fijan el mínimo de lo que tiene que
// traer un pedido para ser atendible.

const PEDIDO_VALIDO = {
  nombre: 'María Gómez',
  email: 'maria@ejemplo.com',
  documento: '12345678',
  relacion: 'Madre del jugador',
  motivo: 'solicitud_tutor',
  comentario: 'Se muda de ciudad.',
};

describe('normalización del documento', () => {
  it('saca todo lo que no es dígito', () => {
    expect(normalizarDocumento('12.345.678')).toBe('12345678');
    expect(normalizarDocumento('dni 12345678')).toBe('12345678');
    expect(normalizarDocumento(' 12-345-678 ')).toBe('12345678');
    expect(normalizarDocumento(null)).toBe('');
  });

  it('acepta entre 6 y 10 dígitos, y nada más', () => {
    expect(documentoValido('123456')).toBe(true);
    expect(documentoValido('1234567890')).toBe(true);
    expect(documentoValido('12345')).toBe(false);
    expect(documentoValido('12345678901')).toBe(false);
    expect(documentoValido('abcdefgh')).toBe(false);
  });
});

describe('motivo del pedido', () => {
  it('acepta los motivos conocidos', () => {
    for (const m of MOTIVOS_SOLICITUD) {
      expect(normalizarMotivo(m)).toBe(m);
    }
  });

  it('cae a "otro" en vez de rechazar un motivo desconocido', () => {
    // El club no tiene por qué saber de antemano por qué pide la baja alguien.
    // Negarse a registrar el pedido por un motivo no previsto le daría a quien
    // lo hace una razón para no insistir.
    expect(normalizarMotivo('me mude a cordoba')).toBe('otro');
    expect(normalizarMotivo(undefined)).toBe('otro');
    expect(normalizarMotivo('')).toBe('otro');
  });
});

describe('validación del pedido público', () => {
  it('acepta un pedido bien formado', () => {
    const r = validarPedidoPublico(PEDIDO_VALIDO);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.datos.email).toBe('maria@ejemplo.com');
      expect(r.datos.documento).toBe('12345678');
      expect(r.datos.motivo).toBe('solicitud_tutor');
    }
  });

  it('exige el DNI: sin documento no se puede verificar a nadie', () => {
    const r = validarPedidoPublico({ ...PEDIDO_VALIDO, documento: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/DNI/);
  });

  it('exige un email al que se pueda responder', () => {
    for (const email of ['', 'maria', 'maria@', '@ejemplo.com', 'maria@ejemplo']) {
      const r = validarPedidoPublico({ ...PEDIDO_VALIDO, email });
      expect(r.ok, `debería rechazar "${email}"`).toBe(false);
    }
  });

  it('exige un nombre utilizable', () => {
    expect(validarPedidoPublico({ ...PEDIDO_VALIDO, nombre: 'Jo' }).ok).toBe(false);
    expect(validarPedidoPublico({ ...PEDIDO_VALIDO, nombre: '   ' }).ok).toBe(false);
  });

  it('rechaza en vez de recortar lo que excede el largo del campo', () => {
    // Recortar en silencio haría que quien escribió el motivo crea que el club
    // leyó lo que puso. Mejor que rehaga el pedido.
    expect(validarPedidoPublico({ ...PEDIDO_VALIDO, nombre: 'x'.repeat(400) }).ok).toBe(false);
    expect(validarPedidoPublico({ ...PEDIDO_VALIDO, comentario: 'y'.repeat(5000) }).ok).toBe(false);
    expect(validarPedidoPublico({ ...PEDIDO_VALIDO, relacion: 'z'.repeat(200) }).ok).toBe(false);
  });

  it('acepta un texto largo pero razonable', () => {
    const r = validarPedidoPublico({ ...PEDIDO_VALIDO, comentario: 'y'.repeat(1500) });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.datos.comentario.length).toBe(1500);
  });

  it('normaliza el motivo a uno conocido sin fallar la validación', () => {
    const r = validarPedidoPublico({ ...PEDIDO_VALIDO, motivo: 'inventado' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.datos.motivo).toBe('otro');
  });
});

describe('composición de las notas', () => {
  it('separa el vínculo del comentario para que se sepa quién dijo qué', () => {
    const notas = componerNotas({ vinculo: 'Madre', comentario: 'Se muda.' });
    expect(notas).toContain('Vínculo declarado: Madre');
    expect(notas).toContain('Comentario: Se muda.');
  });

  it('devuelve null cuando no hay nada que anotar', () => {
    expect(componerNotas({})).toBeNull();
    expect(componerNotas({ vinculo: '', comentario: '' })).toBeNull();
  });

  it('nunca excede el largo del campo', () => {
    const notas = componerNotas({ comentario: 'z'.repeat(5000) });
    expect(notas!.length).toBeLessThanOrEqual(2000);
  });
});
