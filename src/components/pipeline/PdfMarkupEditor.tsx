import { useEffect, useRef, useState } from 'react'
import { X, Pen, Eraser, Undo2, Save, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { PDFDocument, rgb } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

type Tool = 'strikethrough' | 'erase'

interface Shape {
  page: number
  type: Tool
  x1: number; y1: number; x2: number; y2: number
}

interface Props {
  pdfUrl: string
  fileName: string
  onSave: (markedBytes: Uint8Array, newFileName: string) => Promise<void>
  onClose: () => void
}

const RENDER_SCALE = 1.5

export function PdfMarkupEditor({ pdfUrl, fileName, onSave, onClose }: Props) {
  const [pdf, setPdf] = useState<any>(null)
  const [pageNum, setPageNum] = useState(1)
  const [tool, setTool] = useState<Tool>('strikethrough')
  const [shapes, setShapes] = useState<Shape[]>([])
  const [drag, setDrag] = useState<Shape | null>(null)
  const [saving, setSaving] = useState(false)
  const [pageSize, setPageSize] = useState({ w: 0, h: 0 })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let canceled = false
    ;(async () => {
      try {
        const doc = await pdfjsLib.getDocument(pdfUrl).promise
        if (!canceled) setPdf(doc)
      } catch (e) { console.error('PDF load failed:', e) }
    })()
    return () => { canceled = true }
  }, [pdfUrl])

  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    let canceled = false
    ;(async () => {
      const page = await pdf.getPage(pageNum)
      if (canceled) return
      const viewport = page.getViewport({ scale: RENDER_SCALE })
      const canvas = canvasRef.current!
      canvas.width = viewport.width
      canvas.height = viewport.height
      setPageSize({ w: viewport.width, h: viewport.height })
      const ctx = canvas.getContext('2d')!
      await page.render({ canvasContext: ctx, viewport, canvas }).promise
    })()
    return () => { canceled = true }
  }, [pdf, pageNum])

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay || !pageSize.w) return
    overlay.width = pageSize.w
    overlay.height = pageSize.h
    const ctx = overlay.getContext('2d')!
    ctx.clearRect(0, 0, pageSize.w, pageSize.h)
    const all = drag ? [...shapes, drag] : shapes
    for (const s of all) {
      if (s.page !== pageNum) continue
      const x = Math.min(s.x1, s.x2)
      const y = Math.min(s.y1, s.y2)
      const w = Math.abs(s.x2 - s.x1)
      const h = Math.abs(s.y2 - s.y1)
      if (s.type === 'erase') {
        ctx.fillStyle = 'rgba(255,255,255,0.95)'
        ctx.fillRect(x, y, w, h)
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, w, h)
      } else {
        const cy = (s.y1 + s.y2) / 2
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.9)'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(Math.min(s.x1, s.x2), cy)
        ctx.lineTo(Math.max(s.x1, s.x2), cy)
        ctx.stroke()
      }
    }
  }, [shapes, drag, pageNum, pageSize])

  const pointerCoords = (e: React.PointerEvent) => {
    const rect = overlayRef.current!.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (pageSize.w / rect.width),
      y: (e.clientY - rect.top) * (pageSize.h / rect.height),
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!pageSize.w) return
    const { x, y } = pointerCoords(e)
    setDrag({ page: pageNum, type: tool, x1: x, y1: y, x2: x, y2: y })
    overlayRef.current!.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return
    const { x, y } = pointerCoords(e)
    setDrag({ ...drag, x2: x, y2: y })
  }
  const onPointerUp = () => {
    if (!drag) return
    const w = Math.abs(drag.x2 - drag.x1)
    const h = Math.abs(drag.y2 - drag.y1)
    if (w > 3 || h > 3) setShapes(s => [...s, drag])
    setDrag(null)
  }

  const undo = () => setShapes(s => s.slice(0, -1))

  const handleSave = async () => {
    setSaving(true)
    try {
      const resp = await fetch(pdfUrl)
      const originalBytes = new Uint8Array(await resp.arrayBuffer())
      const doc = await PDFDocument.load(originalBytes)
      const pages = doc.getPages()
      for (const shape of shapes) {
        const page = pages[shape.page - 1]
        if (!page) continue
        const { width: pw, height: ph } = page.getSize()
        const sx = pw / pageSize.w
        const sy = ph / pageSize.h
        const x1 = Math.min(shape.x1, shape.x2) * sx
        const x2 = Math.max(shape.x1, shape.x2) * sx
        const y1c = Math.min(shape.y1, shape.y2)
        const y2c = Math.max(shape.y1, shape.y2)
        const yTop = ph - y1c * sy
        const yBottom = ph - y2c * sy
        if (shape.type === 'erase') {
          page.drawRectangle({
            x: x1,
            y: yBottom,
            width: x2 - x1,
            height: yTop - yBottom,
            color: rgb(1, 1, 1),
            borderWidth: 0,
          })
        } else {
          const yMid = (yTop + yBottom) / 2
          page.drawLine({
            start: { x: x1, y: yMid },
            end: { x: x2, y: yMid },
            color: rgb(0.86, 0.15, 0.15),
            thickness: 2,
          })
        }
      }
      const outBytes = await doc.save()
      const base = fileName.replace(/\.pdf$/i, '')
      await onSave(outBytes, `${base} — MARKED.pdf`)
    } catch (e: any) {
      console.error('Save failed:', e.message)
      alert(`Save failed: ${e.message}`)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-wrap">
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded" title="Close"><X size={16} /></button>
        <div className="text-sm font-semibold text-gray-900 truncate flex-1 min-w-[120px]">{fileName}</div>
        <div className="flex items-center gap-0.5 border border-gray-200 rounded-lg p-0.5">
          <button onClick={() => setTool('strikethrough')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded font-medium ${tool === 'strikethrough' ? 'bg-red-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Pen size={11} /> Strikethrough
          </button>
          <button onClick={() => setTool('erase')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded font-medium ${tool === 'erase' ? 'bg-[#1a1a2e] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Eraser size={11} /> Erase
          </button>
        </div>
        <button onClick={undo} disabled={shapes.length === 0}
          className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 disabled:opacity-40">
          <Undo2 size={11} /> Undo
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum === 1}
            className="p-1.5 text-gray-600 border border-gray-200 rounded hover:border-gray-300 disabled:opacity-40"><ChevronLeft size={14} /></button>
          <span className="text-xs text-gray-600 min-w-[80px] text-center">Page {pageNum} / {pdf?.numPages ?? '…'}</span>
          <button onClick={() => setPageNum(p => Math.min(pdf?.numPages ?? p, p + 1))} disabled={pageNum >= (pdf?.numPages ?? 1)}
            className="p-1.5 text-gray-600 border border-gray-200 rounded hover:border-gray-300 disabled:opacity-40"><ChevronRight size={14} /></button>
        </div>
        <button onClick={handleSave} disabled={saving || shapes.length === 0}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#c9a84c] text-white rounded-lg hover:bg-amber-600 disabled:opacity-40">
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
          Save Marked Copy
        </button>
      </div>
      <div className="flex-1 overflow-auto flex justify-center bg-gray-800 p-4">
        {!pdf && <div className="text-white text-sm mt-20 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading PDF…</div>}
        {pdf && (
          <div className="relative shadow-xl" style={{ width: pageSize.w, height: pageSize.h }}>
            <canvas ref={canvasRef} className="absolute inset-0" />
            <canvas
              ref={overlayRef}
              className="absolute inset-0 cursor-crosshair touch-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
          </div>
        )}
      </div>
    </div>
  )
}
