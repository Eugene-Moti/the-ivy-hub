import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ArrowCounterClockwiseIcon,
  CalendarIcon,
  ClockIcon,
  CloudSlashIcon,
  FloppyDiskIcon,
  PrinterIcon,
  ShieldCheckIcon,
  TicketIcon,
  UserSwitchIcon,
} from '@phosphor-icons/react'
import { z } from 'zod'
import { useAuth } from '../auth/AuthProvider'
import { ReceiptPrinter, type PrinterStage } from '../components/ReceiptPrinter'
import { StaffDirectoryButton } from '../components/StaffDirectory'
import { NotifyContact } from '../components/walkin/NotifyContact'
import { SourceIcon } from '../components/SourceIcon'
import { VisitTypeIcon, visitTypeLabel } from '../components/VisitType'
import { Button } from '../components/ui/Button'
import { DynamicButton, type DynamicState } from '../components/ui/DynamicButton'
import { Modal } from '../components/ui/Overlay'
import { Badge, Card, PageHeader, usePrint } from '../components/ui/Primitives'
import { useToast } from '../components/ui/Toaster'
import {
  PrintableSlip,
  PrintableVisitorPass,
  useWalkInLabels,
  VisitorPass,
  WalkInSlip,
} from '../components/walkin/WalkInDocs'
import {
  EMPTY_WALK_IN,
  toWalkInFields,
  walkInSchema,
  WalkInFields,
  type WalkInFormValues,
} from '../components/walkin/WalkInFields'
import { api } from '../data'
import { useRefData } from '../data/RefDataProvider'
import type { NewWalkIn, WalkIn, WalkInNotification } from '../data/types'
import { uuid } from '../lib/ids'
import { normalisePhone } from '../lib/phone'
import { formatDate, formatTime, todayKey } from '../lib/time'
import { useNairobiClock } from '../lib/useNairobiClock'
import { zodResolver } from '../lib/zodResolver'
import { provisionalReference, useSync, type SubmitWalkInResult } from '../offline/SyncProvider'

interface ReceiptState {
  stage: PrinterStage
  input: NewWalkIn
  result: SubmitWalkInResult | null
  notifications: WalkInNotification[] | null
}

