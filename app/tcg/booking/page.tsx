'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

const STORE_HOURS: Record<number, { open: number; close: number; label: string }> = {
  3: { open: 15, close: 20, label: 'วันพุธ 15:00–20:00 น.' },
  4: { open: 15, close: 20, label: 'วันพฤหัสบดี 15:00–20:00 น.' },
  5: { open: 15, close: 20, label: 'วันศุกร์ 15:00–20:00 น.' },
  6: { open: 12, close: 21, label: 'วันเสาร์ 12:00–21:00 น.' },
}

const OPEN_DAYS = new Set([3, 4, 5, 6])

function getTodayLocal() {
  return new Date().toLocaleDateString('sv-SE')
}

function getDayOfWeek(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').getDay()
}

function padHour(h: number) {
  return `${h.toString().padStart(2, '0')}:00`
}

function formatThaiDate(dateStr: string) {
  if (!dateStr) return ''
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
  const d = new Date(dateStr + 'T12:00:00')
  return `วัน${days[d.getDay()]}ที่ ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`
}

export default function BookingPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState('')
  const [startHour, setStartHour] = useState<number | ''>('')
  const [duration, setDuration] = useState(1)
  const [people, setPeople] = useState(2)
  const [note, setNote] = useState('')
  const [dateError, setDateError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [bookingId, setBookingId] = useState('')
  const [bookingStatus, setBookingStatus] = useState<'pending' | 'confirmed' | 'cancelled'>('pending')
  const [lastChecked, setLastChecked] = useState('')
  const [countdown, setCountdown] = useState(10)
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [allBookings, setAllBookings] = useState<Array<{ id: string; name: string; date: string; start_hour: number; duration: number; people: number; status: string }>>([])
  const [statusLoading, setStatusLoading] = useState(false)
  const [muted, setMuted] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => () => { audioRef.current?.pause() }, [])

  function toggleMusic() {
    if (!audioRef.current) {
      const audio = new Audio('/music/lobby.mp3')
      audio.loop = true
      audio.volume = 0.35
      audioRef.current = audio
    }
    if (muted) {
      audioRef.current.play().catch(() => {})
      setMuted(false)
    } else {
      audioRef.current.pause()
      setMuted(true)
    }
  }

  async function loadAllBookings() {
    setStatusLoading(true)
    try {
      const res = await fetch('/api/tcg/bookings?upcoming=true')
      const data = await res.json()
      setAllBookings(data.bookings || [])
    } catch { setAllBookings([]) }
    finally { setStatusLoading(false) }
  }

  useEffect(() => {
    if (!bookingId) return
    const poll = async () => {
      try {
        const res = await fetch(`/api/tcg/bookings?id=${bookingId}`)
        const data = await res.json()
        if (data.booking?.status) {
          setBookingStatus(data.booking.status)
          setLastChecked(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }))
          if (data.booking.status !== 'pending' && pollRef.current) {
            clearInterval(pollRef.current)
          }
        }
      } catch { /* ignore */ }
    }
    poll()
    pollRef.current = setInterval(poll, 10_000)
    const cd = setInterval(() => setCountdown((c) => (c <= 1 ? 10 : c - 1)), 1_000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      clearInterval(cd)
    }
  }, [bookingId])

  const dayOfWeek = date ? getDayOfWeek(date) : -1
  const storeHours = STORE_HOURS[dayOfWeek]

  const startHourOptions = storeHours
    ? Array.from({ length: storeHours.close - storeHours.open }, (_, i) => storeHours.open + i)
    : []

  const maxDuration = storeHours && startHour !== ''
    ? storeHours.close - (startHour as number)
    : 1

  const durationOptions = storeHours && startHour !== ''
    ? Array.from({ length: maxDuration }, (_, i) => i + 1)
    : [1]

  function handleDateChange(val: string) {
    setDate(val)
    setStartHour('')
    setDuration(1)
    setDateError('')
    if (!val) return
    const dow = getDayOfWeek(val)
    if (!OPEN_DAYS.has(dow)) {
      setDateError('ร้านเปิดให้จองเฉพาะวันพุธ พฤหัสบดี ศุกร์ และเสาร์ เท่านั้น')
    }
  }

  function handleStartHourChange(val: number) {
    setStartHour(val)
    setDuration(1)
  }

  function validate() {
    if (!name.trim()) return 'กรุณากรอกชื่อ-นามสกุล'
    if (!phone.trim()) return 'กรุณากรอกเบอร์โทรศัพท์'
    if (!date) return 'กรุณาเลือกวันที่'
    if (dateError) return dateError
    if (startHour === '') return 'กรุณาเลือกเวลาเริ่ม'
    if (duration < 1) return 'จองขั้นต่ำ 1 ชั่วโมง'
    if (people < 2) return 'ต้องมาอย่างน้อย 2 คน'
    return ''
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/tcg/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), date, start_hour: startHour, duration, people, note }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
        setShowConfirm(false)
        return
      }
      setBookingId(data.id)
      setShowConfirm(false)
    } finally {
      setLoading(false)
    }
  }

  if (bookingId) {
    const statusConfig = {
      pending: {
        icon: '📋',
        iconBg: 'bg-yellow-100',
        title: 'ส่งคำขอจองแล้ว!',
        badge: 'bg-yellow-50 border-yellow-200 text-yellow-700',
        dot: 'bg-yellow-400',
        label: 'รอการยืนยันจากทางร้าน',
        desc: 'ทางร้านจะยืนยันเร็วๆ นี้',
      },
      confirmed: {
        icon: '✅',
        iconBg: 'bg-green-100',
        title: 'อนุมัติแล้ว!',
        badge: 'bg-green-50 border-green-200 text-[#16A34A]',
        dot: 'bg-[#16A34A]',
        label: 'ยืนยันการจองเรียบร้อย',
        desc: 'ทางร้านพร้อมต้อนรับคุณแล้ว',
      },
      cancelled: {
        icon: '❌',
        iconBg: 'bg-red-100',
        title: 'ไม่สามารถรับจองได้',
        badge: 'bg-red-50 border-red-200 text-[#DC2626]',
        dot: 'bg-[#DC2626]',
        label: 'ทางร้านขอปฏิเสธการจองนี้',
        desc: 'กรุณาติดต่อร้านเพื่อเลือกเวลาใหม่',
      },
    }
    const cfg = statusConfig[bookingStatus]

    return (
      <div className="min-h-screen bg-[#F5F6F8] flex flex-col items-center justify-center p-6" style={{ fontFamily: "'Noto Sans Thai', 'Sarabun', sans-serif" }}>
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm p-8 text-center space-y-4">
          <div className={`w-16 h-16 ${cfg.iconBg} rounded-2xl flex items-center justify-center mx-auto text-4xl`}>{cfg.icon}</div>
          <p className="text-xl font-bold text-[#1E3A5F]">{cfg.title}</p>
          <div className={`inline-flex items-center gap-2 border text-sm font-semibold px-4 py-2 rounded-full ${cfg.badge}`}>
            <span className={`w-2 h-2 rounded-full inline-block ${cfg.dot}`} />
            {cfg.label}
          </div>
          <p className="text-xs text-gray-400">{cfg.desc}</p>

          <div className="bg-[#F5F6F8] rounded-2xl p-4 space-y-2 text-left text-sm">
            <p className="text-gray-500 text-xs">หมายเลขคำขอ</p>
            <p className="font-bold text-[#1E3A5F] text-xs break-all">{bookingId}</p>
            <hr className="border-[#E2E8F0]" />
            <p><span className="text-gray-500">ชื่อ: </span><span className="font-semibold">{name}</span></p>
            <p><span className="text-gray-500">วันที่: </span><span className="font-semibold">{formatThaiDate(date)}</span></p>
            <p><span className="text-gray-500">เวลา: </span><span className="font-semibold">{padHour(startHour as number)} – {padHour((startHour as number) + duration)} น.</span></p>
            <p><span className="text-gray-500">จำนวน: </span><span className="font-semibold">{people} คน</span></p>
          </div>

          {bookingStatus === 'pending' && (
            <p className="text-xs text-gray-400">
              อัปเดตอัตโนมัติ
              {lastChecked && ` · ตรวจล่าสุด ${lastChecked} น.`}
              {` · รีเฟรชใน ${countdown} วิ`}
            </p>
          )}

          <Link href="/tcg" className="block w-full py-3 bg-[#1E3A5F] text-white font-bold rounded-2xl text-sm">
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    )
  }

  const validationError = validate()

  return (
    <div className="min-h-screen bg-[#F5F6F8]" style={{ fontFamily: "'Noto Sans Thai', 'Sarabun', sans-serif" }}>
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 py-4">
        <div className="flex items-center gap-3">
          <Link href="/tcg" className="text-white/70 text-sm">← กลับ</Link>
          <div>
            <h1 className="text-base font-bold">จองเวลามาเล่น gap7card</h1>
            <p className="text-xs text-blue-200 mt-0.5">พุธ–ศุกร์ 15.00–20.00 น. · เสาร์ 12.00–21.00 น.</p>
          </div>
          <button onClick={toggleMusic} className="ml-auto text-white/70 text-2xl leading-none" title={muted ? 'เปิดเสียง' : 'ปิดเสียง'}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-[#DC2626]">
            {error}
          </div>
        )}

        {/* Contact */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-sm font-bold text-[#1E3A5F]">ข้อมูลผู้จอง</p>
          <div>
            <p className="text-xs font-semibold text-[#374151] mb-1.5">ชื่อ-นามสกุล <span className="text-[#DC2626]">*</span></p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="กรอกชื่อ-นามสกุล"
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#374151] mb-1.5">เบอร์โทรศัพท์ <span className="text-[#DC2626]">*</span></p>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="กรอกเบอร์โทร"
              type="tel"
              inputMode="numeric"
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>
        </div>

        {/* Date & Time */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-sm font-bold text-[#1E3A5F]">วันและเวลา</p>
          <div>
            <p className="text-xs font-semibold text-[#374151] mb-1.5">วันที่ <span className="text-[#DC2626]">*</span></p>
            <input
              type="date"
              value={date}
              min={getTodayLocal()}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E3A5F]"
            />
            {dateError && <p className="text-xs text-[#DC2626] mt-1.5">{dateError}</p>}
            {date && storeHours && (
              <p className="text-xs text-[#16A34A] mt-1.5">✓ {storeHours.label}</p>
            )}
          </div>

          {storeHours && (
            <>
              <div>
                <p className="text-xs font-semibold text-[#374151] mb-1.5">เวลาเริ่ม <span className="text-[#DC2626]">*</span></p>
                <select
                  value={startHour}
                  onChange={(e) => handleStartHourChange(Number(e.target.value))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E3A5F] bg-white"
                >
                  <option value="">-- เลือกเวลา --</option>
                  {startHourOptions.map((h) => (
                    <option key={h} value={h}>{padHour(h)} น.</option>
                  ))}
                </select>
              </div>

              {startHour !== '' && (
                <div>
                  <p className="text-xs font-semibold text-[#374151] mb-1.5">จำนวนชั่วโมง <span className="text-[#DC2626]">*</span></p>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E3A5F] bg-white"
                  >
                    {durationOptions.map((d) => (
                      <option key={d} value={d}>{d} ชั่วโมง (ถึง {padHour((startHour as number) + d)} น.)</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </div>

        {/* Group */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-sm font-bold text-[#1E3A5F]">กลุ่ม</p>
          <div>
            <p className="text-xs font-semibold text-[#374151] mb-1.5">
              จำนวนคนที่จะมา <span className="text-[#DC2626]">*</span>
              <span className="font-normal text-gray-400"> (ขั้นต่ำ 2 คน)</span>
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPeople((p) => Math.max(2, p - 1))}
                className="w-10 h-10 rounded-xl border border-[#E2E8F0] text-[#374151] text-xl font-bold flex items-center justify-center"
              >
                −
              </button>
              <span className="text-xl font-bold text-[#1E3A5F] w-8 text-center">{people}</span>
              <button
                onClick={() => setPeople((p) => p + 1)}
                className="w-10 h-10 rounded-xl border border-[#E2E8F0] text-[#374151] text-xl font-bold flex items-center justify-center"
              >
                +
              </button>
              <span className="text-sm text-gray-400">คน</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#374151] mb-1.5">หมายเหตุ <span className="font-normal text-gray-400">(ถ้ามี)</span></p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ขอโต๊ะใหญ่, ต้องการ deck เบื้องต้น..."
              rows={2}
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E3A5F] resize-none"
            />
          </div>
        </div>

        <button
          onClick={() => {
            setError('')
            const err = validate()
            if (err) { setError(err); return }
            setShowConfirm(true)
          }}
          className="w-full py-4 bg-[#1E3A5F] text-white text-base font-bold rounded-2xl shadow-sm"
        >
          ยืนยันการจอง
        </button>

        <button
          onClick={() => { setShowStatusModal(true); loadAllBookings() }}
          className="w-full py-3 border-2 border-[#1E3A5F]/20 text-[#1E3A5F] text-sm font-semibold rounded-2xl hover:bg-[#1E3A5F]/5 transition-colors"
        >
          📋 ดูสถานะการจอง
        </button>

        <p className="text-center text-xs text-gray-400">📍 gap7card · กดยืนยันเพื่อดูสรุปก่อนส่ง</p>
      </div>

      {/* Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-6 pt-6 pb-3">
              <p className="text-base font-bold text-[#1E3A5F]">ตารางการจองทั้งหมด</p>
              <button onClick={() => setShowStatusModal(false)} className="text-gray-400 text-xl leading-none">✕</button>
            </div>
            <div className="overflow-y-auto px-6 pb-6 space-y-4">
              {statusLoading ? (
                <p className="text-sm text-gray-400 text-center py-6">กำลังโหลด...</p>
              ) : allBookings.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">ยังไม่มีการจองในขณะนี้</p>
              ) : (() => {
                const grouped: Record<string, typeof allBookings> = {}
                for (const b of allBookings) {
                  if (!grouped[b.date]) grouped[b.date] = []
                  grouped[b.date].push(b)
                }
                return Object.entries(grouped).map(([d, items]) => (
                  <div key={d} className="space-y-2">
                    <p className="text-xs font-bold text-[#374151]">{formatThaiDate(d)}</p>
                    {items.map((b) => {
                      const badge =
                        b.status === 'confirmed' ? { cls: 'bg-green-50 border-green-200 text-[#16A34A]', dot: 'bg-[#16A34A]', label: 'อนุมัติแล้ว' } :
                        b.status === 'cancelled' ? { cls: 'bg-red-50 border-red-200 text-[#DC2626]', dot: 'bg-[#DC2626]', label: 'ปฏิเสธ' } :
                        { cls: 'bg-yellow-50 border-yellow-200 text-yellow-700', dot: 'bg-yellow-400', label: 'รอยืนยัน' }
                      return (
                        <div key={b.id} className="bg-[#F5F6F8] rounded-2xl p-3 flex items-start gap-3">
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <p className="text-sm font-semibold text-[#1E3A5F] truncate">{b.name}</p>
                            <p className="text-xs text-gray-500">{padHour(Number(b.start_hour))} – {padHour(Number(b.start_hour) + Number(b.duration))} น. · {b.people} คน</p>
                          </div>
                          <span className={`inline-flex items-center gap-1.5 border text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${badge.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                            {badge.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <p className="text-base font-bold text-[#1E3A5F] text-center">ยืนยันการจองเวลา</p>
            <div className="bg-[#F5F6F8] rounded-2xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">ชื่อ</span>
                <span className="font-semibold text-right">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">เบอร์โทร</span>
                <span className="font-semibold">{phone}</span>
              </div>
              <hr className="border-[#E2E8F0]" />
              <div className="flex justify-between">
                <span className="text-gray-500">วันที่</span>
                <span className="font-semibold text-right">{formatThaiDate(date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">เวลา</span>
                <span className="font-semibold">{padHour(startHour as number)} – {padHour((startHour as number) + duration)} น.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">จำนวน</span>
                <span className="font-semibold">{people} คน</span>
              </div>
              {note && (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">หมายเหตุ</span>
                  <span className="font-semibold text-right">{note}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 border border-[#E2E8F0] rounded-2xl text-sm font-semibold text-[#374151]"
              >
                แก้ไข
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3 bg-[#1E3A5F] text-white rounded-2xl text-sm font-bold disabled:opacity-60"
              >
                {loading ? 'กำลังจอง...' : 'จองเลย'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
