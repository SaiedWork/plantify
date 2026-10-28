import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertSafeWebhookUrl, isPrivateAddress } from './ssrf.js';

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254', // cloud metadata
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fd12:3456::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.5',
  ])('treats %s as private', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '100.63.0.1', '2606:4700:4700::1111'])('treats %s as public', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe('assertSafeWebhookUrl (production rules)', () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.WEBHOOK_ALLOW_PRIVATE;
    delete process.env.WEBHOOK_ALLOW_PRIVATE;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.WEBHOOK_ALLOW_PRIVATE;
    else process.env.WEBHOOK_ALLOW_PRIVATE = saved;
  });

  it('accepts https URLs to public addresses', async () => {
    await expect(assertSafeWebhookUrl('https://8.8.8.8/hook')).resolves.toBeInstanceOf(URL);
  });

  it.each([
    ['http://8.8.8.8/hook', 'https'],
    ['https://127.0.0.1/hook', 'private'],
    ['https://169.254.169.254/latest/meta-data', 'private'],
    ['https://10.0.0.1/', 'private'],
    ['https://[::1]/', 'private'],
    ['https://localhost/hook', 'not allowed'],
    ['https://printer.local/hook', 'not allowed'],
    ['https://user:pass@8.8.8.8/hook', 'credentials'],
    ['ftp://8.8.8.8/', 'https'],
    ['not a url', 'valid URL'],
  ])('rejects %s', async (url, reason) => {
    await expect(assertSafeWebhookUrl(url)).rejects.toThrow(reason);
  });

  it('is relaxed only when WEBHOOK_ALLOW_PRIVATE=1', async () => {
    process.env.WEBHOOK_ALLOW_PRIVATE = '1';
    await expect(assertSafeWebhookUrl('http://127.0.0.1:9999/hook')).resolves.toBeInstanceOf(URL);
    await expect(assertSafeWebhookUrl('ftp://127.0.0.1/')).rejects.toThrow();
  });
});
