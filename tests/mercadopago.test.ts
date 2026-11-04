import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  firmaWebhookValida,
  puntoDeInicio,
  redondearImporte,
} from '@/lib/mercadopago';

// La firma del webhook es la puerta que decide si se consulta o no un pago.
// Un error acá se paga caro en las dos direcciones: si acepta de más, procesa
// POST falsos; si rechaza de más, los pagos legítimos quedan sin acreditar.

function firmar(manifiesto: string, secreto: string): string {
  return createHmac('sha256', secreto).update(manifiesto).digest('hex');
}

describe('firma del webhook de MercadoPago', () => {
  const secreto = 'secreto-de-prueba';

  it('acepta la firma correcta', () => {
    const manifiesto = 'id:12345;request-id:req-1;ts:1704908010;';
    expect(
      firmaWebhookValida({
        xSignature: `ts=1704908010,v1=${firmar(manifiesto, secreto)}`,
        xRequestId: 'req-1',
        dataId: '12345',
        secret: secreto,
      })
    ).toBe(true);
  });

  it('rechaza una firma con otro secreto', () => {
    const manifiesto = 'id:12345;request-id:req-1;ts:1704908010;';
    expect(
      firmaWebhookValida({
        xSignature: `ts=1704908010,v1=${firmar(manifiesto, 'otro-secreto')}`,
        xRequestId: 'req-1',
        dataId: '12345',
        secret: secreto,
      })
    ).toBe(false);
  });

  it('rechaza si falta el header o el data.id', () => {
    expect(
      firmaWebhookValida({ xSignature: null, xRequestId: 'req-1', dataId: '12345', secret: secreto })
    ).toBe(false);
    expect(
      firmaWebhookValida({
        xSignature: 'ts=1704908010,v1=abc',
        xRequestId: 'req-1',
        dataId: null,
        secret: secreto,
      })
    ).toBe(false);
  });

  it('omite request-id del manifiesto cuando no vino', () => {
    const manifiesto = 'id:12345;ts:1704908010;';
    expect(
      firmaWebhookValida({
        xSignature: `ts=1704908010,v1=${firmar(manifiesto, secreto)}`,
        xRequestId: null,
        dataId: '12345',
        secret: secreto,
      })
    ).toBe(true);
  });

  it('pasa el data.id alfanumérico a minúsculas, como firma MercadoPago', () => {
    const manifiesto = 'id:abc123;request-id:req-1;ts:1704908010;';
    expect(
      firmaWebhookValida({
        xSignature: `ts=1704908010,v1=${firmar(manifiesto, secreto)}`,
        xRequestId: 'req-1',
        dataId: 'ABC123',
        secret: secreto,
      })
    ).toBe(true);
  });

  it('sin secreto configurado no bloquea: la consulta del pago autentica', () => {
    expect(
      firmaWebhookValida({ xSignature: null, xRequestId: null, dataId: '1', secret: '' })
    ).toBe(true);
  });
});

describe('URL del checkout', () => {
  const preferencia = {
    id: 'pref',
    init_point: 'https://checkout-mercadopago',
    sandbox_init_point: 'https://sandbox-deprecado',
  };

  it('usa siempre init_point, también con credenciales TEST-', () => {
    // MercadoPago eliminó el sandbox: las pruebas usan la misma URL con una
    // cuenta de prueba. `sandbox_init_point` está deprecado.
    expect(puntoDeInicio(preferencia)).toBe('https://checkout-mercadopago');
  });
});

describe('redondeo de importes', () => {
  it('redondea a centavos para comparar contra MercadoPago', () => {
    expect(redondearImporte(78750.00000000001)).toBe(78750);
    expect(redondearImporte(1234.567)).toBe(1234.57);
    expect(redondearImporte(Number.NaN)).toBe(0);
  });
});
