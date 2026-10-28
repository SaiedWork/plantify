import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(address: string): boolean {
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]!);

  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local, incl. cloud metadata 169.254.169.254
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224 // multicast + reserved
    );
  }

  const v6 = address.toLowerCase();
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe8') || v6.startsWith('fe9') || v6.startsWith('fea') || v6.startsWith('feb') || v6.startsWith('ff');
}

const allowPrivate = () => process.env.WEBHOOK_ALLOW_PRIVATE === '1';

/**
 * Server-side request forgery guard for webhook targets. Production accepts only https URLs that
 * resolve to public addresses; WEBHOOK_ALLOW_PRIVATE=1 (local dev and tests only) relaxes that.
 * It is checked when an endpoint is saved and again right before every delivery (DNS can change).
 */
export async function assertSafeWebhookUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Enter a valid URL');
  }
  if (url.username || url.password) throw new Error('URLs with embedded credentials are not allowed');
  if (allowPrivate()) {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Use an http(s) URL');
    return url;
  }
  if (url.protocol !== 'https:') throw new Error('Webhook URLs must use https');

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('That host is not allowed');
  }
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0) throw new Error('Could not resolve that host');
  if (addresses.some(isPrivateAddress)) throw new Error('That host resolves to a private network address');
  return url;
}
