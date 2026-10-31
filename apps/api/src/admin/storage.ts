import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface StorageProvider {
  /** Stores the bytes and returns the public URL to put in `product_image.url`. */
  save(key: string, data: Buffer, contentType: string): Promise<string>;
  /** Deletes every stored upload (used by the periodic demo reset) and returns how many were removed. */
  deleteAll(): Promise<number>;
}

export const UPLOAD_DIR = join(process.cwd(), '.uploads');
export const UPLOAD_URL_PREFIX = '/api/uploads';

/** Dev: files go to ./.uploads and are served by the API at /api/uploads/*. */
export class LocalDiskStorage implements StorageProvider {
  async save(key: string, data: Buffer): Promise<string> {
    const path = join(UPLOAD_DIR, key);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, data);
    return `${UPLOAD_URL_PREFIX}/${key}`;
  }

  async deleteAll(): Promise<number> {
    const entries = await readdir(UPLOAD_DIR, { recursive: true, withFileTypes: true }).catch(() => []);
    await rm(UPLOAD_DIR, { recursive: true, force: true });
    return entries.filter((e) => e.isFile()).length;
  }
}

/** Production: Vercel Blob (free on the Hobby plan). Selected when BLOB_READ_WRITE_TOKEN is set. */
export class VercelBlobStorage implements StorageProvider {
  async save(key: string, data: Buffer, contentType: string): Promise<string> {
    const { put } = await import('@vercel/blob');
    const blob = await put(`uploads/${key}`, data, { access: 'public', contentType, addRandomSuffix: false });
    return blob.url;
  }

  async deleteAll(): Promise<number> {
    const { list, del } = await import('@vercel/blob');
    let removed = 0;
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: 'uploads/', cursor });
      if (page.blobs.length > 0) await del(page.blobs.map((b) => b.url));
      removed += page.blobs.length;
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return removed;
  }
}

export const createStorage = (): StorageProvider =>
  process.env.BLOB_READ_WRITE_TOKEN ? new VercelBlobStorage() : new LocalDiskStorage();

const SIGNATURES: { ext: string; type: string; test: (b: Buffer) => boolean }[] = [
  { ext: 'jpg', type: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', type: 'image/png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'webp', type: 'image/webp', test: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
];

/** Trusts the file's bytes, not the client-supplied name or MIME type. */
export function sniffImage(data: Buffer) {
  return SIGNATURES.find((s) => s.test(data)) ?? null;
}
