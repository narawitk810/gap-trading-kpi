export const DEPARTMENTS = [
  'ไลฟ์สด',
  'sale admin',
  'การตลาด',
  'Creative',
  'บัญชี',
  'ธุรการ',
  'บุคคล',
  'สต๊อค&จัดซื้อ',
  'แพค',
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
