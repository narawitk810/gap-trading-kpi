import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'

const ADMIN_KEY = process.env.ADMIN_KEY || 'GAPtrading2024admin'

type RawRow = {
  id: string
  nickname: string
  department: string
  amount: number
  invoice_date: string
  description: string
  image_data: string
  created_at: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureSchema()
  const db = getDb()

  const month = searchParams.get('month') // YYYY-MM
  let query = 'SELECT * FROM tax_invoices WHERE 1=1'
  const args: string[] = []

  if (month) {
    query += ' AND invoice_date LIKE ?'
    args.push(`${month}%`)
  }

  query += ' ORDER BY invoice_date DESC, created_at DESC'

  const result = await db.execute({ sql: query, args })
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  if (
    !body.nickname?.trim() ||
    !body.department?.trim() ||
    !body.invoice_date ||
    !body.amount ||
    isNaN(Number(body.amount)) ||
    Number(body.amount) <= 0 ||
    !body.image_data
  ) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }

  await ensureSchema()
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()

  await db.execute({
    sql: `INSERT INTO tax_invoices (id, nickname, department, amount, invoice_date, description, image_data, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      body.nickname.trim(),
      body.department.trim(),
      Number(body.amount),
      body.invoice_date,
      body.description?.trim() || '',
      body.image_data,
      now,
    ],
  })

  return NextResponse.json({ id }, { status: 201 })
}
