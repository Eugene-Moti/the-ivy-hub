import { useEffect, useMemo, useState } from 'react'
import { Controller, type UseFormReturn } from 'react-hook-form'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowUUpLeftIcon, PlusIcon, UserCircleIcon } from '@phosphor-icons/react'
import { z } from 'zod'
import { useRefData } from '../../data/RefDataProvider'
import type { LeadSource, TeamMember, VisitType, WalkInDetails } from '../../data/types'
import { cn } from '../../lib/cn'
import { formatPhone, normalisePhone, phoneError } from '../../lib/phone'
import { SourceIcon } from '../SourceIcon'
import { VISIT_TYPES } from '../VisitType'
import { Combobox } from '../ui/Combobox'
import { Field, Select, TextArea, TextInput } from '../ui/Field'
import { TeamMemberFormModal } from './TeamMemberFormModal'

export interface WalkInFormValues {
  visitType: VisitType
  fullName: string
  phone: string
  email: string
  projectId: string
  unitTypeId: string
  sourceId: string
  salesPersonId: string
  otherSourceText: string
  hostId: string
  hostName: string
  organisation: string
  purpose: string
  notes: string
  consent: boolean
}

export const EMPTY_WALK_IN: WalkInFormValues = {
  visitType: 'client',
  fullName: '',
  phone: '+254 ',
  email: '',
  projectId: '',
  unitTypeId: '',
  sourceId: '',
  salesPersonId: '',
  otherSourceText: '',
  hostId: '',
  hostName: '',
  organisation: '',
  purpose: '',
  notes: '',
  consent: false,
}

const emailOk = (v: string) => z.email().safeParse(v).success

/**
 * Validation depends on the visit type (clients need project/unit/source; other visitors need a host)
 * and on the source list (which sources need a sales person / free text).
 */
export function walkInSchema(sources: LeadSource[], requireConsent: boolean) {
  return z
    .object({
      visitType: z.enum(['client', 'meeting', 'delivery', 'interview', 'other']),
      fullName: z.string().trim().min(2, 'Enter the visitor’s full name'),
      phone: z.string(),
      email: z.string().trim(),
      projectId: z.string(),
      unitTypeId: z.string(),
      sourceId: z.string(),
      salesPersonId: z.string(),
      otherSourceText: z.string().trim(),
      hostId: z.string(),
      hostName: z.string().trim(),
      organisation: z.string().trim().max(120),
      purpose: z.string().trim().max(200),
      notes: z.string().max(1000, 'Keep notes under 1000 characters'),
      consent: z.boolean(),
    })
    .superRefine((v, ctx) => {
      const issue = (path: keyof WalkInFormValues, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message })
      const phone = phoneError(v.phone)
      if (phone) issue('phone', phone)
      if (v.email && !emailOk(v.email)) issue('email', 'Enter a valid email address')
      if (v.visitType === 'client') {
        if (!v.projectId) issue('projectId', 'Choose a project')
        if (!v.unitTypeId) issue('unitTypeId', 'Choose a unit type')
        if (!v.sourceId) issue('sourceId', 'Choose how they heard about us')
        const kind = sources.find((s) => s.id === v.sourceId)?.kind
        if (kind === 'sales_person' && !v.salesPersonId) issue('salesPersonId', 'Choose the sales person')
        if (kind === 'other' && !v.otherSourceText) issue('otherSourceText', 'Tell us where they heard about us')
      } else {
        if (!v.hostId && !v.hostName) issue('hostId', 'Who are they here to see?')
        if (v.visitType === 'other' && !v.purpose) issue('purpose', 'Briefly say what the visit is for')
      }
      if (requireConsent && !v.consent) issue('consent', 'The visitor must consent before their details are saved')
    })
}

