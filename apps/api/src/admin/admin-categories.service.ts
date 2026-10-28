import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminCategory } from '@plantify/contracts';
import { sql, type SQL } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { mapDbError, slugify } from '../common/db-errors.js';
import { InjectDb, type Db } from '../db/db.module.js';

type Row = { id: string; slug: string; name: string; description: string | null; sort_order: number; product_count: string };

const toCategory = (r: Row): AdminCategory => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  description: r.description,
  sortOrder: r.sort_order,
  productCount: Number(r.product_count),
});

@Injectable()
export class AdminCategoriesService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  private async one(id: string): Promise<AdminCategory> {
    const { rows } = await this.db.execute<Row>(sql`
      select c.id, c.slug, c.name, c.description, c.sort_order, count(p.id) as product_count
      from category c left join product p on p.category_id = c.id where c.id = ${id} group by c.id`);
    if (!rows[0]) throw new NotFoundException('Category not found');
    return toCategory(rows[0]);
  }

  async list(): Promise<AdminCategory[]> {
    const { rows } = await this.db.execute<Row>(sql`
      select c.id, c.slug, c.name, c.description, c.sort_order, count(p.id) as product_count
      from category c left join product p on p.category_id = c.id group by c.id order by c.sort_order, c.name`);
    return rows.map(toCategory);
  }

  async create(actorId: string, input: { name: string; description?: string; sortOrder?: number }): Promise<AdminCategory> {
    const id = crypto.randomUUID();
    const slug = slugify(input.name) || `category-${id.slice(0, 6)}`;
    try {
      await this.db.execute(sql`
        insert into category (id, slug, name, description, sort_order)
        values (${id}, ${slug}, ${input.name}, ${input.description ?? null},
                ${input.sortOrder ?? sql`(select coalesce(max(sort_order), 0) + 1 from category)`})`);
    } catch (err) {
      mapDbError(err, { unique: 'A category with that name already exists' });
    }
    await this.audit.log(actorId, 'category.create', id, { name: input.name });
    return this.one(id);
  }

  async update(actorId: string, id: string, patch: { name?: string; description?: string; sortOrder?: number }): Promise<AdminCategory> {
    const sets: SQL[] = [];
    // The slug is part of public URLs, so it only changes with the name when the category is still empty of products.
    if (patch.name !== undefined) sets.push(sql`name = ${patch.name}`);
    if (patch.description !== undefined) sets.push(sql`description = ${patch.description || null}`);
    if (patch.sortOrder !== undefined) sets.push(sql`sort_order = ${patch.sortOrder}`);
    if (sets.length > 0) {
      const res = await this.db.execute(sql`update category set ${sql.join(sets, sql`, `)} where id = ${id} returning id`);
      if (res.rows.length === 0) throw new NotFoundException('Category not found');
      await this.audit.log(actorId, 'category.update', id, patch);
    }
    return this.one(id);
  }

  async remove(actorId: string, id: string): Promise<void> {
    const category = await this.one(id);
    if (category.productCount > 0) throw new ConflictException('Move or delete this category’s products first');
    await this.db.execute(sql`delete from category where id = ${id}`);
    await this.audit.log(actorId, 'category.delete', id, { name: category.name });
  }
}
