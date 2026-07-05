'use client'

import { useRouter } from 'next/navigation'

const YEARLY_ITEMS = [
  {
    icon: '🏢',
    title: 'ยื่นภาษีนิติบุคคล (ภ.ง.ด.50)',
    description: 'ภายใน 30 พ.ค. (ออนไลน์ขยายถึง 7 มิ.ย.)',
  },
  {
    icon: '📑',
    title: 'ส่งงบการเงิน (DBD)',
    description: 'ภายใน 30 พ.ค.',
  },
  {
    icon: '📋',
    title: 'ยื่นภาษีครึ่งปี (ภ.ง.ด.51)',
    description: 'ภายใน 31 ส.ค.',
  },
  {
    icon: '👤',
    title: 'ยื่นภาษีผู้ถือหุ้น (ภ.ง.ด.90/91)',
    description: 'ภายใน 31 มี.ค.',
  },
  {
    icon: '🛡️',
    title: 'ต่อประกันสังคมประจำปี',
    description: 'ภายใน 31 ม.ค.',
  },
]

export default function WorkflowYearlyPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 py-5 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-base font-bold">Workflow รายปี</h1>
            <p className="text-xs opacity-60 mt-0.5">บัญชี&amp;การเงิน</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-3">
        <p className="text-xs text-gray-400 mb-4">รายการงานประจำปีและกำหนดยื่น</p>

        {YEARLY_ITEMS.map((item) => (
          <div
            key={item.title}
            className="flex items-center gap-3 bg-white border border-[#E2E8F0] rounded-2xl p-4 opacity-60 cursor-not-allowed"
          >
            <div className="w-10 h-10 bg-[#1E3A5F] rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
              {item.icon}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-[#1E3A5F]">{item.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
            </div>
            <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">
              เร็วๆ นี้
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
