export const ROLES = ['customer', 'catalog_manager', 'owner'] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES = ['catalog_manager', 'owner'] as const satisfies readonly Role[];

export type Permission =
  | 'catalog:manage'
  | 'inventory:manage'
  | 'orders:view'
  | 'orders:fulfil'
  | 'orders:refund'
  | 'customers:view'
  | 'dashboard:revenue'
  | 'dashboard:stock'
  | 'billing:manage'
  | 'webhooks:manage'
  | 'staff:manage';

export const PERMISSIONS: Record<Role, readonly Permission[]> = {
  customer: [],
  catalog_manager: [
    'catalog:manage',
    'inventory:manage',
    'orders:view',
    'orders:fulfil',
    'dashboard:stock',
  ],
  owner: [
    'catalog:manage',
    'inventory:manage',
    'orders:view',
    'orders:fulfil',
    'orders:refund',
    'customers:view',
    'dashboard:revenue',
    'dashboard:stock',
    'billing:manage',
    'webhooks:manage',
    'staff:manage',
  ],
};

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role].includes(permission);
}
