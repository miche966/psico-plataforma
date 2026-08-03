export async function readAll(db: any, table: string, select: string, orderBy?: string) {
  const rows: any[] = []
  const pageSize = 1000
  for (let offset = 0; ; offset += pageSize) {
    let query = db.from(table).select(select).range(offset, offset + pageSize - 1)
    if (orderBy) query = query.order(orderBy, { ascending: false })
    const { data, error } = await query
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < pageSize) break
  }
  return rows
}
