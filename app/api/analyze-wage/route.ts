import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const DEPT_CONTEXT: Record<string, string> = {
  'Creative': 'ตัดต่อวีดีโอ, สร้าง content, ถ่ายภาพ, ออกแบบกราฟิก, ทำ thumbnail',
  'การตลาด': 'ลง Ads, วิเคราะห์ยอดขาย, สร้าง campaign, ดูแลโซเชียลมีเดีย, ทำรายงาน',
  'บัญชี': 'บันทึกบัญชี, ตรวจสอบเอกสารการเงิน, จัดทำรายงาน, กระทบยอด',
  'ธุรการ': 'จัดเอกสาร, ประสานงาน, ดูแลสำนักงาน, จัดซื้อ, รับ-ส่งเอกสาร',
  'บุคคล': 'สรรหาพนักงาน, ดูแล HR, จัดทำสัญญา, เช็คเวลา, ดูแลสวัสดิการ',
  'Stock': 'จัดการสินค้าคงคลัง, รับ-จ่ายสินค้า, ตรวจนับ stock, อัปเดตระบบ',
  'แพค': 'แพคสินค้า, จัดเรียงออเดอร์, เตรียมส่ง, ตรวจสอบความถูกต้อง',
  'ผู้จัดการ': 'วางแผนงาน, ประชุมทีม, ติดตามผล, แก้ปัญหา, รายงานผู้บริหาร',
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { entry_id, department, tasks, obstacles, base_rate } = body

  if (!department || !tasks || !base_rate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const client = new Anthropic({ apiKey })
  const deptContext = DEPT_CONTEXT[department] || 'งานทั่วไป'
  const taskList = (tasks as string[]).filter((t: string) => t.trim()).join(', ')

  const prompt = `คุณคือผู้ประเมิน KPI ของบริษัท GAP TRADING

แผนก: ${department}
หน้าที่หลักของแผนก: ${deptContext}
ฐานค่าแรง: ${base_rate} บาท/วัน
งานที่พนักงานรายงานวันนี้: ${taskList}
อุปสรรค: ${obstacles || 'ไม่มี'}

ประเมินว่างานที่รายงานตรงกับหน้าที่แผนกแค่ไหน และควรได้ค่าแรงเท่าไหร่

ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น:
{"score": <0-100>, "estimated_wage": <จำนวนเงินบาท>, "verdict": "<ดีมาก|ดี|พอใช้|ต่ำ|ไม่ตรงงาน>", "reason": "<อธิบายภาษาไทย 1 ประโยค>"}`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = (message.content[0] as { type: string; text: string }).text.trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json({ entry_id, ...result })
  } catch (err) {
    console.error('AI analysis error:', err)
    return NextResponse.json({ error: 'วิเคราะห์ไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 })
  }
}
