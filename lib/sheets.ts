import type { KPIEntry } from '@/types/kpi'

export async function appendKPIRow(entry: KPIEntry): Promise<void> {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL
  if (!scriptUrl) return

  try {
    await fetch(scriptUrl, {
      method: 'POST',
      // Apps Script ต้องการ text/plain เพื่อให้ e.postData.contents ทำงานถูกต้อง
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        id: entry.id,
        date: entry.date,
        time: entry.time,
        department: entry.department,
        nickname: entry.nickname,
        channel_name: entry.channel_name,
        tasks: entry.tasks,
        obstacles: entry.obstacles,
        extra_data: entry.extra_data || '',
        created_at: entry.created_at,
      }),
    })
  } catch (err) {
    console.error('[Google Sheets] sync failed:', err instanceof Error ? err.message : err)
    // ไม่ throw — Sheets failure ต้องไม่กระทบการบันทึก SQLite หลัก
  }
}
