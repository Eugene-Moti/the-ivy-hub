import type { ReferenceData, WalkIn } from '../../data/types'
import { formatPhone } from '../../lib/phone'
import { visitTypeLabel } from '../VisitType'
import { eatDateKey, formatTime, todayKey } from '../../lib/time'

export type ExportFormat = 'csv' | 'xlsx'

function columns(ref: ReferenceData, includeDeleted: boolean) {
  const name = <T extends { id: string; name?: string; fullName?: string }>(list: T[], id: string | null) => {
    const x = id ? list.find((i) => i.id === id) : undefined
    return x ? (x.name ?? x.fullName ?? '') : ''
  }
  const cols: [string, (w: WalkIn) => string | number][] = [
    ['Reference', (w) => w.reference ?? ''],
    ['Date', (w) => eatDateKey(w.visitedAt)],
    ['Time (EAT)', (w) => formatTime(w.visitedAt)],
    ['Full name', (w) => w.fullName],
    ['Phone', (w) => formatPhone(w.phone)],
    ['Email', (w) => w.email ?? ''],
    ['Visit type', (w) => visitTypeLabel(w.visitType)],
    ['Project', (w) => name(ref.projects, w.projectId)],
    ['Unit type', (w) => name(ref.unitTypes, w.unitTypeId)],
    ['Source', (w) => name(ref.sources, w.sourceId)],
    ['Other source', (w) => w.otherSourceText ?? ''],
    ['Sales person', (w) => name(ref.team, w.salesPersonId)],
    ['Here to see', (w) => (w.hostId ? name(ref.team, w.hostId) : (w.hostName ?? ''))],
    ['Organisation', (w) => w.organisation ?? ''],
    ['Purpose', (w) => w.purpose ?? ''],
    ['Returning', (w) => (w.isReturning ? 'Yes' : 'No')],
    ['Notes', (w) => w.notes ?? ''],
    ['Recorded by', (w) => w.createdByName ?? ''],
  ]
  if (includeDeleted) {
    cols.push(['Deleted', (w) => (w.deletedAt ? 'Yes' : 'No')], ['Delete reason', (w) => w.deleteReason ?? ''])
  }
  return cols
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const csvCell = (v: string | number) => {
  const s = String(v)
  // Quote when needed; prefix formula-like values so spreadsheets don't execute them.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export async function exportWalkIns(rows: WalkIn[], ref: ReferenceData, format: ExportFormat, includeDeleted: boolean) {
  const cols = columns(ref, includeDeleted)
  const filename = `ivy-hub-walk-ins_${todayKey()}.${format}`

  if (format === 'csv') {
    const lines = [
      cols.map(([h]) => csvCell(h)).join(','),
      ...rows.map((w) => cols.map(([, get]) => csvCell(get(w))).join(',')),
    ]
    // BOM so Excel opens UTF-8 names correctly.
    download(new Blob([String.fromCharCode(0xfeff) + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), filename)
    return
  }

  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const header = cols.map(([h]) => ({ value: h, fontWeight: 'bold' as const, backgroundColor: '#F5EACF' }))
  const body = rows.map((w) => cols.map(([, get]) => ({ value: String(get(w)) })))
  const blob = await writeXlsxFile([header, ...body], {
    columns: cols.map(([h]) => ({ width: Math.max(12, Math.min(40, h.length + 6)) })),
    stickyRowsCount: 1,
    sheet: 'Walk-ins',
  }).toBlob()
  download(blob, filename)
}
