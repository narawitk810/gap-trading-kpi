import { NextRequest, NextResponse } from 'next/server'
import { getDb, ensureSchema } from '@/lib/db'
import { DEPARTMENTS } from '@/types/kpi'

const ADMIN_KEY = process.env.ADMIN_KEY || 'GAPtrading2024admin'

function getCurrentQuarter(): string {
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3) + 1
  return `${now.getFullYear()}-Q${q}`
}

function randomCode(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0')
}

async function ensureCodes(db: Awaited<ReturnType<typeof getDb>>, forceRegen = false) {
  const quarter = getCurrentQuarter()
  const now = new Date().toISOString()

  for (const dept of DEPARTMENTS) {
    const existing = await db.execute({
      sql: 'SELECT quarter FROM dept_codes WHERE department = ?',
      args: [dept],
    })
    const row = existing.rows[0] as unknown as { quarter: string } | undefined

    if (!row || row.quarter !== quarter || forceRegen) {
      const code = randomCode()
      await db.execute({
        sql: `INSERT INTO dept_codes (department, code, quarter, created_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(department) DO UPDATE SET code = excluded.code, quarter = excluded.quarter, created_at = excluded.created_at`,
        args: [dept, code, quarter, now],
      })
    }
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureSchema()
  const db = getDb()
  await ensureCodes(db)
  const result = await db.execute('SELECT * FROM dept_codes ORDER BY department')
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureSchema()
  const db = getDb()
  await ensureCodes(db, true)
  const result = await db.execute('SELECT * FROM dept_codes ORDER BY department')
  return NextResponse.json(result.rows)
}
