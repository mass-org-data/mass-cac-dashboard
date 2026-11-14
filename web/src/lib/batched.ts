// Helpers for the batched read functions (request-reduction Phase B). A database that does not have a batched function
// answers 404 / PGRST202; the caller then remembers that and uses the older per-centre functions instead.
export const isMissingFunction = (error: unknown) => {
  const e = error as {status?: number; code?: string} | null;
  return Boolean(e && e.status === 404 && e.code === 'PGRST202');
};

/** The database accepts at most 100 centres per batched call. */
export const BATCH_CENTRES = 100;
export const chunk = <T,>(items: T[], size = BATCH_CENTRES): T[][] => {
  const parts: T[][] = [];
  for (let i = 0; i < items.length; i += size) parts.push(items.slice(i, i + size));
  return parts;
};
