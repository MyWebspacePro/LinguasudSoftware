export const ROLES = ["office", "teacher", "participant", "finance", "admin"] as const;

export type Role = (typeof ROLES)[number];

/** Order used to derive a primary role for display/backwards compatibility. */
const ROLE_PRIORITY: readonly Role[] = ["admin", "office", "finance", "teacher", "participant"];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function hasRole(user: { roles: readonly Role[] }, ...roles: Role[]): boolean {
  return roles.some((role) => user.roles.includes(role));
}

export function primaryRole(roles: readonly Role[]): Role {
  return ROLE_PRIORITY.find((role) => roles.includes(role)) ?? "participant";
}
