import { BadRequestException, ConflictException } from '@nestjs/common';

const codeOf = (err: unknown): string | undefined => {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code;
};

/** Maps Postgres constraint violations to friendly HTTP errors; rethrows anything else. */
export function mapDbError(err: unknown, messages: { unique?: string; foreignKey?: string } = {}): never {
  const code = codeOf(err);
  if (code === '23505') throw new ConflictException(messages.unique ?? 'That value is already in use');
  if (code === '23503') throw new BadRequestException(messages.foreignKey ?? 'A referenced record does not exist');
  throw err;
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');

export const offsetOf = (page: number, pageSize: number) => (page - 1) * pageSize;
