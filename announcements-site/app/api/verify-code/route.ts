import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { department, code } = body

  if (!department || !code) {
    return NextResponse.json({ valid: false }, { status: 400 })
  }

  const db = getDb()
  const result = await db.execute({
    sql: 'SELECT code FROM dept_codes WHERE department = ?',
    args: [department],
  })
  const row = result.rows[0] as unknown as { code: string } | undefined

  return NextResponse.json({ valid: row?.code === code.trim() })
}
