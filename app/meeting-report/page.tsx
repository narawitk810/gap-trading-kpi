'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type PageState = 'form' | 'confirm' | 'success'

export default function MeetingReportPage() {
  const [pageState, setPageState] = useState<PageState>('form')
  const [nickname, setNickname] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [meetingTime, setMeetingTime] = useState('')
  const [participants, setParticipants] = useState('')
  const [summary, setSummary] = useState('')
  const [decisions, setDecisions] = useState('')
  const [actionItems, setActionItems] = useState('')
  const [pendingIssues, setPendingIssues] = useState('')
  const [nextMeeting, setNextMeeting] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submittedId, setSubmittedId] = useState('')
  const [errors, setErrors] = useState<{ [k: string]: string }>({})

  useEffect(() => {
    const now = new Date()
    setMeetingDate(now.toLocaleDateString('sv-SE'))
    setMeetingTime(now.toTimeString().slice(0, 5))
  }, [])

  function validate() {
    const e: { [k: string]: string } = {}
    if (!nickname.trim()) e.nickname = 'กรุณากรอกชื่อเล่น'
    if (!meetingDate) e.meetingDate = 'กรุณาระบุวันที่'
    if (!meetingTime) e.meetingTime = 'กรุณาระบุเวลา'
    if (!participants.trim()) e.participants = 'กรุณาระบุผู้เข้าร่วม'
    if (!summary.trim()) e.summary = 'กรุณากรอกสรุปประเด็น'
    if (!decisions.trim()) e.decisions = 'กรุณากรอกมติ/ข้อตัดสินใจ'
    if (!actionItems.trim()) e.actionItems = 'กรุณากรอก Action Items'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmitClick() {
    if (validate()) setPageState('confirm')
  }

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/meeting-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          meeting_date: meetingDate,
          meeting_time: meetingTime,
          participants: participants.trim(),
          summary: summary.trim(),
          decisions: decisions.trim(),
          action_items: actionItems.trim(),
          pending_issues: pendingIssues.trim(),
          next_meeting: nextMeeting.trim(),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSubmittedId(data.id)
        setPageState('success')
      } else {
        alert(data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
        setPageState('confirm')
      }
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต')
      setPageState('confirm')
    } finally {
      setSubmitting(false)
    }
  }

  function formatDateTH(dateStr: string) {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-')
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    return `${parseInt(d)} ${months[parseInt(m) - 1]} ${parseInt(y) + 543}`
  }

  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-[#1E3A5F] mb-2">ส่งรายงานสำเร็จ</h2>
          <p className="text-gray-500 text-sm mb-1">เลขอ้างอิง</p>
          <p className="text-lg font-bold text-[#16A34A] mb-2">#{submittedId}</p>
          <p className="text-gray-400 text-sm mb-8">รายงานการประชุมถูกส่งให้ทีมงานเรียบร้อยแล้ว</p>
          <Link
            href="/"
            className="block w-full bg-[#1E3A5F] text-white py-3.5 rounded-xl font-semibold text-base text-center"
          >
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    )
  }

  if (pageState === 'confirm') {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm overflow-hidden">
          <div className="bg-[#1E3A5F] text-white px-5 py-4">
            <h2 className="font-bold text-lg">ยืนยันรายงานการประชุม</h2>
            <p className="text-sm opacity-75 mt-0.5">ตรวจสอบข้อมูลก่อนส่ง</p>
          </div>
          <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">ผู้บันทึก</p>
              <p className="font-semibold text-[#374151] text-sm">{nickname}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">วันที่/เวลาประชุม</p>
              <p className="font-semibold text-[#374151] text-sm">{formatDateTH(meetingDate)} เวลา {meetingTime} น.</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">ผู้เข้าร่วม</p>
              <p className="text-sm text-[#374151] whitespace-pre-wrap">{participants}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">สรุปประเด็นที่คุย</p>
              <p className="text-sm text-[#374151] whitespace-pre-wrap">{summary}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">มติ/ข้อตัดสินใจ</p>
              <p className="text-sm text-[#374151] whitespace-pre-wrap">{decisions}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Action Items</p>
              <p className="text-sm text-[#374151] whitespace-pre-wrap">{actionItems}</p>
            </div>
            {pendingIssues && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">เรื่องค้าง</p>
                <p className="text-sm text-[#374151] whitespace-pre-wrap">{pendingIssues}</p>
              </div>
            )}
            {nextMeeting && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">นัดครั้งหน้า</p>
                <p className="text-sm text-[#374151]">{nextMeeting}</p>
              </div>
            )}
          </div>
          <div className="px-5 pb-5 flex gap-3">
            <button
              onClick={() => setPageState('form')}
              className="flex-1 border border-[#E2E8F0] text-[#374151] py-3 rounded-xl font-semibold text-sm"
            >
              แก้ไข
            </button>
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="flex-1 bg-[#1E3A5F] text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-60"
            >
              {submitting ? 'กำลังส่ง...' : 'ยืนยันส่ง'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const inputClass = 'w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]'
  const textareaClass = `${inputClass} resize-none`
  const labelClass = 'block text-sm font-semibold text-[#374151] mb-2'
  const errorClass = 'text-[#DC2626] text-xs mt-1'

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <div className="bg-[#1E3A5F] text-white px-4 py-5 text-center shadow-md relative">
        <Link href="/" className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold tracking-wide">GAP TRADING</h1>
        <p className="text-sm mt-1 opacity-75">รายงานการประชุม</p>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4 pb-10">
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">

          {/* ชื่อเล่น */}
          <div>
            <label className={labelClass}>ชื่อเล่น <span className="text-[#DC2626]">*</span></label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => { setNickname(e.target.value); setErrors((p) => ({ ...p, nickname: '' })) }}
              placeholder="ชื่อเล่นของคุณ"
              className={inputClass}
            />
            {errors.nickname && <p className={errorClass}>{errors.nickname}</p>}
          </div>

          {/* วันที่ + เวลา */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>วันที่ประชุม <span className="text-[#DC2626]">*</span></label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => { setMeetingDate(e.target.value); setErrors((p) => ({ ...p, meetingDate: '' })) }}
                className={inputClass}
              />
              {errors.meetingDate && <p className={errorClass}>{errors.meetingDate}</p>}
            </div>
            <div>
              <label className={labelClass}>เวลา <span className="text-[#DC2626]">*</span></label>
              <input
                type="time"
                value={meetingTime}
                onChange={(e) => { setMeetingTime(e.target.value); setErrors((p) => ({ ...p, meetingTime: '' })) }}
                className={inputClass}
              />
              {errors.meetingTime && <p className={errorClass}>{errors.meetingTime}</p>}
            </div>
          </div>

          {/* ผู้เข้าร่วม */}
          <div>
            <label className={labelClass}>ผู้เข้าร่วม <span className="text-[#DC2626]">*</span></label>
            <textarea
              value={participants}
              onChange={(e) => { setParticipants(e.target.value); setErrors((p) => ({ ...p, participants: '' })) }}
              placeholder="ระบุชื่อผู้เข้าร่วมทุกคน"
              rows={2}
              className={textareaClass}
            />
            {errors.participants && <p className={errorClass}>{errors.participants}</p>}
          </div>

          {/* สรุปประเด็น */}
          <div>
            <label className={labelClass}>สรุปประเด็นที่คุย <span className="text-[#DC2626]">*</span></label>
            <textarea
              value={summary}
              onChange={(e) => { setSummary(e.target.value); setErrors((p) => ({ ...p, summary: '' })) }}
              placeholder="สรุปสิ่งที่ได้คุยกันในที่ประชุม"
              rows={4}
              className={textareaClass}
            />
            {errors.summary && <p className={errorClass}>{errors.summary}</p>}
          </div>

          {/* มติ */}
          <div>
            <label className={labelClass}>มติ/ข้อตัดสินใจ <span className="text-[#DC2626]">*</span></label>
            <textarea
              value={decisions}
              onChange={(e) => { setDecisions(e.target.value); setErrors((p) => ({ ...p, decisions: '' })) }}
              placeholder="ผลสรุปและข้อตัดสินใจที่ได้จากที่ประชุม"
              rows={3}
              className={textareaClass}
            />
            {errors.decisions && <p className={errorClass}>{errors.decisions}</p>}
          </div>

          {/* Action Items */}
          <div>
            <label className={labelClass}>
              Action Items <span className="text-[#DC2626]">*</span>
              <span className="text-xs font-normal text-gray-400 ml-1">(ใคร / ทำอะไร / ภายในเมื่อไร)</span>
            </label>
            <textarea
              value={actionItems}
              onChange={(e) => { setActionItems(e.target.value); setErrors((p) => ({ ...p, actionItems: '' })) }}
              placeholder="เช่น &#10;นก — จัดทำรายงานสรุปยอด — ภายใน 3 ก.ค.&#10;ต้น — ติดต่อซัพพลายเออร์ — ภายใน 5 ก.ค."
              rows={3}
              className={textareaClass}
            />
            {errors.actionItems && <p className={errorClass}>{errors.actionItems}</p>}
          </div>

          {/* เรื่องค้าง */}
          <div>
            <label className={labelClass}>
              เรื่องค้าง
              <span className="text-xs font-normal text-gray-400 ml-2">(ไม่บังคับ)</span>
            </label>
            <textarea
              value={pendingIssues}
              onChange={(e) => setPendingIssues(e.target.value)}
              placeholder="ประเด็นที่ยังไม่ได้ข้อสรุป หรือต้องติดตามต่อ"
              rows={2}
              className={textareaClass}
            />
          </div>

          {/* นัดครั้งหน้า */}
          <div>
            <label className={labelClass}>
              นัดครั้งหน้า
              <span className="text-xs font-normal text-gray-400 ml-2">(ไม่บังคับ)</span>
            </label>
            <input
              type="text"
              value={nextMeeting}
              onChange={(e) => setNextMeeting(e.target.value)}
              placeholder="เช่น วันศุกร์ที่ 11 ก.ค. เวลา 10:00 น."
              className={inputClass}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmitClick}
          className="w-full bg-[#1E3A5F] text-white py-4 rounded-xl font-bold text-base shadow-md active:opacity-90"
        >
          ตรวจสอบและส่งรายงาน
        </button>
      </div>
    </div>
  )
}
