import { useEffect, useMemo, useState } from 'react'
import { Controller, type UseFormReturn } from 'react-hook-form'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { PlusIcon } from '@phosphor-icons/react'
import { z } from 'zod'
import { useRefData } from '../../data/RefDataProvider'
import type { LeadSource, SalesPerson } from '../../data/types'
import { cn } from '../../lib/cn'
import { formatPhone, normalisePhone, phoneError } from '../../lib/phone'
import { SourceIcon } from '../SourceIcon'
import { Combobox } from '../ui/Combobox'
import { Field, Select, TextArea, TextInput } from '../ui/Field'
import { SalesPersonFormModal } from './SalesPersonFormModal'

export interface WalkInFormValues {
  fullName: string
  phone: string
  email: string
  projectId: string
  unitTypeId: string
  sourceId: string
  salesPersonId: string
  otherSourceText: string
  notes: string
  consent: boolean
}

export const EMPTY_WALK_IN: WalkInFormValues = {
  fullName: '',
  phone: '+254 ',
  email: '',
  projectId: '',
  unitTypeId: '',
  sourceId: '',
  salesPersonId: '',
  otherSourceText: '',
  notes: '',
  consent: false,
}

const emailOk = (v: string) => z.email().safeParse(v).success

/** Validation depends on the source list (which sources need a sales person / free text). */
export function walkInSchema(sources: LeadSource[], requireConsent: boolean) {
  return z
    .object({
      fullName: z.string().trim().min(2, 'Enter the visitor’s full name'),
      phone: z.string(),
      email: z.string().trim(),
      projectId: z.string().min(1, 'Choose a project'),
      unitTypeId: z.string().min(1, 'Choose a unit type'),
      sourceId: z.string().min(1, 'Choose how they heard about us'),
      salesPersonId: z.string(),
      otherSourceText: z.string().trim(),
      notes: z.string().max(1000, 'Keep notes under 1000 characters'),
      consent: z.boolean(),
    })
    .superRefine((v, ctx) => {
      const phone = phoneError(v.phone)
      if (phone) ctx.addIssue({ code: 'custom', path: ['phone'], message: phone })
      if (v.email && !emailOk(v.email))
        ctx.addIssue({ code: 'custom', path: ['email'], message: 'Enter a valid email address' })
      const kind = sources.find((s) => s.id === v.sourceId)?.kind
      if (kind === 'sales_person' && !v.salesPersonId) {
        ctx.addIssue({ code: 'custom', path: ['salesPersonId'], message: 'Choose the sales person' })
      }
      if (kind === 'other' && !v.otherSourceText) {
        ctx.addIssue({ code: 'custom', path: ['otherSourceText'], message: 'Tell us where they heard about us' })
      }
      if (requireConsent && !v.consent) {
        ctx.addIssue({
          code: 'custom',
          path: ['consent'],
          message: 'The client must consent before their details are saved',
        })
      }
    })
}

/** Converts form values to the stored shape (E.164 phone, nulls for empty optionals). */
export function toWalkInFields(v: WalkInFormValues, sources: LeadSource[]) {
  const kind = sources.find((s) => s.id === v.sourceId)?.kind
  return {
    fullName: v.fullName.trim().replace(/\s+/g, ' '),
    phone: normalisePhone(v.phone)!,
    email: v.email.trim().toLowerCase() || null,
    projectId: v.projectId,
    unitTypeId: v.unitTypeId,
    sourceId: v.sourceId,
    salesPersonId: kind === 'sales_person' ? v.salesPersonId || null : null,
    otherSourceText: kind === 'other' ? v.otherSourceText.trim() || null : null,
    notes: v.notes.trim() || null,
  }
}

const reveal = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
}

