import { describe, it, expect } from 'vitest';
import { clientIp } from '@/lib/rateLimit';

function req(headers: Record<string, string>): any {
  return {
    headers: new Headers(headers),
    cookies: { get: () => undefined },
  };
}

describe('clientIp: la cadena de proxies', () => {
  it('toma la IP real detras de Cloudflare, no la del proxy', () => {
    // Este es el caso que estaba roto. La version anterior tomaba la primera
    // posicion del X-Forwarded-For y devolvia siempre una IP de Cloudflare.
    const r = req({
      'cf-connecting-ip': '200.45.103.8',
      'x-forwarded-for': '200.45.103.8, 172.70.215.49',
      'x-real-ip': '172.70.215.49',
    });
    expect(clientIp(r)).toBe('200.45.103.8');
  });

  it('sin CF-Connecting-IP usa la ULTIMA posicion del forwarded-for', () => {
    // Cada proxy agrega su cadena al final, asi que la ultima es la de la
    // persona. La primera es del proxy mas externo.
    const r = req({
      'x-forwarded-for': '172.70.215.49, 10.0.0.5, 181.30.44.12',
    });
    expect(clientIp(r)).toBe('181.30.44.12');
  });

  it('salta las posiciones invalidas en vez de devolver basura', () => {
    // Un header manipulable servia para escribir texto en una columna que
    // sirve para detectar abuso.
    const r = req({
      'cf-connecting-ip': 'no-es-una-ip',
      'x-forwarded-for': 'tambien-nada, 181.30.44.12',
    });
    expect(clientIp(r)).toBe('181.30.44.12');
  });

  it('acepta IPv6', () => {
    const r = req({ 'cf-connecting-ip': '2001:db8:85a3::8a2e:370:7334' });
    expect(clientIp(r)).toBe('2001:db8:85a3::8a2e:370:7334');
  });

  it('rechaza octetos fuera de rango y valores con letras', () => {
    expect(clientIp(req({ 'cf-connecting-ip': '999.1.1.1' }))).not.toBe('999.1.1.1');
    expect(clientIp(req({ 'cf-connecting-ip': 'abc.def' }))).toBe(
      'local:anon'
    );
  });

  it('cae a x-real-ip si no hay nada mejor', () => {
    const r = req({ 'x-real-ip': '181.30.44.12' });
    expect(clientIp(r)).toBe('181.30.44.12');
  });

  it('sin headers no agrupa a todos en la misma IP', () => {
    // Una constante compartida seria un cubo de rate-limit para todo el mundo.
    const r = req({});
    expect(clientIp(r)).toMatch(/^local:/);
  });

  it('dos personas distintas no caen en el mismo cubo de rate-limit', () => {
    const uno = clientIp(req({ 'cf-connecting-ip': '181.30.44.12' }));
    const dos = clientIp(req({ 'cf-connecting-ip': '181.30.44.13' }));
    expect(uno).not.toBe(dos);
  });
});