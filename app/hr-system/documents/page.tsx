'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

type Folder = { id: string; name: string; created_at: string; file_count: number }
type HrFile = { id: string; folder_id: string; name: string; file_type: string; file_size: number; created_at: string }

const FILE_ICONS: Record<string, string> = {
  pdf: '📄', xlsx: '📊', xls: '📊', docx: '📝', doc: '📝',
  png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️',
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return FILE_ICONS[ext] ?? '📎'
}

function fileExt(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatThaiDate(iso: string) {
  const d = new Date(iso)
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`
}

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

export default function HrDocumentsPage() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null)
  const [files, setFiles] = useState<HrFile[]>([])
  const [loading, setLoading] = useState(true)
  const [filesLoading, setFilesLoading] = useState(false)

  // Create folder modal
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'folder' | 'file'; id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Upload progress
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number; skipped: string[] } | null>(null)

  const folderInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchFolders = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/hr/documents/folders')
    setFolders(await res.json())
    setLoading(false)
  }, [])

  const fetchFiles = useCallback(async (folderId: string) => {
    setFilesLoading(true)
    const res = await fetch(`/api/hr/documents/files?folder_id=${folderId}`)
    setFiles(await res.json())
    setFilesLoading(false)
  }, [])

  useEffect(() => { fetchFolders() }, [fetchFolders])

  async function openFolder(folder: Folder) {
    setSelectedFolder(folder)
    fetchFiles(folder.id)
  }

  // --- Create folder ---
  async function handleCreateFolder() {
    if (!newFolderName.trim()) return
    setSaving(true)
    await fetch('/api/hr/documents/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName.trim() }),
    })
    setSaving(false)
    setNewFolderOpen(false)
    setNewFolderName('')
    fetchFolders()
  }

  // --- Upload folder from desktop ---
  async function handleFolderUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    const firstFile = fileList[0] as File & { webkitRelativePath?: string }
    const folderName = firstFile.webkitRelativePath?.split('/')[0] ?? 'โฟลเดอร์ใหม่'

    // Create folder first
    const folderRes = await fetch('/api/hr/documents/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: folderName }),
    })
    const { id: folderId } = await folderRes.json()

    const total = fileList.length
    const skipped: string[] = []
    setUploadProgress({ done: 0, total, skipped: [] })

    for (let i = 0; i < total; i++) {
      const file = fileList[i]
      if (file.size > MAX_FILE_BYTES) {
        skipped.push(file.name)
        setUploadProgress({ done: i + 1, total, skipped: [...skipped] })
        continue
      }

      const dataUrl = await readFileAsDataUrl(file)
      await fetch('/api/hr/documents/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_id: folderId,
          name: file.name,
          file_type: fileExt(file.name),
          file_size: file.size,
          file_data: dataUrl,
        }),
      })
      setUploadProgress({ done: i + 1, total, skipped: [...skipped] })
    }

    // Reset
    e.target.value = ''
    setTimeout(() => {
      setUploadProgress(null)
      fetchFolders()
    }, 1500)
  }

  // --- Upload single file into folder ---
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedFolder) return
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      alert(`ไฟล์ ${file.name} มีขนาดเกิน 10 MB ไม่สามารถอัปโหลดได้`)
      e.target.value = ''
      return
    }
    const dataUrl = await readFileAsDataUrl(file)
    setFilesLoading(true)
    await fetch('/api/hr/documents/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder_id: selectedFolder.id,
        name: file.name,
        file_type: fileExt(file.name),
        file_size: file.size,
        file_data: dataUrl,
      }),
    })
    e.target.value = ''
    fetchFiles(selectedFolder.id)
    fetchFolders()
  }

  // --- Delete ---
  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    if (deleteTarget.type === 'folder') {
      await fetch(`/api/hr/documents/folders?id=${deleteTarget.id}`, { method: 'DELETE' })
      setSelectedFolder(null)
      setFiles([])
      fetchFolders()
    } else {
      await fetch(`/api/hr/documents/files?id=${deleteTarget.id}`, { method: 'DELETE' })
      if (selectedFolder) fetchFiles(selectedFolder.id)
      fetchFolders()
    }
    setDeleting(false)
    setDeleteTarget(null)
  }

  // --- Download ---
  function handleDownload(fileId: string, fileName: string) {
    const a = document.createElement('a')
    a.href = `/api/hr/documents/files/${fileId}`
    a.download = fileName
    a.click()
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]" style={{ fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif" }}>

      {/* Hidden inputs */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is non-standard
        webkitdirectory=""
        multiple
        className="hidden"
        onChange={handleFolderUpload}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Header */}
      <header className="bg-[#1E3A5F] text-white px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Link href="/hr-system" className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white text-lg shrink-0">
            ←
          </Link>
          <div className="flex-1 min-w-0">
            {selectedFolder ? (
              <div>
                <button onClick={() => setSelectedFolder(null)} className="text-[11px] text-blue-200 hover:text-white">
                  เอกสาร HR
                </button>
                <span className="text-[11px] text-blue-300 mx-1">›</span>
                <span className="text-[11px] text-white font-medium">{selectedFolder.name}</span>
              </div>
            ) : (
              <p className="text-[11px] text-blue-200">คลังเอกสาร HR</p>
            )}
            <h1 className="text-base font-bold leading-tight truncate">
              {selectedFolder ? selectedFolder.name : 'เอกสาร HR'}
            </h1>
          </div>
          {!selectedFolder ? (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setNewFolderOpen(true)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium"
              >
                📁 สร้างโฟลเดอร์
              </button>
              <button
                onClick={() => folderInputRef.current?.click()}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium"
              >
                ⬆️ อัปโหลด
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium"
            >
              ➕ เพิ่มไฟล์
            </button>
          )}
        </div>
      </header>

      {/* Upload progress banner */}
      {uploadProgress && (
        <div className="bg-[#1E3A5F] text-white px-4 py-2 text-sm text-center">
          {uploadProgress.done < uploadProgress.total
            ? `⬆️ กำลังอัปโหลด... ${uploadProgress.done}/${uploadProgress.total} ไฟล์`
            : `✅ อัปโหลดเสร็จ ${uploadProgress.total} ไฟล์${uploadProgress.skipped.length > 0 ? ` (ข้าม ${uploadProgress.skipped.length} ไฟล์ที่ใหญ่เกิน 10 MB)` : ''}`}
        </div>
      )}

      <div className="p-4 max-w-2xl mx-auto">

        {/* FOLDER LIST VIEW */}
        {!selectedFolder && (
          <>
            {loading ? (
              <div className="text-center py-16 text-[#374151]">กำลังโหลด...</div>
            ) : folders.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-5xl mb-4">📁</p>
                <p className="font-semibold text-[#374151]">ยังไม่มีโฟลเดอร์</p>
                <p className="text-sm text-gray-400 mt-1">กด "สร้างโฟลเดอร์" หรือ "อัปโหลด" เพื่อเริ่มต้น</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 mt-2">
                {folders.map((f) => (
                  <div
                    key={f.id}
                    className="bg-white rounded-xl border border-[#E2E8F0] p-4 cursor-pointer hover:border-[#1E3A5F] hover:shadow-sm transition-all group"
                    onClick={() => openFolder(f)}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-3xl">📁</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'folder', id: f.id, name: f.name }) }}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-[#DC2626] text-sm transition-opacity"
                      >
                        🗑️
                      </button>
                    </div>
                    <p className="font-semibold text-[#1E3A5F] mt-2 text-sm leading-tight line-clamp-2">{f.name}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{f.file_count} ไฟล์ · {formatThaiDate(f.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* FILE LIST VIEW */}
        {selectedFolder && (
          <div className="mt-2 space-y-2">
            {filesLoading ? (
              <div className="text-center py-12 text-[#374151]">กำลังโหลด...</div>
            ) : files.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">📂</p>
                <p className="text-[#374151]">โฟลเดอร์นี้ยังไม่มีไฟล์</p>
                <p className="text-sm text-gray-400 mt-1">กด "เพิ่มไฟล์" เพื่ออัปโหลด</p>
              </div>
            ) : (
              files.map((file) => (
                <div key={file.id} className="bg-white rounded-xl border border-[#E2E8F0] px-4 py-3 flex items-center gap-3">
                  <span className="text-2xl shrink-0">{fileIcon(file.name)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#374151] truncate">{file.name}</p>
                    <p className="text-[11px] text-gray-400">{formatSize(file.file_size)} · {formatThaiDate(file.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleDownload(file.id, file.name)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-[#1E3A5F] text-sm"
                      title="ดาวน์โหลด"
                    >
                      ⬇️
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ type: 'file', id: file.id, name: file.name })}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-[#DC2626] text-sm"
                      title="ลบ"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal: สร้างโฟลเดอร์ */}
      {newFolderOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <h2 className="font-bold text-[#1E3A5F]">สร้างโฟลเดอร์ใหม่</h2>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              placeholder="ชื่อโฟลเดอร์ เช่น นโยบาย 2568"
              autoFocus
              className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setNewFolderOpen(false); setNewFolderName('') }}
                className="flex-1 py-2.5 rounded-lg border border-[#E2E8F0] text-[#374151] text-sm font-medium"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || saving}
                className="flex-1 py-2.5 rounded-lg bg-[#1E3A5F] text-white text-sm font-medium disabled:opacity-40"
              >
                {saving ? 'กำลังสร้าง...' : 'สร้าง'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: ยืนยันการลบ */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto text-2xl">🗑️</div>
            <div>
              <h2 className="font-bold text-[#374151]">
                {deleteTarget.type === 'folder' ? 'ลบโฟลเดอร์นี้?' : 'ลบไฟล์นี้?'}
              </h2>
              <p className="text-sm text-gray-500 mt-1 break-all">"{deleteTarget.name}"</p>
              {deleteTarget.type === 'folder' && (
                <p className="text-xs text-[#DC2626] mt-2">ไฟล์ทั้งหมดในโฟลเดอร์จะถูกลบด้วย</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-lg border border-[#E2E8F0] text-[#374151] text-sm font-medium"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-lg bg-[#DC2626] text-white text-sm font-medium disabled:opacity-60"
              >
                {deleting ? 'กำลังลบ...' : 'ลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
