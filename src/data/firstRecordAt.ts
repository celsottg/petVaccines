/** The earliest creation instant among pets and vaccinations, or null when there are none. Pure. */
export function firstRecordAt(rows: { createdAt: string }[]): string | null {
  return rows.reduce<string | null>((first, row) => (first === null || row.createdAt < first ? row.createdAt : first), null);
}
