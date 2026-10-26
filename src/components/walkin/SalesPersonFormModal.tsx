import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { UserPlusIcon } from '@phosphor-icons/react'
import { api } from '../../data'
import { useRefData } from '../../data/RefDataProvider'
import type { SalesPerson } from '../../data/types'
import { uuid } from '../../lib/ids'
import { formatPhone, normalisePhone, phoneError } from '../../lib/phone'
import { zodResolver } from '../../lib/zodResolver'
import { useSync } from '../../offline/SyncProvider'
import { Button } from '../ui/Button'
import { DynamicButton, useDynamicAction } from '../ui/DynamicButton'
import { Field, TextInput } from '../ui/Field'
import { Modal } from '../ui/Overlay'
import { useToast } from '../ui/Toaster'

const schema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter their full name'),
    phone: z.string(),
    sameAsPhone: z.boolean(),
    whatsapp: z.string(),
    email: z.string().trim().min(1, 'Email is required for notifications'),
    team: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    const p = phoneError(v.phone)
    if (p) ctx.addIssue({ code: 'custom', path: ['phone'], message: p })
    if (!v.sameAsPhone) {
      const w = phoneError(v.whatsapp, 'WhatsApp number')
      if (w) ctx.addIssue({ code: 'custom', path: ['whatsapp'], message: w })
    }
    if (v.email && !z.email().safeParse(v.email).success) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'Enter a valid email address' })
    }
  })
type Values = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  /** Edit an existing person (admin). Omit to create. */
  person?: SalesPerson | null
  prefillName?: string
  onSaved?: (person: SalesPerson) => void
}

/** Add (from the walk-in form or the Sales Persons page) or edit a sales person. */
export function SalesPersonFormModal({ open, onClose, person, prefillName = '', onSaved }: Props) {
  const { submitSalesPerson } = useSync()
  const { refresh } = useRefData()
  const { toast } = useToast()
  const action = useDynamicAction(1200)
  const editing = Boolean(person)

  const form = useForm<Values>({ resolver: zodResolver(schema) })
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = form

  useEffect(() => {
    if (!open) return
    reset(
      person
        ? {
            fullName: person.fullName,
            phone: formatPhone(person.phone),
            sameAsPhone: person.whatsapp === person.phone,
            whatsapp: formatPhone(person.whatsapp),
            email: person.email,
            team: person.team ?? '',
          }
        : { fullName: prefillName, phone: '+254 ', sameAsPhone: true, whatsapp: '+254 ', email: '', team: '' },
    )
  }, [open, person, prefillName, reset])

  const sameAsPhone = watch('sameAsPhone')

  const onSubmit = async (v: Values) => {
    const phone = normalisePhone(v.phone)!
    const values = {
      fullName: v.fullName.replace(/\s+/g, ' '),
      phone,
      whatsapp: v.sameAsPhone ? phone : normalisePhone(v.whatsapp)!,
      email: v.email.toLowerCase(),
      team: v.team || null,
    }
    try {
      const saved = await action.run(async () => {
        if (person) {
          const updated = await api.updateSalesPerson(person.id, values)
          await refresh()
          return { person: updated, queued: false }
        }
        return submitSalesPerson({ id: uuid(), ...values })
      })
      if (saved.queued)
        toast({
          title: 'Sales person saved offline',
          description: 'They will sync when you are back online.',
          tone: 'warning',
        })
      onSaved?.(saved.person)
      window.setTimeout(onClose, 650)
    } catch (err) {
      toast({
        title: 'Could not save sales person',
        description: err instanceof Error ? err.message : undefined,
        tone: 'error',
      })
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit sales person' : 'Add a sales person'}
      description={editing ? undefined : 'They will be selected on the form straight away.'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <DynamicButton
            type="submit"
            form="sales-person-form"
            state={action.state}
            icon={editing ? undefined : <UserPlusIcon weight="bold" />}
            labels={
              editing
                ? { idle: 'Save changes', loading: 'Saving…', success: 'Saved' }
                : { idle: 'Add sales person', loading: 'Adding…', success: 'Added' }
            }
          />
        </>
      }
    >
      <form
        id="sales-person-form"
        noValidate
        onSubmit={(e) => {
          e.stopPropagation()
          void handleSubmit(onSubmit)(e)
        }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <Field label="Full name" required error={errors.fullName?.message} className="sm:col-span-2">
          {(a) => <TextInput {...a} {...register('fullName')} autoComplete="off" data-autofocus />}
        </Field>
        <Field label="Phone" required error={errors.phone?.message}>
          {(a) => <TextInput {...a} {...register('phone')} type="tel" inputMode="tel" autoComplete="off" />}
        </Field>
        <Field label="Email" required error={errors.email?.message}>
          {(a) => <TextInput {...a} {...register('email')} type="email" autoComplete="off" />}
        </Field>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-fg/85 sm:col-span-2">
          <input type="checkbox" {...register('sameAsPhone')} className="size-4 accent-[#c99a30]" />
          WhatsApp is on the same number
        </label>
        {!sameAsPhone && (
          <Field label="WhatsApp number" required error={errors.whatsapp?.message} className="sm:col-span-2">
            {(a) => <TextInput {...a} {...register('whatsapp')} type="tel" inputMode="tel" autoComplete="off" />}
          </Field>
        )}
        <Field label="Team / branch" hint="Optional" className="sm:col-span-2">
          {(a) => <TextInput {...a} {...register('team')} autoComplete="off" placeholder="e.g. Westlands" />}
        </Field>
      </form>
    </Modal>
  )
}