export function WalkInPage() {
  const { user } = useAuth()
  const ref = useRefData()
  const sources = useMemo(() => ref.data?.sources ?? [], [ref.data?.sources])
  const { submitWalkIn } = useSync()
  const { toast } = useToast()
  const print = usePrint()
  const reduce = useReducedMotion()
  const { date, time } = useNairobiClock()

  const schema = useMemo(() => walkInSchema(sources, true), [sources])
  const form = useForm<WalkInFormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY_WALK_IN })
  const { register, handleSubmit, watch, reset, setFocus, formState } = form

  const [returning, setReturning] = useState<WalkIn | null>(null)
  const [button, setButton] = useState<DynamicState>('idle')
  const [receipt, setReceipt] = useState<ReceiptState | null>(null)
  const [passOpen, setPassOpen] = useState(false)
  const [todayVersion, setTodayVersion] = useState(0)

  // Returning-visitor check as the phone / email are typed.
  const phone = watch('phone')
  const email = watch('email')
  useEffect(() => {
    const p = normalisePhone(phone)
    const e = z.email().safeParse(email.trim()).success ? email.trim() : null
    if (!p && !e) {
      setReturning(null)
      return
    }
    if (!navigator.onLine) return
    const t = window.setTimeout(() => {
      api
        .findReturning(p, e)
        .then(setReturning)
        .catch(() => {})
    }, 450)
    return () => window.clearTimeout(t)
  }, [phone, email])

  const onSubmit = async (v: WalkInFormValues) => {
    const input: NewWalkIn = {
      id: uuid(),
      visitedAt: new Date().toISOString(),
      ...toWalkInFields(v, sources),
      consent: true,
      isReturning: Boolean(returning),
    }
    setButton('loading')
    setReceipt({ stage: 'processing', input, result: null, notifications: null })
    try {
      const result = await submitWalkIn(input)
      setReceipt((r) => (r ? { ...r, stage: 'printing', result } : r))
      setButton('success')
      toast(
        result.queued
          ? {
              title: 'Saved offline',
              description: 'It will sync automatically when the connection returns.',
              tone: 'warning',
            }
          : { title: 'Walk-in recorded', tone: 'success' },
      )
      result.notifications?.then((list) =>
        setReceipt((r) => (r && r.input.id === input.id ? { ...r, notifications: list } : r)),
      )
      setTodayVersion((x) => x + 1)
    } catch (err) {
      setReceipt(null)
      setButton('error')
      window.setTimeout(() => setButton('idle'), 1800)
      toast({
        title: 'Could not save the walk-in',
        description: err instanceof Error ? err.message : undefined,
        tone: 'error',
      })
    }
  }

  const nextVisitor = useCallback(() => {
    setReceipt(null)
    setPassOpen(false)
    setReturning(null)
    setButton('idle')
    reset(EMPTY_WALK_IN)
    window.setTimeout(() => setFocus('fullName'), 80)
  }, [reset, setFocus])

  // The record shown on the slip: the saved row, or a provisional copy while saving.
  const slipWalkIn: WalkIn | null = receipt
    ? (receipt.result?.walkIn ?? {
        ...receipt.input,
        reference: provisionalReference(receipt.input),
        createdBy: user?.id ?? '',
        createdByName: user?.name ?? null,
        createdAt: receipt.input.visitedAt,
        updatedAt: receipt.input.visitedAt,
        deletedAt: null,
        deleteReason: null,
      })
    : null
  const labels = useWalkInLabels(slipWalkIn)
  const companyName = ref.settings.companyName
  const queued = receipt?.result?.queued ?? false

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader
        eyebrow="Reception"
        title="New walk-in"
        description="Record each visitor as they arrive. Fields marked * are required."
        actions={<StaffDirectoryButton />}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-5 sm:p-7">
          <form noValidate onSubmit={handleSubmit(onSubmit)}>
            <div className="mb-6 grid grid-cols-2 gap-3">
              <ReadOnlyTile icon={<CalendarIcon weight="duotone" />} label="Date" value={date} />
              <ReadOnlyTile icon={<ClockIcon weight="duotone" />} label="Time (EAT)" value={time} mono />
            </div>

            <AnimatePresence initial={false}>
              {returning && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -6 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div
                    role="status"
                    className="mb-5 flex items-start gap-3 rounded-xl border border-gold/35 bg-gold/10 px-4 py-3"
                  >
                    <UserSwitchIcon weight="duotone" className="mt-0.5 size-5 shrink-0 text-gold" />
                    <p className="text-sm text-fg">
                      <span className="font-semibold">Returning visitor</span> — last visited on{' '}
                      {formatDate(returning.visitedAt)}
                      {returning.visitType === 'client' ? (
                        <>
                          , interested in {ref.project(returning.projectId)?.name ?? 'a project'}
                          {ref.unitType(returning.unitTypeId) ? ` (${ref.unitType(returning.unitTypeId)!.name})` : ''}.
                        </>
                      ) : (
                        <>
                          {' '}
                          ({visitTypeLabel(returning.visitType).toLowerCase()}
                          {returning.hostId || returning.hostName
                            ? ` with ${ref.member(returning.hostId)?.fullName ?? returning.hostName}`
                            : ''}
                          ).
                        </>
                      )}
                      <span className="block text-xs text-muted">
                        You can still save; the record will be tagged “Returning”.
                      </span>
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <WalkInFields form={form} />

            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-field p-4 transition-colors hover:border-gold/45">
              <input
                type="checkbox"
                {...register('consent')}
                className="mt-0.5 size-[18px] shrink-0 accent-[#c99a30]"
              />
              <span className="text-sm leading-snug text-fg/90">
                <span className="mb-0.5 flex items-center gap-1.5 font-semibold text-fg">
                  <ShieldCheckIcon weight="duotone" className="size-4 text-gold" /> Data consent
                  <span className="text-gold">*</span>
                </span>
                The visitor consents to {companyName} storing their details for follow-up (Kenya Data Protection Act,
                2019).
              </span>
            </label>
            {formState.errors.consent && (
              <p className="mt-1.5 text-xs font-medium text-rose dark:text-[#e08a80]">
                {formState.errors.consent.message}
              </p>
            )}

            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted">
                Press{' '}
                <kbd className="rounded border border-line bg-bg-sunken px-1.5 py-0.5 font-sans text-[11px]">Enter</kbd>{' '}
                to save
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={nextVisitor} disabled={button === 'loading'}>
                  <ArrowCounterClockwiseIcon weight="bold" /> Clear
                </Button>
                <DynamicButton
                  type="submit"
                  size="lg"
                  state={button}
                  icon={<FloppyDiskIcon weight="bold" />}
                  labels={{ idle: 'Save walk-in', loading: 'Saving…', success: 'Saved', error: 'Not saved' }}
                  className="min-w-[170px]"
                />
              </div>
            </div>
          </form>
        </Card>

        <TodayPanel version={todayVersion} />
      </div>

      {/* Success moment: the slip prints out */}
      <Modal
        open={Boolean(receipt)}
        onClose={() => receipt?.stage === 'complete' && nextVisitor()}
        title={receipt?.stage === 'complete' ? 'Walk-in recorded' : 'Recording walk-in'}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={receipt?.stage !== 'complete'}
              onClick={() =>
                slipWalkIn &&
                print(
                  <PrintableSlip
                    walkIn={slipWalkIn}
                    labels={labels}
                    companyName={companyName}
                    notifications={receipt?.notifications}
                    queued={queued}
                  />,
                )
              }
            >
              <PrinterIcon weight="bold" /> Print slip
            </Button>
            <Button variant="secondary" disabled={receipt?.stage !== 'complete'} onClick={() => setPassOpen(true)}>
              <TicketIcon weight="bold" /> Visitor pass
            </Button>
            <Button variant="primary" disabled={receipt?.stage !== 'complete'} onClick={nextVisitor} data-autofocus>
              Register next visitor
            </Button>
          </>
        }
      >
        {receipt && slipWalkIn && (
          <ReceiptPrinter
            stage={receipt.stage}
            labels={{ processing: 'Saving walk-in…', printing: 'Printing slip…', complete: 'Walk-in recorded' }}
            completeNote={queued ? 'Saved offline. Will sync' : undefined}
            onPrinted={() => setReceipt((r) => (r ? { ...r, stage: 'complete' } : r))}
          >
            <WalkInSlip
              walkIn={slipWalkIn}
              labels={labels}
              companyName={companyName}
              notifications={receipt.notifications}
              queued={queued}
            />
          </ReceiptPrinter>
        )}
        {receipt?.stage === 'complete' && slipWalkIn && (
          <NotifyContact walkIn={slipWalkIn} labels={labels} className="mt-5" />
        )}
      </Modal>

      <Modal
        open={passOpen}
        onClose={() => setPassOpen(false)}
        title="Visitor pass"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPassOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                slipWalkIn &&
                print(<PrintableVisitorPass walkIn={slipWalkIn} labels={labels} companyName={companyName} />)
              }
            >
              <PrinterIcon weight="bold" /> Print pass
            </Button>
          </>
        }
      >
        {slipWalkIn && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12, rotate: -1.5 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="py-4"
          >
            <VisitorPass walkIn={slipWalkIn} labels={labels} companyName={companyName} />
          </motion.div>
        )}
      </Modal>
    </div>
  )
}

