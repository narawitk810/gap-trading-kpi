async function sendLinePushMessage(groupId: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token || !groupId) return
  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: groupId, messages: [{ type: 'text', text }] }),
    })
  } catch (err) {
    console.error('[LINE] push failed:', err instanceof Error ? err.message : err)
    // ไม่ throw — การแจ้งเตือนล้มเหลวต้องไม่กระทบ flow การรับทราบหลัก
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
  const baseUrl = process.env.APP_BASE_URL
  const text = [
    '🎁 มีโปรซื้อครบใหม่ที่ Admin อนุมัติแล้ว',
    `สินค้า: ${promo.product_name}`,
    `ซื้อครบ: ${promo.threshold_amount} บาท`,
    `ช่วงโปร: ${fmt(promo.start_month)} – ${fmt(promo.end_month)}`,
    baseUrl ? `ดูรายละเอียด: ${baseUrl}/promo-list` : '',
  ].filter(Boolean).join('\n')

  const groupIds = [process.env.LINE_GROUP_ID_LIVE, process.env.LINE_GROUP_ID_MARKETING]
    .filter((id): id is string => !!id)
  await Promise.all(groupIds.map((id) => sendLinePushMessage(id, text)))
}
