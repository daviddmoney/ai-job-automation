/** Server-side authorization primitives. Pass only an identity established by a trusted server session. */
export type AppRole = "USER" | "STAFF";
export interface AuthenticatedUser { id: string; role: AppRole; }

export function requireAuthenticatedUser(user: AuthenticatedUser | null): AuthenticatedUser {
  if (!user?.id) throw new Error("UNAUTHENTICATED");
  return user;
}

export function requireStaff(user: AuthenticatedUser | null): AuthenticatedUser {
  const authenticated = requireAuthenticatedUser(user);
  if (authenticated.role !== "STAFF") throw new Error("FORBIDDEN");
  return authenticated;
}

/** Include this owner filter in resource queries; never trust a browser-supplied user ID. */
export function ownedResourceWhere(user: AuthenticatedUser, resourceId: string) {
  return { id: resourceId, userId: user.id } as const;
}