function ReadOnlyTile({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div aria-live="off" className="flex items-center gap-3 rounded-xl border border-line bg-bg-sunken/60 px-4 py-3">
      <span className="text-gold [&_svg]:size-5">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{label}</p>
        <p
          className={
            mono ? 'text-lg font-semibold text-fg tabular-nums' : 'text-[15px] leading-tight font-semibold text-fg'
          }
        >
          {value}
        </p>
      </div>
    </div>
  )
}

/** Today's count, the latest walk-ins and anything waiting to sync. */
function TodayPanel({ version }: { version: number }) {
  const ref = useRefData()
  const { pending, online } = useSync()
  const [rows, setRows] = useState<WalkIn[] | null>(null)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let cancelled = false
    const today = todayKey()
    api
      .listWalkIns({ from: today, to: today }, 0, 6)
      .then((page) => {
        if (cancelled) return
        setRows(page.rows)
        setTotal(page.total)
      })
      .catch(() => !cancelled && setRows((r) => r ?? []))
    return () => {
      cancelled = true
    }
  }, [version, online])

  const queued = pending.filter((p) => p.kind === 'walk_in')

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="relative p-6">
          <div aria-hidden className="absolute -top-16 -right-10 size-40 rounded-full bg-gold/15 blur-3xl" />
          <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">Today’s walk-ins</p>
          <motion.p
            key={total + queued.length}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mt-1 font-display text-5xl font-medium text-fg"
          >
            {rows === null ? '—' : total + queued.length}
          </motion.p>
          {queued.length > 0 && (
            <Badge tone="warning" className="mt-2">
              <CloudSlashIcon weight="bold" /> {queued.length} waiting to sync
            </Badge>
          )}
        </div>
        <ul className="divide-y divide-line border-t border-line">
          {queued.map((q) =>
            q.kind === 'walk_in' ? (
              <li key={q.id} className="flex items-center gap-3 px-6 py-3 opacity-80">
                <CloudSlashIcon weight="duotone" className="size-5 shrink-0 text-amber" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">{q.payload.fullName}</p>
                  <p className="truncate text-xs text-muted">Saved offline · {formatTime(q.payload.visitedAt)}</p>
                </div>
              </li>
            ) : null,
          )}
          {rows?.map((w) => (
            <li key={w.id} className="flex items-center gap-3 px-6 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gold/10 text-gold">
                {w.visitType === 'client' ? (
                  <SourceIcon icon={ref.source(w.sourceId)?.icon ?? 'dots'} className="size-4" />
                ) : (
                  <VisitTypeIcon type={w.visitType} className="size-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-fg">{w.fullName}</p>
                <p className="truncate text-xs text-muted">
                  {w.visitType === 'client'
                    ? `${ref.project(w.projectId)?.name ?? ''} · ${ref.unitType(w.unitTypeId)?.name ?? ''}`
                    : [visitTypeLabel(w.visitType), ref.member(w.hostId)?.fullName ?? w.hostName]
                        .filter(Boolean)
                        .join(' · ')}
                </p>
              </div>
              <span className="text-xs font-semibold text-muted tabular-nums">{formatTime(w.visitedAt)}</span>
            </li>
          ))}
          {rows && rows.length === 0 && queued.length === 0 && (
            <li className="px-6 py-6 text-center text-sm text-muted">No walk-ins yet today.</li>
          )}
        </ul>
      </Card>
    </div>
  )
}
