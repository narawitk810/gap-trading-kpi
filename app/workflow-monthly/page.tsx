'use client'

import { useRouter } from 'next/navigation'

const MONTHLY_ITEMS = [
  {
    icon: '💰',
    title: 'จ่ายเงินเดือน',
    description: 'สิ้นเดือน',
  },
  {
    icon: '📄',
    title: 'หักค่าบริการ ณ ที่จ่าย',
    description: 'ภ.ง.ด.53 ใน 7 วันหลังสิ้นเดือน',
  },
  {
    icon: '🏆',
    title: 'จ่ายคอมมิชชั่น',
    description: 'วันที่ 10',
  },
  {
    icon: '📊',
    title: 'หักภาษีเงินเดือนขั้นบันได',
    description: 'ภ.ง.ด.1 ออนไลน์ถึงวันที่ 15',
  },
  {
    icon: '🛡️',
    title: 'ส่งประกันสังคม',
    description: 'ภายในวันที่ 15',
  },
  {
    icon: '🧾',
    title: 'ยื่น VAT - ภ.พ.30',
    description: 'ยื่นออนไลน์ได้ถึงวันที่ 23',
  },
  {
    icon: '📈',
    title: 'ปิดงบเดือน',
    description: 'ยอดขาย vs เงินเข้า / คำนวณกำไร-ขาดทุน',
  },
]

export default function WorkflowMonthlyPage() {
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
            <h1 className="text-base font-bold">Workflow รายเดือน</h1>
            <p className="text-xs opacity-60 mt-0.5">บัญชี&amp;การเงิน</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-3">
        <p className="text-xs text-gray-400 mb-4">รายการงานประจำเดือนและกำหนดชำระ</p>

        {MONTHLY_ITEMS.map((item) => (
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
