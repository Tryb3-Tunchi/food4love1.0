// Pure module with NO imports so it can be unit-tested with node --test.

// Supabase's API returns at most one "page" per request (1,000 rows by default),
// whatever limit a query asks for. Reading 20,000 rows with one .limit(20000)
// therefore returns 1,000 and LOOKS complete, so every count and chart built on
// it would silently be too low. This reads page by page until the data runs out
// or the cap is reached, and says honestly when the cap cut it short.
export async function collectPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  cap: number,
  pageSize = 1000,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = []
  for (let offset = 0; offset < cap; offset += pageSize) {
    const size = Math.min(pageSize, cap - offset)
    const page = await fetchPage(offset, offset + size - 1)
    for (const row of page) rows.push(row)
    // A short page means the data is exhausted: stop, the result is complete.
    if (page.length < size) return { rows, truncated: false }
  }
  // The cap was reached with data possibly remaining.
  return { rows, truncated: true }
}
