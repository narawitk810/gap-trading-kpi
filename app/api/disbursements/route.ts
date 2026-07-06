import { NextRequest, NextResponse } from 'next/server'
import { getDb, generateId, ensureSchema } from '@/lib/db'

export async function GET(request: NextRequest) {
  await ensureSchema()
  const db = getDb()

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  let query = 'SELECT * FROM disbursements WHERE 1=1'
  const args: string[] = []

  if (status) {
    query += ' AND status = ?'
    args.push(status)
  }

  query += ' ORDER BY created_at DESC'

  const result = await db.execute({ sql: query, args })
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  if (
    !body.requester?.trim() ||
    !body.item_list?.trim() ||
    !body.amount ||
    isNaN(Number(body.amount)) ||
    Number(body.amount) <= 0 ||
    !body.request_date ||
    !body.request_doc
  ) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }

  await ensureSchema()
  const db = getDb()
  const id = generateId()
  const now = new Date().toISOString()

  await db.execute({
    sql: `INSERT INTO disbursements
          (id, requester, item_list, requested_amount, request_doc, request_date, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'pending_approval', ?)`,
    args: [
      id,
      body.requester.trim(),
      body.item_list.trim(),
      Number(body.amount),
      body.request_doc,
      body.request_date,
      now,
    ],
  })

  return NextResponse.json({ id }, { status: 201 })
}
