import { describe, it, expect } from 'vitest';
import { aplicarFiltrosPublicos, FILTROS_PUBLICOS, PUBLIC_SELECT_TABLES } from '@/lib/publico';

// Un filtro de publicación mal hecho es de los que no se rompen visiblemente:
// la pantalla sigue funcionando y lo que falla es que un borrador se publica
// solo. Estos tests fijan que el filtro se impone, no que la página lo pida.

describe('filtros de publicación', () => {
  it('cubre las tablas donde importa', () => {
    // Si se agrega una tabla a PUBLIC_SELECT_TABLES y se olvida el filtro,
    // la lectura pública no filtra nada. El test obliga a decidir.
    for (const t of ['comunicados', 'sponsors', 'horarios_entrenamiento']) {
      expect(FILTROS_PUBLICOS[t]).toBeTruthy();
      expect(PUBLIC_SELECT_TABLES).toContain(t);
    }
  });

  it('solo filtra lo publicado, no lo que el cliente pida', () => {
    const conds: string[] = [];
    aplicarFiltrosPublicos('comunicados', conds, []);
    expect(conds).toHaveLength(1);
    expect(conds[0]).toContain('publicado');
  });

  it('un cliente que pide borradores no los obtiene', () => {
    // El caso del ataque: `{"table":"comunicados","filters":{"estado":"borrador"}}`
    const conds = ["estado = 'borrador'"];
    aplicarFiltrosPublicos('comunicados', conds, []);

    // Quedan las dos condiciones con AND: no devuelve nada. Eso es correcto.
    expect(conds).toHaveLength(2);
    expect(conds.join(' AND ')).toContain("estado = 'publicado'");
  });

  it('no toca las tablas sin filtro', () => {
    const conds: string[] = [];
    aplicarFiltrosPublicos('canchas', conds, []);
    expect(conds).toHaveLength(0);
  });

  it('no desalinea parámetros al agregar el filtro', () => {
    // El filtro es una constante sin `?`, así que no debe tocar params: si lo
    // tocara, los binds quedarían corridos y la consulta fallaría o, peor,
    // compararía contra el valor equivocado.
    const params: unknown[] = ['valor'];
    aplicarFiltrosPublicos('comunicados', [], params);
    expect(params).toEqual(['valor']);
  });

  it('rechaza un filtro con placeholders sin params', () => {
    // Guarda contra el error futuro: alguien agrega un filtro con ? y no
    // actualiza el conteo de parámetros. Falla acá, no en producción.
    const original = FILTROS_PUBLICOS.comunicados;
    FILTROS_PUBLICOS.comunicados = 'autor_id = ?';
    try {
      expect(() => aplicarFiltrosPublicos('comunicados', [], [])).toThrow(/placeholders/);
    } finally {
      FILTROS_PUBLICOS.comunicados = original;
    }
  });
});