export function WalkInFields({
  form,
  includeInactiveSalesPersonId,
  compact = false,
}: {
  form: UseFormReturn<WalkInFormValues>
  /** Keep a deactivated sales person selectable when editing an old record. */
  includeInactiveSalesPersonId?: string | null
  compact?: boolean
}) {
  const reduce = useReducedMotion()
  const { data } = useRefData()
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = form
  const [addOpen, setAddOpen] = useState(false)
  const [addPrefill, setAddPrefill] = useState('')

  const projectId = watch('projectId')
  const sourceId = watch('sourceId')
  const projects = (data?.projects ?? []).filter((p) => p.isActive)
  const unitTypes = (data?.unitTypes ?? []).filter((u) => u.isActive && u.projectId === projectId)
  const sources = (data?.sources ?? []).filter((s) => s.isActive || s.id === sourceId)
  const kind = sources.find((s) => s.id === sourceId)?.kind

  // Unit types belong to a project: clear the choice when the project changes.
  useEffect(() => {
    const current = form.getValues('unitTypeId')
    if (current && !unitTypes.some((u) => u.id === current)) setValue('unitTypeId', '')
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const salesOptions = useMemo(
    () =>
      (data?.salesPersons ?? [])
        .filter((p) => p.isActive || p.id === includeInactiveSalesPersonId)
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
        .map((p) => ({
          value: p.id,
          label: p.fullName,
          description: [p.team, formatPhone(p.phone)].filter(Boolean).join(' · '),
        })),
    [data?.salesPersons, includeInactiveSalesPersonId],
  )

  const onPersonAdded = (person: SalesPerson) => {
    setValue('salesPersonId', person.id, { shouldValidate: true })
  }

  return (
    <div className="space-y-5">
      <div className={cn('grid gap-5', !compact && 'md:grid-cols-2')}>
        <Field label="Full name" required error={errors.fullName?.message} className={cn(!compact && 'md:col-span-2')}>
          {(a) => (
            <TextInput
              {...a}
              {...register('fullName')}
              autoComplete="off"
              autoCapitalize="words"
              placeholder="e.g. Amina Odhiambo"
              data-autofocus
            />
          )}
        </Field>
        <Field
          label="Phone number"
          required
          error={errors.phone?.message}
          hint="Kenyan numbers: 07XX or 01XX. International: start with + and the country code."
        >
          {(a) => (
            <TextInput
              {...a}
              {...register('phone', {
                onBlur: (e) => {
                  const n = normalisePhone(e.target.value)
                  if (n) setValue('phone', formatPhone(n), { shouldValidate: true })
                },
              })}
              type="tel"
              inputMode="tel"
              autoComplete="off"
            />
          )}
        </Field>
        <Field label="Email" error={errors.email?.message} hint="Optional">
          {(a) => (
            <TextInput
              {...a}
              {...register('email')}
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="name@example.com"
            />
          )}
        </Field>
        <Field label="Preferred project" required error={errors.projectId?.message}>
          {(a) => (
            <Select {...a} {...register('projectId')}>
              <option value="">Choose a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Unit type" required error={errors.unitTypeId?.message}>
          {(a) => (
            <Select {...a} {...register('unitTypeId')} disabled={!projectId}>
              <option value="">{projectId ? 'Choose a unit type…' : 'Choose a project first'}</option>
              {unitTypes.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-fg/85">
          How did you find out about us?<span className="ml-0.5 text-gold">*</span>
        </legend>
        <div role="radiogroup" className={cn('grid grid-cols-2 gap-2.5 sm:grid-cols-3', compact && 'sm:grid-cols-3')}>
          {sources.map((s) => {
            const selected = s.id === sourceId
            return (
              <label key={s.id} className="group relative cursor-pointer">
                <input type="radio" value={s.id} {...register('sourceId')} className="peer sr-only" />
                <motion.span
                  whileTap={reduce ? undefined : { scale: 0.97 }}
                  className={cn(
                    'flex h-full min-h-[64px] items-center gap-3 rounded-xl border px-3.5 py-3 text-[13px] font-semibold transition-all duration-200',
                    'peer-focus-visible:shadow-glow',
                    selected
                      ? 'border-gold bg-gold/12 text-fg shadow-[0_8px_22px_-14px_rgb(201_154_48/0.9)]'
                      : 'border-line bg-field text-fg/80 group-hover:-translate-y-0.5 group-hover:border-gold/45',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-lg transition-colors',
                      selected ? 'bg-gold text-ink-900' : 'bg-gold/10 text-gold',
                    )}
                  >
                    <SourceIcon icon={s.icon} className="size-5" weight={selected ? 'fill' : 'duotone'} />
                  </span>
                  <span className="leading-tight">{s.name}</span>
                </motion.span>
              </label>
            )
          })}
        </div>
        {errors.sourceId && (
          <p className="mt-1.5 text-xs font-medium text-rose dark:text-[#e08a80]">{errors.sourceId.message}</p>
        )}
      </fieldset>

      <AnimatePresence initial={false}>
        {kind === 'sales_person' && (
          <motion.div key="sp" {...reveal} className="overflow-hidden">
            <div className="rounded-xl border border-gold/30 bg-gold/[0.06] p-4">
              <Field
                label="Sales person"
                required
                error={errors.salesPersonId?.message}
                hint="They will be notified by email and WhatsApp when you save."
              >
                {(a) => (
                  <Controller
                    control={control}
                    name="salesPersonId"
                    render={({ field }) => (
                      <Combobox
                        id={a.id}
                        aria-invalid={a['aria-invalid']}
                        aria-describedby={a['aria-describedby']}
                        options={salesOptions}
                        value={field.value || null}
                        onChange={(v) => field.onChange(v)}
                        placeholder="Search by name…"
                        emptyText="No sales person with that name"
                        footerAction={{
                          label: (
                            <>
                              <PlusIcon weight="bold" className="size-4" /> Add new sales person
                            </>
                          ),
                          onSelect: (q) => {
                            setAddPrefill(q)
                            setAddOpen(true)
                          },
                        }}
                      />
                    )}
                  />
                )}
              </Field>
            </div>
          </motion.div>
        )}
        {kind === 'other' && (
          <motion.div key="other" {...reveal} className="overflow-hidden">
            <Field label="Where did they hear about us?" required error={errors.otherSourceText?.message}>
              {(a) => <TextInput {...a} {...register('otherSourceText')} placeholder="e.g. Billboard on Ngong Road" />}
            </Field>
          </motion.div>
        )}
      </AnimatePresence>

      <Field label="Notes" error={errors.notes?.message} hint="Optional: anything the sales team should know.">
        {(a) => (
          <TextArea {...a} {...register('notes')} rows={3} placeholder="Budget, preferred floor, follow-up time…" />
        )}
      </Field>

      <SalesPersonFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        prefillName={addPrefill}
        onSaved={onPersonAdded}
      />
    </div>
  )
}
