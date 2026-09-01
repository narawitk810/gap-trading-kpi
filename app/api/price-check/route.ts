import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  let body: { image_data?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.image_data) {
    return NextResponse.json({ error: 'กรุณาแนบรูปภาพ' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const dataUri = body.image_data
  const [header, base64Data] = dataUri.split(',')
  const mediaType = header.replace('data:', '').replace(';base64', '') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

  const client = new Anthropic({ apiKey })

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            {
              type: 'text',
              text: 'วิเคราะห์สินค้าในรูปนี้ แล้วสร้าง search keyword ที่เหมาะสมสำหรับค้นหาใน:\n- Taobao (ภาษาจีนกลาง)\n- eBay (ภาษาอังกฤษ)\n- Shopee Thailand (ภาษาไทย)\n\nตอบด้วย JSON เท่านั้น ไม่มีข้อความอื่น:\n{"keywords_zh":"...","keywords_en":"...","keywords_th":"..."}',
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'วิเคราะห์ไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 })
    }
    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (e) {
    console.error('[price-check]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
