import { useEffect, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  BuildingsIcon,
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  GearSixIcon,
  KeyIcon,
  MegaphoneIcon,
  PlusIcon,
  SparkleIcon,
  UserMinusIcon,
  UserPlusIcon,
  UsersIcon,
  WarningCircleIcon,
  WhatsappLogoIcon,
} from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthProvider'
import { SOURCE_ICONS, SourceIcon } from '../components/SourceIcon'
import { Button } from '../components/ui/Button'
import { DynamicButton, useDynamicAction } from '../components/ui/DynamicButton'
import { Field, inputClass, Select, Switch, TextInput } from '../components/ui/Field'
import { HoldToConfirmButton } from '../components/ui/HoldToConfirmButton'
import { Modal } from '../components/ui/Overlay'
import { Badge, Card, PageHeader, Segmented } from '../components/ui/Primitives'
import { useToast } from '../components/ui/Toaster'
import { api } from '../data'
import { getDemoNotifyMode, resetDemoData, setDemoNotifyMode, type DemoNotifyMode } from '../data/demo/demoApi'
import { useRefData } from '../data/RefDataProvider'
import type { LeadSource, Profile, Project, Role, SourceKind, UnitType } from '../data/types'
import { cn } from '../lib/cn'
import { passwordRule } from '../lib/password'
import { zodResolver } from '../lib/zodResolver'

type Tab = 'general' | 'users' | 'projects' | 'sources' | 'notifications'

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general')
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        eyebrow="Admin"
        title="Settings"
        description="Company details, users and the lists used on the walk-in form."
      />
      <Segmented
        ariaLabel="Settings sections"
        className="mb-6 max-w-full overflow-x-auto"
        value={tab}
        onChange={setTab}
        options={[
          {
            value: 'general',
            label: (
              <>
                <GearSixIcon weight="bold" /> General
              </>
            ),
          },
          {
            value: 'users',
            label: (
              <>
                <UsersIcon weight="bold" /> Users
              </>
            ),
          },
          {
            value: 'projects',
            label: (
              <>
                <BuildingsIcon weight="bold" /> Projects
              </>
            ),
          },
          {
            value: 'sources',
            label: (
              <>
                <MegaphoneIcon weight="bold" /> Lead sources
              </>
            ),
          },
          {
            value: 'notifications',
            label: (
              <>
                <EnvelopeSimpleIcon weight="bold" /> Notifications
              </>
            ),
          },
        ]}
      />
      {tab === 'general' && <GeneralSettings />}
      {tab === 'users' && <UsersSettings />}
      {tab === 'projects' && <ProjectsSettings />}
      {tab === 'sources' && <SourcesSettings />}
      {tab === 'notifications' && <NotificationSettings />}
    </div>
  )
}

function Section({
  title,
  description,
  children,
  actions,
}: {
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <Card className="mb-6 p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-fg">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </Card>
  )
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : undefined)

