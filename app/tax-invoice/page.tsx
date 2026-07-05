'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DEPARTMENTS } from '@/types/kpi'

const TAX_INVOICE_DEPTS = ['บัญชี&การเงิน', 'สต๊อค&จัดซื้อ', 'ธุรการ']

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 800
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
          else { width = Math.round((width * MAX) / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getTodayDate() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

type PageState = 'form' | 'confirm' | 'success'

export default function TaxInvoicePage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [pageState, setPageState] = useState<PageState>('form')
  const [submitting, setSubmitting] = useState(false)
  const [submittedId, setSubmittedId] = useState('')

  const [nickname, setNickname] = useState('')
  const [department, setDepartment] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(getTodayDate())
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [imageName, setImageName] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErrors((p) => ({ ...p, image: '' }))
    if (!file.type.startsWith('image/')) {
      setErrors((p) => ({ ...p, image: 'รองรับเฉพาะรูปภาพเท่านั้น' }))
      return
    }
    try {
      const data = await compressImage(file)
      setImageData(data)
      setImageName(file.name)
    } catch {
      setErrors((p) => ({ ...p, image: 'โหลดรูปไม่ได้ กรุณาลองใหม่' }))
    }
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!nickname.trim()) e.nickname = 'กรุณากรอกชื่อเล่น'
    if (!department) e.department = 'กรุณาเลือกแผนก'
    if (!invoiceDate) e.invoiceDate = 'กรุณาระบุวันที่ในใบกำกับ'
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) e.amount = 'กรุณากรอกยอดเงินที่ถูกต้อง'
    if (!imageData) e.image = 'กรุณาแนบรูปใบกำกับภาษี'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext() {
    if (validate()) setPageState('confirm')
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/tax-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          department,
          invoice_date: invoiceDate,
          amount: Number(amount),
          description: description.trim(),
          image_data: imageData,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSubmittedId(data.id)
        setPageState('success')
      } else {
        alert(data.error || 'เกิดข้อผิดพลาด')
        setPageState('form')
      }
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาตรวจสอบการเชื่อมต่อ')
      setPageState('form')
    } finally {
      setSubmitting(false)
    }
  }

  const vat = amount && !isNaN(Number(amount)) ? Math.round(Number(amount) * 7 / 107 * 100) / 100 : 0
  const inputClass = 'w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]'

  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🧾</div>
          <h2 className="text-xl font-bold text-[#1E3A5F] mb-2">บันทึกสำเร็จ</h2>
          <p className="text-gray-500 text-sm mb-1">รหัส: <span className="font-mono text-xs">{submittedId}</span></p>
          <p className="text-gray-400 text-xs mb-6">ใบกำกับภาษีถูกบันทึกเรียบร้อยแล้ว</p>
          <button onClick={() => router.push('/')}
            className="w-full bg-[#1E3A5F] text-white py-3 rounded-xl font-semibold text-sm">
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 py-5 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => pageState === 'confirm' ? setPageState('form') : router.back()}
            className="text-white/70 hover:text-white text-lg w-8">←</button>
          <div>
            <h1 className="text-base font-bold">รวมใบกำกับภาษีซื้อ</h1>
            <p className="text-xs opacity-60 mt-0.5">
              {pageState === 'form' ? 'กรอกข้อมูลและแนบรูปใบกำกับ' : 'ตรวจสอบข้อมูลก่อนบันทึก'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-10">

        {pageState === 'form' && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              {/* ชื่อเล่น */}
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                  ชื่อเล่น <span className="text-[#DC2626]">*</span>
                </label>
                <input type="text" value={nickname}
                  onChange={(e) => { setNickname(e.target.value); setErrors((p) => ({ ...p, nickname: '' })) }}
                  placeholder="ชื่อเล่นของคุณ"
                  className={inputClass} />
                {errors.nickname && <p className="text-[#DC2626] text-xs mt-1">{errors.nickname}</p>}
              </div>

              {/* แผนก */}
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                  แผนก <span className="text-[#DC2626]">*</span>
                </label>
                <select value={department}
                  onChange={(e) => { setDepartment(e.target.value); setErrors((p) => ({ ...p, department: '' })) }}
                  className={inputClass}>
                  <option value="">เลือกแผนก</option>
                  {DEPARTMENTS.filter((d) => TAX_INVOICE_DEPTS.includes(d)).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                {errors.department && <p className="text-[#DC2626] text-xs mt-1">{errors.department}</p>}
              </div>

              {/* วันที่ในใบกำกับ */}
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                  วันที่ในใบกำกับภาษี <span className="text-[#DC2626]">*</span>
                </label>
                <input type="date" value={invoiceDate}
                  onChange={(e) => { setInvoiceDate(e.target.value); setErrors((p) => ({ ...p, invoiceDate: '' })) }}
                  className={inputClass} />
                {errors.invoiceDate && <p className="text-[#DC2626] text-xs mt-1">{errors.invoiceDate}</p>}
              </div>

              {/* ยอดเงินรวม VAT */}
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                  ยอดรวมในใบกำกับ (รวม VAT แล้ว) <span className="text-[#DC2626]">*</span>
                </label>
                <div className="relative">
                  <input type="number" min="0" step="0.01" value={amount}
                    onChange={(e) => { setAmount(e.target.value); setErrors((p) => ({ ...p, amount: '' })) }}
                    placeholder="0.00"
                    className={inputClass + ' pr-10'} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">บาท</span>
                </div>
                {amount && !isNaN(Number(amount)) && Number(amount) > 0 && (
                  <p className="text-xs text-[#16A34A] mt-1">
                    VAT ซื้อ 7% = {vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                  </p>
                )}
                {errors.amount && <p className="text-[#DC2626] text-xs mt-1">{errors.amount}</p>}
              </div>

              {/* คำอธิบาย */}
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                  รายละเอียด / ชื่อผู้ขาย
                  <span className="text-xs font-normal text-gray-400 ml-1">(ไม่บังคับ)</span>
                </label>
                <input type="text" value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="เช่น ซื้อสินค้าจาก บ.ABC จำกัด"
                  className={inputClass} />
              </div>

              {/* แนบรูปใบกำกับ */}
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                  รูปใบกำกับภาษี <span className="text-[#DC2626]">*</span>
                </label>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
                {imageData ? (
                  <div className="space-y-2">
                    <img src={imageData} alt="ใบกำกับ" className="w-full max-h-52 object-cover rounded-xl border border-[#E2E8F0]" />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-400 truncate">{imageName}</p>
                      <button type="button"
                        onClick={() => { setImageData(null); setImageName(''); if (fileRef.current) fileRef.current.value = '' }}
                        className="text-[#DC2626] text-xs font-semibold hover:underline shrink-0 ml-2">ลบ</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-[#E2E8F0] rounded-xl py-8 flex flex-col items-center gap-1.5 hover:border-[#1E3A5F] transition-colors">
                    <span className="text-3xl">🧾</span>
                    <span className="text-sm text-gray-400">แตะเพื่อถ่ายรูปหรือเลือกจากคลัง</span>
                  </button>
                )}
                {errors.image && <p className="text-[#DC2626] text-xs mt-1">{errors.image}</p>}
              </div>
            </div>

            <button onClick={handleNext}
              className="w-full bg-[#1E3A5F] text-white py-3.5 rounded-xl font-semibold text-sm">
              ตรวจสอบข้อมูล →
            </button>
          </>
        )}

        {pageState === 'confirm' && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-[#1E3A5F]">ตรวจสอบข้อมูลก่อนบันทึก</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">ชื่อเล่น</p>
                  <p className="font-semibold text-[#374151]">{nickname}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">แผนก</p>
                  <p className="font-semibold text-[#374151]">{department}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">วันที่ในใบกำกับ</p>
                  <p className="font-semibold text-[#374151]">{invoiceDate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">ยอดรวม</p>
                  <p className="font-semibold text-[#374151]">{Number(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">VAT ซื้อ 7%</p>
                  <p className="font-semibold text-[#16A34A]">{vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</p>
                </div>
                {description && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-0.5">รายละเอียด</p>
                    <p className="font-semibold text-[#374151]">{description}</p>
                  </div>
                )}
              </div>
              {imageData && (
                <img src={imageData} alt="ใบกำกับ" className="w-full max-h-52 object-cover rounded-xl border border-[#E2E8F0]" />
              )}
            </div>

            <button onClick={handleSubmit} disabled={submitting}
              className="w-full bg-[#16A34A] text-white py-3.5 rounded-xl font-semibold text-sm disabled:opacity-60">
              {submitting ? 'กำลังบันทึก...' : 'ยืนยันบันทึกใบกำกับ'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
