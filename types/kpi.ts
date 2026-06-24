export const DEPARTMENTS = [
  'ไลฟ์สด',
  'การตลาด',
  'Creative',
  'บัญชี',
  'ธุรการ',
  'บุคคล',
  'Stock',
  'แพค',
  'ผู้จัดการ',
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
