'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

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

export default function NewDisbursementPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [pageState, setPageState] = useState<PageState>('form')
  const [submitting, setSubmitting] = useState(false)
  const [submittedId, setSubmittedId] = useState('')

  const [requester, setRequester] = useState('')
  const [itemList, setItemList] = useState('')
  const [amount, setAmount] = useState('')
  const [requestDate, setRequestDate] = useState(getTodayDate())
  const [imageData, setImageData] = useState<string | null>(null)
  const [imageName, setImageName] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const inputClass = 'w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]'

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
    if (!requester.trim()) e.requester = 'กรุณากรอกชื่อผู้ขอเบิก'
    if (!itemList.trim()) e.itemList = 'กรุณากรอกรายการที่ขอ'
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) e.amount = 'กรุณากรอกยอดเงินที่ถูกต้อง'
    if (!requestDate) e.requestDate = 'กรุณาระบุวันที่'
    if (!imageData) e.image = 'กรุณาแนบเอกสาร'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext() {
    if (validate()) setPageState('confirm')
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/disbursements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requester: requester.trim(),
          item_list: itemList.trim(),
          amount: Number(amount),
          request_date: requestDate,
          request_doc: imageData,
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

  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">💸</div>
          <h2 className="text-xl font-bold text-[#1E3A5F] mb-2">ส่งคำขอสำเร็จ</h2>
          <p className="text-gray-500 text-sm mb-1">รหัส: <span className="font-mono text-xs">{submittedId}</span></p>
          <p className="text-gray-400 text-xs mb-6">คำขอเบิกจ่ายถูกบันทึกแล้ว รอบัญชีอนุมัติ</p>
          <div className="space-y-2">
            <button
              onClick={() => {
                setPageState('form')
                setRequester(''); setItemList(''); setAmount('')
                setRequestDate(getTodayDate()); setImageData(null); setImageName('')
                setErrors({}); setSubmittedId('')
              }}
              className="w-full bg-[#1E3A5F] text-white py-3 rounded-xl font-semibold text-sm"
            >
              ส่งรายการใหม่
            </button>
            <button onClick={() => router.push('/disbursement')}
              className="w-full border border-[#E2E8F0] text-[#374151] py-3 rounded-xl font-semibold text-sm">
              กลับหน้าเบิกจ่าย
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <div className="bg-[#1E3A5F] text-white px-4 py-5 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => pageState === 'confirm' ? setPageState('form') : router.push('/disbursement')}
            className="text-white/70 hover:text-white text-lg w-8"
          >←</button>
          <div>
            <h1 className="text-base font-bold">จัดซื้อขอเบิก</h1>
            <p className="text-xs opacity-60 mt-0.5">
              {pageState === 'form' ? 'กรอกรายการสั่งซื้อ และแนบเอกสาร' : 'ตรวจสอบข้อมูลก่อนส่ง'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-10">

        {pageState === 'form' && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">

              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                  ชื่อผู้ขอเบิก <span className="text-[#DC2626]">*</span>
                </label>
                <input type="text" value={requester}
                  onChange={(e) => { setRequester(e.target.value); setErrors((p) => ({ ...p, requester: '' })) }}
                  placeholder="ชื่อเล่นหรือชื่อ-นามสกุล"
                  className={inputClass} />
                {errors.requester && <p className="text-[#DC2626] text-xs mt-1">{errors.requester}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                  รายการที่ขอ <span className="text-[#DC2626]">*</span>
                </label>
                <textarea value={itemList}
                  onChange={(e) => { setItemList(e.target.value); setErrors((p) => ({ ...p, itemList: '' })) }}
                  placeholder="ระบุรายการสินค้า/บริการที่ต้องการสั่งซื้อ"
                  rows={4}
                  className={inputClass + ' resize-none'} />
                {errors.itemList && <p className="text-[#DC2626] text-xs mt-1">{errors.itemList}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                  ยอดที่ขอเบิก <span className="text-[#DC2626]">*</span>
                </label>
                <div className="relative">
                  <input type="number" min="0" step="0.01" value={amount}
                    onChange={(e) => { setAmount(e.target.value); setErrors((p) => ({ ...p, amount: '' })) }}
                    placeholder="0.00"
                    className={inputClass + ' pr-10'} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">บาท</span>
                </div>
                {errors.amount && <p className="text-[#DC2626] text-xs mt-1">{errors.amount}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                  วันที่ขอ <span className="text-[#DC2626]">*</span>
                </label>
                <input type="date" value={requestDate}
                  onChange={(e) => { setRequestDate(e.target.value); setErrors((p) => ({ ...p, requestDate: '' })) }}
                  className={inputClass} />
                {errors.requestDate && <p className="text-[#DC2626] text-xs mt-1">{errors.requestDate}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                  เอกสารแนบ <span className="text-[#DC2626]">*</span>
                </label>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
                {imageData ? (
                  <div className="space-y-2">
                    <img src={imageData} alt="เอกสาร" className="w-full max-h-52 object-cover rounded-xl border border-[#E2E8F0]" />
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
                    <span className="text-3xl">📎</span>
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
              <h3 className="text-base font-bold text-[#1E3A5F]">ตรวจสอบข้อมูลก่อนส่ง</h3>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">ผู้ขอเบิก</p>
                    <p className="font-semibold text-[#374151]">{requester}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">วันที่ขอ</p>
                    <p className="font-semibold text-[#374151]">{requestDate}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">รายการที่ขอ</p>
                  <p className="font-semibold text-[#374151] whitespace-pre-wrap">{itemList}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">ยอดที่ขอเบิก</p>
                  <p className="font-semibold text-orange-700 text-base">
                    {Number(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                  </p>
                </div>
              </div>
              {imageData && (
                <img src={imageData} alt="เอกสาร" className="w-full max-h-52 object-cover rounded-xl border border-[#E2E8F0]" />
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setPageState('form')}
                className="flex-1 border border-[#E2E8F0] text-[#374151] py-3.5 rounded-xl font-semibold text-sm">
                แก้ไข
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 bg-orange-600 text-white py-3.5 rounded-xl font-semibold text-sm disabled:opacity-60">
                {submitting ? 'กำลังส่ง...' : 'ยืนยันส่งคำขอ'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