/* ------------------------------------------------------------------ */
/* General                                                              */
/* ------------------------------------------------------------------ */

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function GeneralSettings() {
  const { isDemo } = useAuth()
  const ref = useRefData()
  const { toast } = useToast()
  const action = useDynamicAction()
  const [s, setS] = useState(ref.settings)
  useEffect(() => setS(ref.settings), [ref.settings])

  const dirty = JSON.stringify(s) !== JSON.stringify(ref.settings)
  const save = () =>
    action
      .run(async () => {
        if (!s.companyName.trim()) throw new Error('Company name is required')
        if (s.openTime >= s.closeTime) throw new Error('Closing time must be after opening time')
        await api.updateSettings({ ...s, companyName: s.companyName.trim() })
        await ref.refresh()
      })
      .catch((err) => toast({ title: 'Could not save settings', description: errorText(err), tone: 'error' }))

  return (
    <>
      <Section
        title="Company & office hours"
        description="Shown on slips, visitor passes and the consent line. Office hours shape the dashboard heatmap."
        actions={
          <DynamicButton
            state={action.state}
            disabled={!dirty && action.state === 'idle'}
            onClick={save}
            labels={{ idle: 'Save changes', loading: 'Saving…', success: 'Saved', error: 'Not saved' }}
          />
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Company name" required className="sm:col-span-2">
            {(a) => (
              <TextInput {...a} value={s.companyName} onChange={(e) => setS({ ...s, companyName: e.target.value })} />
            )}
          </Field>
          <Field label="Opens at">
            {(a) => (
              <TextInput
                {...a}
                type="time"
                value={s.openTime}
                onChange={(e) => setS({ ...s, openTime: e.target.value })}
              />
            )}
          </Field>
          <Field label="Closes at">
            {(a) => (
              <TextInput
                {...a}
                type="time"
                value={s.closeTime}
                onChange={(e) => setS({ ...s, closeTime: e.target.value })}
              />
            )}
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-2 text-[13px] font-semibold text-fg/85">Working days</p>
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((label, i) => {
                const day = i + 1
                const on = s.workingDays.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setS({
                        ...s,
                        workingDays: on ? s.workingDays.filter((d) => d !== day) : [...s.workingDays, day].sort(),
                      })
                    }
                    className={cn(
                      'h-10 w-14 rounded-lg border text-sm font-semibold focus-ring transition-colors',
                      on ? 'border-gold bg-gold/15 text-fg' : 'border-line text-muted hover:border-gold/40',
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Permissions">
        <div className="space-y-6">
          <Field
            label="Receptionist edit window (hours)"
            hint="How long a receptionist can correct their own record after saving it."
          >
            {(a) => (
              <TextInput
                {...a}
                type="number"
                min={1}
                max={168}
                className="max-w-[140px]"
                value={s.editWindowHours}
                onChange={(e) =>
                  setS({ ...s, editWindowHours: Math.max(1, Math.min(168, Number(e.target.value) || 1)) })
                }
              />
            )}
          </Field>
          <Switch
            checked={s.receptionistCanExport}
            onChange={(v) => setS({ ...s, receptionistCanExport: v })}
            label="Receptionists can export records"
            description="Off by default: only admins can download CSV / Excel. Every export is recorded in the activity log."
          />
        </div>
      </Section>

      {isDemo && (
        <Section
          title="Demo data"
          description="Demo mode keeps everything in this browser. Reset it to the original sample data."
        >
          <HoldToConfirmButton
            tone="gold"
            label="Hold to reset demo data"
            confirmedLabel="Reset"
            icon={<ArrowClockwiseIcon weight="bold" />}
            onConfirm={() => resetDemoData()}
            onSettled={() => window.location.reload()}
          />
        </Section>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Users                                                                */
/* ------------------------------------------------------------------ */

function suggestPassword() {
  const words = ['Ivy', 'Gold', 'Oak', 'Cedar', 'Maple', 'Acacia', 'Baobab']
  const w = words[Math.floor(Math.random() * words.length)]
  const n = (crypto.getRandomValues(new Uint32Array(1))[0] % 9000) + 1000
  return `${w}#${n}${String.fromCharCode(97 + (n % 26))}`
}

function UsersSettings() {
  const { user: me } = useAuth()
  const { toast } = useToast()
  const [users, setUsers] = useState<Profile[] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [resetFor, setResetFor] = useState<Profile | null>(null)

  const load = () =>
    api
      .listUsers()
      .then(setUsers)
      .catch((err) => toast({ title: 'Could not load users', description: errorText(err), tone: 'error' }))
  useEffect(() => {
    void load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const update = async (u: Profile, patch: Partial<Pick<Profile, 'role' | 'isActive'>>, reload = true) => {
    try {
      await api.updateUser(u.id, patch)
      if (reload) await load()
    } catch (err) {
      toast({ title: 'Could not update user', description: errorText(err), tone: 'error' })
      throw err
    }
  }

  return (
    <Section
      title="Users"
      description="Only admins can create accounts. Deactivated users cannot sign in; their history is kept."
      actions={
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <UserPlusIcon weight="bold" /> New user
        </Button>
      }
    >
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {(users ?? []).map((u) => {
          const self = u.id === me?.id
          return (
            <div key={u.id} className={cn('flex flex-wrap items-center gap-4 p-4', !u.isActive && 'opacity-60')}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 text-xs font-bold text-ink-900">
                {u.name
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-fg">
                  {u.name}
                  {self && <Badge tone="gold">You</Badge>}
                  {!u.isActive && <Badge>Deactivated</Badge>}
                  {u.isActive && u.mustChangePassword && <Badge tone="warning">Temporary password</Badge>}
                </p>
                <p className="truncate text-[13px] text-muted">
                  {u.email} · @{u.username}
                </p>
              </div>
              <select
                aria-label={`Role for ${u.name}`}
                value={u.role}
                disabled={self}
                onChange={(e) => void update(u, { role: e.target.value as Role }).catch(() => {})}
                className={cn(inputClass, 'ivy-select h-9 w-auto rounded-lg pr-9 text-sm')}
              >
                <option value="receptionist">Receptionist</option>
                <option value="admin">Admin</option>
              </select>
              <Button size="sm" variant="secondary" onClick={() => setResetFor(u)} disabled={!u.isActive}>
                <KeyIcon weight="bold" /> Reset password
              </Button>
              {!self &&
                (u.isActive ? (
                  <HoldToConfirmButton
                    size="sm"
                    label="Hold to deactivate"
                    confirmedLabel="Deactivated"
                    icon={<UserMinusIcon weight="bold" />}
                    onConfirm={() => update(u, { isActive: false }, false)}
                    onSettled={() => void load()}
                  />
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => void update(u, { isActive: true }).catch(() => {})}>
                    <ArrowCounterClockwiseIcon weight="bold" /> Reactivate
                  </Button>
                ))}
            </div>
          )
        })}
        {!users && <p className="p-4 text-sm text-muted">Loading users…</p>}
      </div>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => void load()} />
      <ResetPasswordModal user={resetFor} onClose={() => setResetFor(null)} />
    </Section>
  )
}

const newUserSchema = z.object({
  name: z.string().trim().min(2, 'Enter their full name'),
  email: z.email('Enter a valid email'),
  username: z
    .string()
    .trim()
    .min(3, 'At least 3 characters')
    .regex(/^[a-z0-9._-]+$/i, 'Letters, numbers, dot, dash or underscore'),
  role: z.enum(['admin', 'receptionist']),
  password: passwordRule,
})
type NewUserValues = z.infer<typeof newUserSchema>

function CreateUserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast()
  const action = useDynamicAction(1000)
  const form = useForm<NewUserValues>({ resolver: zodResolver(newUserSchema) })
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = form

  useEffect(() => {
    if (open) reset({ name: '', email: '', username: '', role: 'receptionist', password: suggestPassword() })
  }, [open, reset])

  const onSubmit = (v: NewUserValues) =>
    action
      .run(() => api.createUser(v))
      .then(() => {
        toast({
          title: `${v.name} can now sign in`,
          description: `Share the temporary password: ${v.password}`,
          tone: 'success',
          durationMs: 9000,
        })
        onCreated()
        window.setTimeout(onClose, 600)
      })
      .catch((err) => toast({ title: 'Could not create user', description: errorText(err), tone: 'error' }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New user"
      description="They should change the temporary password after first sign-in."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <DynamicButton
            type="submit"
            form="new-user"
            state={action.state}
            labels={{ idle: 'Create user', loading: 'Creating…', success: 'Created' }}
          />
        </>
      }
    >
      <form id="new-user" noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={errors.name?.message} className="sm:col-span-2">
          {(a) => <TextInput {...a} {...register('name')} data-autofocus />}
        </Field>
        <Field label="Email" required error={errors.email?.message}>
          {(a) => <TextInput {...a} {...register('email')} type="email" autoComplete="off" />}
        </Field>
        <Field label="Username" required error={errors.username?.message}>
          {(a) => <TextInput {...a} {...register('username')} autoComplete="off" autoCapitalize="none" />}
        </Field>
        <Field label="Role" required>
          {(a) => (
            <Select {...a} {...register('role')}>
              <option value="receptionist">Receptionist</option>
              <option value="admin">Admin</option>
            </Select>
          )}
        </Field>
        <Field
          label="Temporary password"
          required
          error={errors.password?.message}
          aside={
            <button
              type="button"
              className="text-xs font-semibold text-link hover:underline"
              onClick={() => setValue('password', suggestPassword(), { shouldValidate: true })}
            >
              Suggest
            </button>
          }
        >
          {(a) => <TextInput {...a} {...register('password')} autoComplete="new-password" className="font-mono" />}
        </Field>
      </form>
    </Modal>
  )
}

function ResetPasswordModal({ user, onClose }: { user: Profile | null; onClose: () => void }) {
  const { toast } = useToast()
  const [password, setPassword] = useState('')
  useEffect(() => {
    if (user) setPassword(suggestPassword())
  }, [user])
  const check = passwordRule.safeParse(password)

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      title="Reset password"
      description={user ? `Set a new password for ${user.name}.` : undefined}
      size="sm"
    >
      <Field
        label="New password"
        error={password && !check.success ? check.error.issues[0].message : undefined}
        hint="Share it with them privately; they should change it after signing in."
      >
        {(a) => (
          <TextInput
            {...a}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="font-mono"
          />
        )}
      </Field>
      <HoldToConfirmButton
        className="mt-5 w-full"
        tone="gold"
        label="Hold to reset password"
        confirmedLabel="Password reset"
        icon={<KeyIcon weight="bold" />}
        disabled={!check.success}
        onConfirm={async () => {
          if (!user) return
          try {
            await api.resetPassword(user.id, password)
          } catch (err) {
            toast({ title: 'Could not reset password', description: errorText(err), tone: 'error' })
            throw err
          }
        }}
        onSettled={() => {
          toast({
            title: 'Password reset',
            description: `New password for ${user?.name}: ${password}`,
            tone: 'success',
            durationMs: 9000,
          })
          onClose()
        }}
      />
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Projects & unit types                                                */
/* ------------------------------------------------------------------ */

function InlineName({ value, onSave, label }: { value: string; onSave: (v: string) => Promise<void>; label: string }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const commit = () => {
    const next = v.trim()
    if (!next) return setV(value)
    if (next !== value) void onSave(next).catch(() => setV(value))
  }
  return (
    <input
      aria-label={label}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
      className={cn(
        inputClass,
        'h-9 rounded-lg border-transparent bg-transparent px-2 font-semibold hover:border-line focus:bg-field',
      )}
    />
  )
}

function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const action = useDynamicAction(900)
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        void action
          .run(() => onAdd(name.trim()))
          .then(() => setName(''))
          .catch(() => {})
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(inputClass, 'h-9 rounded-lg text-sm')}
      />
      <DynamicButton
        type="submit"
        size="sm"
        variant="secondary"
        state={action.state}
        icon={<PlusIcon weight="bold" />}
        labels={{ idle: 'Add', loading: 'Adding…', success: 'Added' }}
      />
    </form>
  )
}

function ProjectsSettings() {
  const ref = useRefData()
  const { toast } = useToast()
  const projects = ref.data?.projects ?? []
  const units = ref.data?.unitTypes ?? []

  const run = async (fn: () => Promise<unknown>, refresh = true) => {
    try {
      await fn()
      if (refresh) await ref.refresh()
    } catch (err) {
      toast({ title: 'Could not save', description: errorText(err), tone: 'error' })
      throw err
    }
  }

  return (
    <Section
      title="Projects & unit types"
      description="Rename, add or archive. Archived items disappear from the form but stay on existing records."
    >
      <div className="space-y-4">
        {projects.map((p: Project) => (
          <div key={p.id} className="rounded-xl border border-line p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[200px] flex-1">
                <InlineName
                  label="Project name"
                  value={p.name}
                  onSave={(name) => run(() => api.saveProject({ id: p.id, name, isActive: p.isActive }))}
                />
              </div>
              <Switch
                checked={p.isActive}
                onChange={(isActive) =>
                  void run(() => api.saveProject({ id: p.id, name: p.name, isActive })).catch(() => {})
                }
                label={<span className="sr-only">Active</span>}
              />
              <HoldToConfirmButton
                size="sm"
                label="Hold to delete"
                confirmedLabel="Deleted"
                onConfirm={() => run(() => api.deleteProject(p.id), false)}
                onSettled={() => void ref.refresh()}
              />
            </div>
            <ul className="mt-3 space-y-1 border-l-2 border-gold/25 pl-4">
              {units
                .filter((u) => u.projectId === p.id)
                .map((u: UnitType) => (
                  <li key={u.id} className="flex flex-wrap items-center gap-3">
                    <div className="min-w-[160px] flex-1">
                      <InlineName
                        label="Unit type name"
                        value={u.name}
                        onSave={(name) =>
                          run(() => api.saveUnitType({ id: u.id, projectId: p.id, name, isActive: u.isActive }))
                        }
                      />
                    </div>
                    {!u.isActive && <Badge>Hidden</Badge>}
                    <Switch
                      checked={u.isActive}
                      onChange={(isActive) =>
                        void run(() => api.saveUnitType({ id: u.id, projectId: p.id, name: u.name, isActive })).catch(
                          () => {},
                        )
                      }
                      label={<span className="sr-only">Active</span>}
                    />
                    <HoldToConfirmButton
                      size="sm"
                      label="Hold to delete"
                      confirmedLabel="Deleted"
                      onConfirm={() => run(() => api.deleteUnitType(u.id), false)}
                      onSettled={() => void ref.refresh()}
                    />
                  </li>
                ))}
              <li className="pt-2">
                <AddRow
                  placeholder={`New unit type for ${p.name}`}
                  onAdd={(name) => run(() => api.saveUnitType({ projectId: p.id, name, isActive: true }))}
                />
              </li>
            </ul>
          </div>
        ))}
        <div className="rounded-xl border border-dashed border-gold/40 p-4">
          <AddRow
            placeholder="New project name"
            onAdd={(name) => run(() => api.saveProject({ name, isActive: true }))}
          />
        </div>
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/* Lead sources                                                         */
/* ------------------------------------------------------------------ */

const KIND_LABELS: Record<SourceKind, string> = {
  standard: 'Standard',
  sales_person: 'Asks for a sales person',
  other: 'Asks for details (Other)',
}

function SourcesSettings() {
  const ref = useRefData()
  const { toast } = useToast()
  const sources = ref.data?.sources ?? []

  const save = async (s: LeadSource, patch: Partial<LeadSource>) => {
    try {
      await api.saveSource({ id: s.id, name: s.name, icon: s.icon, kind: s.kind, isActive: s.isActive, ...patch })
      await ref.refresh()
    } catch (err) {
      toast({ title: 'Could not save', description: errorText(err), tone: 'error' })
      throw err
    }
  }

  return (
    <Section title="Lead sources" description="The “How did you find out about us?” options on the walk-in form.">
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {sources.map((s) => (
          <div key={s.id} className={cn('flex flex-wrap items-center gap-3 p-3 sm:p-4', !s.isActive && 'opacity-60')}>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gold/10 text-gold">
              <SourceIcon icon={s.icon} className="size-5" />
            </span>
            <div className="min-w-[160px] flex-1">
              <InlineName label="Source name" value={s.name} onSave={(name) => save(s, { name })} />
            </div>
            <select
              aria-label="Icon"
              value={s.icon}
              onChange={(e) => void save(s, { icon: e.target.value }).catch(() => {})}
              className={cn(inputClass, 'ivy-select h-9 w-auto rounded-lg pr-9 text-sm')}
            >
              {Object.entries(SOURCE_ICONS).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="Behaviour"
              value={s.kind}
              onChange={(e) => void save(s, { kind: e.target.value as SourceKind }).catch(() => {})}
              className={cn(inputClass, 'ivy-select h-9 w-auto rounded-lg pr-9 text-sm')}
            >
              {(Object.keys(KIND_LABELS) as SourceKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
            <Switch
              checked={s.isActive}
              onChange={(isActive) => void save(s, { isActive }).catch(() => {})}
              label={<span className="sr-only">Active</span>}
            />
            <HoldToConfirmButton
              size="sm"
              label="Hold to delete"
              confirmedLabel="Deleted"
              onConfirm={async () => {
                try {
                  await api.deleteSource(s.id)
                } catch (err) {
                  toast({ title: 'Could not delete', description: errorText(err), tone: 'error' })
                  throw err
                }
              }}
              onSettled={() => void ref.refresh()}
            />
          </div>
        ))}
      </div>
      <div className="mt-4">
        <AddRow
          placeholder="New source, e.g. Radio advert"
          onAdd={async (name) => {
            await api.saveSource({ name, icon: 'megaphone', kind: 'standard', isActive: true })
            await ref.refresh()
          }}
        />
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/* Notifications                                                        */
/* ------------------------------------------------------------------ */

function NotificationSettings() {
  const { isDemo } = useAuth()
  const [setup, setSetup] = useState<Awaited<ReturnType<typeof api.getNotificationSetup>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<DemoNotifyMode>(getDemoNotifyMode())

  const load = () =>
    api
      .getNotificationSetup()
      .then((s) => (setSetup(s), setError(null)))
      .catch((err) => setError(errorText(err) ?? 'Could not reach the notification function'))
  useEffect(() => {
    void load()
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const row = (icon: ReactNode, label: string, ok: boolean | undefined, provider?: string) => (
    <div className="flex items-center gap-3 p-4">
      <span className="grid size-9 place-items-center rounded-lg bg-gold/10 text-gold [&_svg]:size-5">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-fg">{label}</p>
        <p className="text-xs text-muted">{provider ?? '—'}</p>
      </div>
      {ok === undefined ? (
        <Badge>Checking…</Badge>
      ) : ok ? (
        <Badge tone="success">
          <CheckCircleIcon weight="fill" /> Configured
        </Badge>
      ) : (
        <Badge tone="warning">
          <WarningCircleIcon weight="fill" /> Pending setup
        </Badge>
      )}
    </div>
  )

  return (
    <>
      <Section
        title="Sales-person notifications"
        description="When a walk-in names a sales person, the server emails and WhatsApps them. Keys live in server environment variables, never in the browser."
      >
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {row(<EnvelopeSimpleIcon weight="duotone" />, 'Email', setup?.email, setup?.emailProvider)}
          {row(<WhatsappLogoIcon weight="duotone" />, 'WhatsApp', setup?.whatsapp, setup?.whatsappProvider)}
        </div>
        {error && <p className="mt-3 text-sm text-rose">{error}</p>}
        <p className="mt-4 text-[13px] text-muted">
          Until keys are set, walk-ins still save and notifications are marked “pending setup”. Failed sends are retried
          up to 3 times and can be resent from the walk-in’s detail drawer. See the README for the environment
          variables.
        </p>
      </Section>
      {isDemo && (
        <Section
          title="Demo: simulate delivery"
          description="Preview how each notification outcome looks on the slip and in the records drawer."
        >
          <Segmented
            ariaLabel="Simulated outcome"
            value={mode}
            onChange={(m) => {
              setDemoNotifyMode(m)
              setMode(m)
            }}
            options={[
              {
                value: 'sent',
                label: (
                  <>
                    <SparkleIcon weight="bold" /> Sent
                  </>
                ),
              },
              { value: 'pending_setup', label: 'Pending setup' },
              { value: 'failed', label: 'Failed' },
            ]}
          />
        </Section>
      )}
    </>
  )
}