/** Converts form values to the stored shape (E.164 phone, nulls for fields that don't apply). */
export function toWalkInFields(v: WalkInFormValues, sources: LeadSource[]): WalkInDetails {
  const client = v.visitType === 'client'
  const kind = client ? sources.find((s) => s.id === v.sourceId)?.kind : undefined
  const text = (s: string) => s.trim().replace(/\s+/g, ' ') || null
  return {
    visitType: v.visitType,
    fullName: v.fullName.trim().replace(/\s+/g, ' '),
    phone: normalisePhone(v.phone)!,
    email: v.email.trim().toLowerCase() || null,
    projectId: client ? v.projectId : null,
    unitTypeId: client ? v.unitTypeId : null,
    sourceId: client ? v.sourceId : null,
    salesPersonId: kind === 'sales_person' ? v.salesPersonId || null : null,
    otherSourceText: kind === 'other' ? text(v.otherSourceText) : null,
    hostId: client ? null : v.hostId || null,
    hostName: client || v.hostId ? null : text(v.hostName),
    organisation: client ? null : text(v.organisation),
    purpose: client ? null : text(v.purpose),
    notes: v.notes.trim() || null,
  }
}

const reveal = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
}

function ChoiceCard({
  selected,
  icon,
  label,
  input,
  compact,
}: {
  selected: boolean
  icon: React.ReactNode
  label: string
  input: React.ReactNode
  compact?: boolean
}) {
  const reduce = useReducedMotion()
  return (
    <label className="group relative cursor-pointer">
      {input}
      <motion.span
        whileTap={reduce ? undefined : { scale: 0.97 }}
        className={cn(
          'flex h-full items-center gap-3 rounded-xl border px-3.5 py-3 text-[13px] font-semibold transition-all duration-200',
          compact ? 'min-h-[52px]' : 'min-h-[64px]',
          'peer-focus-visible:shadow-glow',
          selected
            ? 'border-gold bg-gold/12 text-fg shadow-[0_8px_22px_-14px_rgb(201_154_48/0.9)]'
            : 'border-line bg-field text-fg/80 group-hover:-translate-y-0.5 group-hover:border-gold/45',
        )}
      >
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-lg transition-colors [&_svg]:size-5',
            selected ? 'bg-gold text-ink-900' : 'bg-gold/10 text-gold',
          )}
        >
          {icon}
        </span>
        <span className="leading-tight">{label}</span>
      </motion.span>
    </label>
  )
}

