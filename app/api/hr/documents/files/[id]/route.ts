import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const db = await getDb()
  const rows = await db.execute({
    sql: 'SELECT name, file_type, file_data FROM hr_files WHERE id=?',
    args: [params.id],
  })
  if (!rows.rows[0]) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 404 })

  const row = rows.rows[0] as unknown as { name: string; file_type: string; file_data: string }

  // file_data is a data URI: "data:<mime>;base64,<data>"
  const { name, file_type, file_data } = row
  const base64 = file_data.includes(',') ? file_data.split(',')[1] : file_data
  const mimeType = file_data.includes(',')
    ? file_data.split(',')[0].replace('data:', '').replace(';base64', '')
    : getMime(file_type)

  const buffer = Buffer.from(base64, 'base64')

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Content-Length': String(buffer.length),
    },
  })
}

function getMime(ext: string): string {
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
  }
  return map[ext.toLowerCase()] ?? 'application/octet-stream'
}
