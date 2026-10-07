import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { opinionVeda } from '@/lib/consentimientos';

const PAGINA = readFileSync(
  join(__dirname, '../src/app/socio-benefactor/hijos/page.tsx'),
  'utf8'
);
const COMPONENTE = readFileSync(
  join(__dirname, '../src/components/SubirDocumentacion.tsx'),
  'utf8'
);

/**
 * La pantalla donde el padre sube el DNI de sus hijos.
 *
 * La regla que hay que proteger acá no es cosmetica: es que la pantalla diga la
 * verdad sobre si se puede subir. Antes de esto el padre no tenia donde
 * subirlo, y la documentacion del club se completaba en papel.
 */
describe('subida de DNI desde el portal del padre', () => {
  it('el estado del consentimiento sale de las funciones del servidor, no de una consulta propia', () => {
    // Si reimplementara la regla de la opinion, mostraria "puede subir" y el
    // rechazo llegaria un segundo despues desde la puerta del servidor. La
    // regla de "la propia manda siempre" tiene que vivir en un solo lugar.
    expect(PAGINA).toContain('tieneConsentimiento');
    expect(PAGINA).toContain('opinionVigente');
    expect(PAGINA).toContain('opinionVeda');
  });

  it('el veto del menor gana sobre el consentimiento del representante', () => {
    const combinaciones = [
      { consentido: true, opinion: 'a_favor' as const, esperado: true },
      { consentido: true, opinion: 'en_contra' as const, esperado: false },
      { consentido: false, opinion: 'a_favor' as const, esperado: false },
      { consentido: false, opinion: 'no_consultado' as const, esperado: false },
      { consentido: true, opinion: null, esperado: true },
    ];

    for (const { consentido, opinion, esperado } of combinaciones) {
      const puedeSubir = Boolean(consentido) && !opinionVeda(opinion);
      expect(puedeSubir).toBe(esperado);
    }
  });

  it('el archivo lleva el id del jugador y no uno fijo', () => {
    // Un nombre fijo hace que el segundo hijo pise al primero: los dos quedan
    // apuntando a la misma URL y el club ve la cara de un hermano en el legajo
    // del otro.
    expect(COMPONENTE).toContain('uploadDni(perfilId, file, lado)');
  });

  it('muestra el error del servidor cuando la escritura se rechaza', () => {
    // El archivo se sube antes que la anotacion. Si la escritura falla (falta
    // consentimiento, el menor dijo que no, no hay ficha), avisar "listo" haria
    // que el club le dijera a la familia que tiene la documentacion guardada.
    expect(COMPONENTE).toContain('if (error)');
    expect(COMPONENTE).toContain('description: error');
  });

  it('no ofrece subir cuando no hay ficha de jugador', () => {
    // El UPDATE necesita una fila en `deportistas`. Sin ella el servidor
    // responde 404 y el padre queda con un boton que nunca funciona.
    expect(COMPONENTE).toContain('tieneFicha');
    expect(COMPONENTE).toContain('habilitada = tieneFicha && puedeSubir');
  });
});