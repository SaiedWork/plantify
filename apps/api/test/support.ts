import type request from 'supertest';

/** Minimal cookie jar for supertest, so a "browser" keeps its session, cart and demo-inbox cookies. */
export class Jar {
  private cookies = new Map<string, string>();

  absorb(res: request.Response) {
    for (const line of (res.headers['set-cookie'] as unknown as string[] | undefined) ?? []) {
      const [pair] = line.split(';');
      const eq = pair!.indexOf('=');
      this.cookies.set(pair!.slice(0, eq), pair!.slice(eq + 1));
    }
    return res;
  }

  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}
