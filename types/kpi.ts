export const DEPARTMENTS = [
  'ไลฟ์สด',
  'Sales Admin',
  'Store Retail',
  'การตลาด',
  'Creative',
  'สต๊อค&จัดซื้อ',
  'ธุรการ',
  'บัญชี&การเงิน',
  'แพค',
  'บุคคล',
  'ผู้จัดการไลฟ์สด',
  'ผู้จัดการหน้าร้าน',
] as const

export type Department = (typeof DEPARTMENTS)[number]

export interface KPIEntry {
  id: string
  department: string
  date: string
  time: string
  nickname: string
  channel_name: string
  tasks: string[]
  obstacles: string
  extra_data: string
  created_at: string
}

export interface KPIEntryCreate {
  department: string
  date: string
  time: string
  nickname: string
  channel_name: string
  tasks: string[]
  obstacles: string
  extra_data?: Record<string, unknown>
}
