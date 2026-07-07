import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { entries, date } = body

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: 'ไม่มีข้อมูลสำหรับวิเคราะห์' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const client = new Anthropic({ apiKey })

  const deptSummary = (entries as { department: string; nickname: string; tasks: string[]; obstacles: string }[])
    .map((e) => {
      const tasks = e.tasks.filter((t: string) => t.trim()).join(', ')
      return `- [${e.department}] ${e.nickname}: งาน = ${tasks || 'ไม่ระบุ'}${e.obstacles ? ` | อุปสรรค = ${e.obstacles}` : ''}`
    })
    .join('\n')

  const deptCount: Record<string, number> = {}
  for (const e of entries as { department: string }[]) {
    deptCount[e.department] = (deptCount[e.department] || 0) + 1
  }
  const deptStat = Object.entries(deptCount).map(([d, n]) => `${d} (${n} คน)`).join(', ')

  const prompt = `คุณคือที่ปรึกษาด้าน HR ของบริษัท GAP TRADING วิเคราะห์ KPI ภาพรวมประจำวัน ${date}

จำนวนพนักงานที่บันทึก KPI: ${entries.length} คน
แผนกที่บันทึก: ${deptStat}

รายละเอียดงานแต่ละคน:
${deptSummary}

วิเคราะห์ภาพรวมทั้งองค์กรในวันนี้ ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น:
{
  "overall": "<สรุปภาพรวมองค์กรวันนี้ ภาษาไทย 2-3 ประโยค>",
  "strong_depts": "<แผนกที่ทำงานได้ดี/โดดเด่น>",
  "concern_depts": "<แผนกหรือประเด็นที่น่าเป็นห่วง>",
  "common_obstacles": "<อุปสรรคที่พบบ่อยหรือซ้ำกันหลายคน หรือ 'ไม่มี'>",
  "recommendation": "<คำแนะนำสั้นๆ สำหรับผู้บริหาร 1-2 ประโยค>"
}`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = (message.content[0] as { type: string; text: string }).text.trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (err) {
    console.error('AI overview analysis error:', err)
    return NextResponse.json({ error: 'วิเคราะห์ไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 })
  }
}
