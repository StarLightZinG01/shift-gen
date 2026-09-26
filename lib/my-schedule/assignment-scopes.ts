export type WardVersionScope = {
  scheduleVersionId: string;
  wardId: string;
};

export function buildWardVersionScopes(scopes: WardVersionScope[]) {
  const uniqueScopes = new Map<string, WardVersionScope>();

  for (const scope of scopes) {
    uniqueScopes.set(
      `${scope.scheduleVersionId}:${scope.wardId}`,
      scope,
    );
  }

  return Array.from(uniqueScopes.values());
}

export function toAssignmentScopeWhere(scopes: WardVersionScope[]) {
  return buildWardVersionScopes(scopes).map((scope) => ({
    scheduleVersionId: scope.scheduleVersionId,
    wardId: scope.wardId,
  }));
}
