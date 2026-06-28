import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'
import { DEPARTMENTS } from '@/types/kpi'

function getCurrentQuarter(): string {
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3) + 1
  return `${now.getFullYear()}-Q${q}`
}

function randomCode(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0')
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { department, code } = body

  if (!department || !code) {
    return NextResponse.json({ valid: false }, { status: 400 })
  }

  await ensureSchema()
  const db = getDb()
  const quarter = getCurrentQuarter()
  const now = new Date().toISOString()

  // Auto-generate code if not exists for this quarter
  const existing = await db.execute({
    sql: 'SELECT code, quarter FROM dept_codes WHERE department = ?',
    args: [department],
  })
  const row = existing.rows[0] as unknown as { code: string; quarter: string } | undefined

  if (!row || row.quarter !== quarter) {
    // Rotate all departments
    for (const dept of DEPARTMENTS) {
      const newCode = randomCode()
      await db.execute({
        sql: `INSERT INTO dept_codes (department, code, quarter, created_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(department) DO UPDATE SET code = excluded.code, quarter = excluded.quarter, created_at = excluded.created_at`,
        args: [dept, newCode, quarter, now],
      })
    }
    // After rotation, re-fetch
    const refreshed = await db.execute({
      sql: 'SELECT code FROM dept_codes WHERE department = ?',
      args: [department],
    })
    const newRow = refreshed.rows[0] as unknown as { code: string } | undefined
    return NextResponse.json({ valid: newRow?.code === code.trim() })
  }

  return NextResponse.json({ valid: row.code === code.trim() })
}