export function WalkInFields({
  form,
  includeInactiveMemberIds = [],
  compact = false,
}: {
  form: UseFormReturn<WalkInFormValues>
  /** Keep deactivated team members selectable when editing an old record. */
  includeInactiveMemberIds?: (string | null)[]
  compact?: boolean
}) {
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
  const [hostFreeText, setHostFreeText] = useState(() => Boolean(form.getValues('hostName')))

  const visitType = watch('visitType')
  const isClient = visitType === 'client'
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

  const keepIds = includeInactiveMemberIds.join(',')
  const { salesOptions, hostOptions } = useMemo(() => {
    const keep = keepIds.split(',')
    const options = (salesOnly: boolean) =>
      (data?.team ?? [])
        .filter((p) => (p.isActive || keep.includes(p.id)) && (!salesOnly || p.isSalesPerson))
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
        .map((p) => ({
          value: p.id,
          label: p.fullName,
          description: [p.title, p.branch].filter(Boolean).join(' · ') || formatPhone(p.phone),
        }))
    return { salesOptions: options(true), hostOptions: options(false) }
  }, [data?.team, keepIds])

  const onPersonAdded = (person: TeamMember) => setValue('salesPersonId', person.id, { shouldValidate: true })

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-fg/85">
          Reason for the visit<span className="ml-0.5 text-gold">*</span>
        </legend>
        <div
          role="radiogroup"
          className={cn('grid grid-cols-2 gap-2.5', compact ? 'sm:grid-cols-3' : 'sm:grid-cols-3 xl:grid-cols-5')}
        >
          {VISIT_TYPES.map((t) => (
            <ChoiceCard
              key={t.value}
              compact
              selected={visitType === t.value}
              icon={<t.Icon weight={visitType === t.value ? 'fill' : 'duotone'} />}
              label={t.chip}
              input={<input type="radio" value={t.value} {...register('visitType')} className="peer sr-only" />}
            />
          ))}
        </div>
      </fieldset>

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
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {isClient ? (
          <motion.div key="client" {...reveal} className="space-y-5 overflow-hidden">
            <div className={cn('grid gap-5', !compact && 'md:grid-cols-2')}>
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
              <div role="radiogroup" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {sources.map((s) => (
                  <ChoiceCard
                    key={s.id}
                    selected={s.id === sourceId}
                    icon={<SourceIcon icon={s.icon} weight={s.id === sourceId ? 'fill' : 'duotone'} />}
                    label={s.name}
                    input={<input type="radio" value={s.id} {...register('sourceId')} className="peer sr-only" />}
                  />
                ))}
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
                    {(a) => (
                      <TextInput {...a} {...register('otherSourceText')} placeholder="e.g. Billboard on Ngong Road" />
                    )}
                  </Field>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div key="visitor" {...reveal} className="overflow-hidden">
            <div className="grid gap-5 rounded-xl border border-gold/30 bg-gold/[0.06] p-4 md:grid-cols-2">
              <Field
                label="Here to see"
                required
                error={errors.hostId?.message}
                hint="They will be told their visitor has arrived, by email and WhatsApp."
                className="md:col-span-2"
              >
                {(a) =>
                  hostFreeText ? (
                    <div className="flex gap-2">
                      <TextInput
                        {...a}
                        {...register('hostName')}
                        autoFocus
                        placeholder="Name of the person they came to see"
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setHostFreeText(false)
                          setValue('hostName', '')
                        }}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-semibold text-muted focus-ring hover:text-fg"
                      >
                        <ArrowUUpLeftIcon weight="bold" className="size-4" /> Pick from team
                      </button>
                    </div>
                  ) : (
                    <Controller
                      control={control}
                      name="hostId"
                      render={({ field }) => (
                        <Combobox
                          id={a.id}
                          aria-invalid={a['aria-invalid']}
                          aria-describedby={a['aria-describedby']}
                          options={hostOptions}
                          value={field.value || null}
                          onChange={(v) => field.onChange(v)}
                          placeholder="Search the team by name…"
                          emptyText="Nobody on the team with that name"
                          footerAction={{
                            label: (
                              <>
                                <UserCircleIcon weight="bold" className="size-4" /> Someone not on the list
                              </>
                            ),
                            onSelect: (q) => {
                              field.onChange('')
                              setValue('hostName', q)
                              setHostFreeText(true)
                            },
                          }}
                        />
                      )}
                    />
                  )
                }
              </Field>
              <Field label="Company / organisation" hint="Optional">
                {(a) => <TextInput {...a} {...register('organisation')} placeholder="e.g. G4S Courier" />}
              </Field>
              <Field
                label="Purpose of visit"
                required={visitType === 'other'}
                error={errors.purpose?.message}
                hint={visitType === 'other' ? undefined : 'Optional'}
              >
                {(a) => (
                  <TextInput
                    {...a}
                    {...register('purpose')}
                    placeholder={
                      visitType === 'delivery'
                        ? 'e.g. Documents delivery'
                        : visitType === 'interview'
                          ? 'e.g. Sales Executive interview'
                          : 'e.g. Partnership meeting'
                    }
                  />
                )}
              </Field>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Field
        label="Notes"
        error={errors.notes?.message}
        hint={isClient ? 'Optional: anything the sales team should know.' : 'Optional'}
      >
        {(a) => (
          <TextArea
            {...a}
            {...register('notes')}
            rows={3}
            placeholder={isClient ? 'Budget, preferred floor, follow-up time…' : 'Anything the host should know…'}
          />
        )}
      </Field>

      <TeamMemberFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        prefillName={addPrefill}
        defaultSalesPerson
        onSaved={onPersonAdded}
      />
    </div>
  )
}
