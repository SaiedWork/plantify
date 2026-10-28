import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MAX_SAVED_ADDRESSES, type AddressView, type SavedAddressInput } from '@plantify/contracts';
import { address } from '@plantify/db';
import { and, desc, eq, ne } from 'drizzle-orm';
import { InjectDb, type Db } from '../db/db.module.js';

type Row = typeof address.$inferSelect;

const toView = (r: Row): AddressView => ({
  id: r.id,
  fullName: r.fullName,
  line1: r.line1,
  line2: r.line2,
  city: r.city,
  region: r.region,
  postalCode: r.postalCode,
  country: r.country,
  isDefault: r.isDefault,
});

@Injectable()
export class AddressesService {
  constructor(@InjectDb() private readonly db: Db) {}

  async list(userId: string): Promise<AddressView[]> {
    const rows = await this.db
      .select()
      .from(address)
      .where(eq(address.userId, userId))
      .orderBy(desc(address.isDefault), desc(address.createdAt));
    return rows.map(toView);
  }

  async create(userId: string, input: SavedAddressInput): Promise<AddressView> {
    return this.db.transaction(async (tx) => {
      const existing = await tx.select({ id: address.id }).from(address).where(eq(address.userId, userId));
      if (existing.length >= MAX_SAVED_ADDRESSES) {
        throw new ConflictException(`You can save up to ${MAX_SAVED_ADDRESSES} addresses`);
      }
      // The first address is always the default.
      const makeDefault = input.isDefault === true || existing.length === 0;
      if (makeDefault) await tx.update(address).set({ isDefault: false }).where(eq(address.userId, userId));

      const { isDefault: _ignored, ...fields } = input;
      const [row] = await tx
        .insert(address)
        .values({ ...fields, line2: fields.line2 || null, region: fields.region || null, userId, isDefault: makeDefault })
        .returning();
      return toView(row!);
    });
  }

  async update(userId: string, id: string, patch: Partial<SavedAddressInput>): Promise<AddressView> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(address).where(and(eq(address.id, id), eq(address.userId, userId)));
      if (!current) throw new NotFoundException('Address not found');

      const { isDefault, ...fields } = patch;
      if (isDefault === true) {
        await tx.update(address).set({ isDefault: false }).where(and(eq(address.userId, userId), ne(address.id, id)));
      }
      const [row] = await tx
        .update(address)
        .set({
          ...fields,
          ...('line2' in fields ? { line2: fields.line2 || null } : {}),
          ...('region' in fields ? { region: fields.region || null } : {}),
          // The only default cannot be un-defaulted; pick another default instead.
          ...(isDefault === true ? { isDefault: true } : {}),
        })
        .where(eq(address.id, id))
        .returning();
      return toView(row!);
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [removed] = await tx
        .delete(address)
        .where(and(eq(address.id, id), eq(address.userId, userId)))
        .returning();
      if (!removed) throw new NotFoundException('Address not found');

      if (removed.isDefault) {
        const [next] = await tx
          .select({ id: address.id })
          .from(address)
          .where(eq(address.userId, userId))
          .orderBy(desc(address.createdAt))
          .limit(1);
        if (next) await tx.update(address).set({ isDefault: true }).where(eq(address.id, next.id));
      }
    });
  }
}
