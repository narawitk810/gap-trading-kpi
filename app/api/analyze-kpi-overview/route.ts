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
      const taskList = Array.isArray(e.tasks)
        ? e.tasks.filter((t: string) => t.trim()).join(', ')
        : String(e.tasks)
      return `[${e.department}] ${e.nickname}: ${taskList || 'ไม่ระบุ'}${e.obstacles ? ` (อุปสรรค: ${e.obstacles})` : ''}`
    })
    .join('\n')

  const deptCount: Record<string, number> = {}
  for (const e of entries as { department: string }[]) {
    deptCount[e.department] = (deptCount[e.department] || 0) + 1
  }
  const deptStat = Object.entries(deptCount).map(([d, n]) => `${d}:${n}คน`).join(', ')

  const prompt = `วิเคราะห์ KPI ภาพรวมของบริษัท GAP TRADING วันที่ ${date}
พนักงาน ${entries.length} คน แผนก: ${deptStat}

${deptSummary}

ตอบ JSON เท่านั้น ห้าม markdown ห้าม code fence แต่ละ field ไม่เกิน 1 ประโยค:
{"overall":"...","strong_depts":"...","concern_depts":"...","common_obstacles":"...","recommendation":"..."}`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: 'ตอบเป็น raw JSON เท่านั้น ห้าม markdown ห้าม ```json ห้ามมีข้อความอื่น',
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()
    // strip markdown code fences if present
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

    let result
    try {
      result = JSON.parse(text)
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error(`Model returned: ${text.slice(0, 200)}`)
      result = JSON.parse(jsonMatch[0])
    }

    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('AI overview analysis error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
