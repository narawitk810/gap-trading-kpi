export async function sendLinePushMessage(groupId: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token || !groupId) return
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: groupId, messages: [{ type: 'text', text }] }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`[LINE] push failed (${res.status}):`, body)
    }
  } catch (err) {
    console.error('[LINE] push failed:', err instanceof Error ? err.message : err)
  }
}

export async function notifyTiktokSeller(item: {
  id: string
  product_name: string
  quantity: string
  packs_per_box: string
  pricing_data: string | null
  allocation: string | null
  sku_code_box: string | null
  sku_code_pack: string | null
  image_ref?: string | null
}): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const groupId = process.env.LINE_GROUP_ID_LIVE
  if (!token || !groupId) return

  type P = {
    box_price_system: number; box_price_external: number
    pack_price_system: number; pack_price_external: number
    box_system_enabled?: boolean; box_no_external?: boolean
    break_enabled?: boolean; no_pack_sale?: boolean
  }
  let p: P | null = null
  try { p = item.pricing_data ? JSON.parse(item.pricing_data) : null } catch { p = null }

  const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  // รูปใหม่ (Vercel Blob) → ใช้ URL ตรง LINE ดึงจาก CDN ได้เลย
  // รูปเก่า (base64 legacy) → proxy แปลงเป็น binary ให้ LINE
  let imageUrl: string | null = null
  if (item.image_ref) {
    if (item.image_ref.startsWith('https://')) {
      imageUrl = item.image_ref
    } else {
      imageUrl = `https://gap-trading-kpi.vercel.app/api/stock-prices?image_id=${item.id}&proxy=1`
    }
  }

  const lines = [
    '🛒 สินค้า TikTok Seller ใหม่!',
    '⏰ ช่วงเวลาลงสินค้า 10:00–19:00 น.',
    '',
    `📦 ${item.product_name}`,
    `จำนวน: ${item.quantity} | ${item.packs_per_box} ซอง/กล่อง`,
  ]
  if (p) {
    lines.push('', '💰 ราคา:')
    if (p.box_system_enabled !== false)
      lines.push(`• ยกกล่อง (ในระบบ): ${fmt(p.box_price_system)} บาท`)
    if (!p.box_no_external)
      lines.push(`• ยกกล่อง (โยนนอก): ${fmt(p.box_price_external)} บาท`)
    if (!p.no_pack_sale && !p.break_enabled)
      lines.push(`• แยกซอง (ในระบบ): ${fmt(p.pack_price_system)} บาท`)
    if (!p.no_pack_sale)
      lines.push(`• แยกซอง (โยนนอก): ${fmt(p.pack_price_external)} บาท${p.break_enabled ? ' (เปิด break เท่านั้น)' : ''}`)
  }
  lines.push(`👤 มอบหมาย: ${item.allocation || 'ยังไม่ระบุ'}`)
  if (item.sku_code_box || item.sku_code_pack) {
    lines.push('')
    if (item.sku_code_box) lines.push(`📋 SKU กล่อง: ${item.sku_code_box}`)
    if (item.sku_code_pack) lines.push(`📋 SKU ซอง: ${item.sku_code_pack}`)
  }

  const messages: object[] = []
  if (imageUrl) {
    messages.push({ type: 'image', originalContentUrl: imageUrl, previewImageUrl: imageUrl })
  }
  messages.push({ type: 'text', text: lines.join('\n') })

  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: groupId, messages }),
    })
  } catch (err) {
    console.error('[LINE] tiktokSeller failed:', err instanceof Error ? err.message : err)
  }
}

export async function notifyLiveUrgentRequest(item: {
  id: string
  nickname: string
  product_name: string
  quantity: string
  note?: string
  image_data?: string | null
}): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const groupId = process.env.LINE_GROUP_ID_LIVE
  if (!token || !groupId) return

  let imageUrl: string | null = null
  if (item.image_data) {
    if (item.image_data.startsWith('https://')) {
      imageUrl = item.image_data
    } else {
      imageUrl = `https://gap-trading-kpi.vercel.app/api/live-urgent-request?image_id=${item.id}&proxy=1`
    }
  }

  const lines = [
    '🚨 ขอสินค้าเร่งด่วน!',
    '',
    `👤 พนักงาน: ${item.nickname}`,
    `📦 สินค้า: ${item.product_name}`,
    `🔢 จำนวน: ${item.quantity}`,
  ]
  if (item.note?.trim()) lines.push(`📝 หมายเหตุ: ${item.note.trim()}`)

  const messages: object[] = []
  if (imageUrl) {
    messages.push({ type: 'image', originalContentUrl: imageUrl, previewImageUrl: imageUrl })
  }
  messages.push({ type: 'text', text: lines.join('\n') })

  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: groupId, messages }),
    })
  } catch (err) {
    console.error('[LINE] liveUrgentRequest failed:', err instanceof Error ? err.message : err)
  }
}

export async function notifyPromoAcknowledged(promo: {
  product_name: string
  threshold_amount: string
  start_month: string
  end_month: string
}): Promise<void> {
  const names = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  const fmt = (m: string) => {
    const [y, mo] = m.split('-')
    return `${names[parseInt(mo) - 1]} ${parseInt(y) + 543}`
  }
  const text = [
    '🎁 มีโปรซื้อครบใหม่ที่ Admin อนุมัติแล้ว',
    `สินค้า: ${promo.product_name}`,
    `ซื้อครบ: ${promo.threshold_amount} บาท`,
    `ช่วงโปร: ${fmt(promo.start_month)} – ${fmt(promo.end_month)}`,
    'ดูรายละเอียด: https://gap-trading-kpi.vercel.app/promo-list',
  ].join('\n')

  const groupIds = [process.env.LINE_GROUP_ID_LIVE]
    .filter((id): id is string => !!id)
  await Promise.all(groupIds.map((id) => sendLinePushMessage(id, text)))
}
