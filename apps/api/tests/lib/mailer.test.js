// =============================================================================
// tests/lib/mailer.test.js — configurazione SMTP da variabili d'ambiente
// =============================================================================
import { describe, it, expect } from 'vitest';
import { buildSmtpOptions, describeSmtpConfig } from '../../src/lib/mailer.js';

describe('buildSmtpOptions', () => {
  it('di default impone STARTTLS e verifica il certificato', () => {
    const o = buildSmtpOptions({});
    expect(o).toMatchObject({ host: 'localhost', port: 1025, secure: false, requireTLS: true });
    expect(o.tls).toEqual({ rejectUnauthorized: true, minVersion: 'TLSv1.2' });
    expect(o.auth).toBeUndefined();
  });

  it('porta 465: TLS implicito, STARTTLS non serve', () => {
    const o = buildSmtpOptions({ SMTP_HOST: 'smtp.example.com', SMTP_PORT: '465' });
    expect(o.secure).toBe(true);
    expect(o.requireTLS).toBe(false);
  });

  it('produzione tipica su 587 con credenziali', () => {
    const o = buildSmtpOptions({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'u',
      SMTP_PASS: 'p',
    });
    expect(o).toMatchObject({
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: 'u', pass: 'p' },
    });
    expect(o.tls.rejectUnauthorized).toBe(true);
    expect(describeSmtpConfig(o).warnings).toEqual([]);
  });

  it('Mailpit: certificato autofirmato accettato, con avviso', () => {
    const o = buildSmtpOptions({ SMTP_USER: 'lookup', SMTP_PASS: 'x', SMTP_TLS_VERIFY: 'false' });
    expect(o.tls.rejectUnauthorized).toBe(false);
    expect(o.requireTLS).toBe(true);
    expect(describeSmtpConfig(o).warnings).toHaveLength(1);
  });

  it('SMTP_REQUIRE_TLS=false produce un avviso', () => {
    const o = buildSmtpOptions({ SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_REQUIRE_TLS: 'false' });
    expect(o.requireTLS).toBe(false);
    expect(describeSmtpConfig(o).warnings.join(' ')).toMatch(/in chiaro/);
  });

  it('credenziali a meta: errore esplicito', () => {
    expect(() => buildSmtpOptions({ SMTP_USER: 'u' })).toThrow(/insieme/);
  });

  it('il riepilogo non contiene la password', () => {
    const o = buildSmtpOptions({ SMTP_USER: 'u', SMTP_PASS: 'segreta' });
    expect(JSON.stringify(describeSmtpConfig(o))).not.toContain('segreta');
  });
});
