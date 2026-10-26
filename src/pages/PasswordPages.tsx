import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { KeyIcon, ShieldCheckIcon } from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthProvider'
import { IvyLogo } from '../components/IvyLogo'
import { Button } from '../components/ui/Button'
import { DynamicButton, useDynamicAction } from '../components/ui/DynamicButton'
import { Field, TextInput } from '../components/ui/Field'
import { Card } from '../components/ui/Primitives'
import { useToast } from '../components/ui/Toaster'
import { api } from '../data'
import { passwordProblem } from '../lib/password'

const errorText = (err: unknown) => (err instanceof Error ? err.message : undefined)

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <IvyLogo className="mb-4 size-16" />
          <h1 className="font-display text-2xl text-fg">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
        </div>
        {children}
      </Card>
    </main>
  )
}

/** New + confirm fields with the shared password rule. */
function useNewPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const problem = password ? passwordProblem(password) : undefined
  const mismatch = confirm.length > 0 && confirm !== password
  const valid = Boolean(password) && !problem && !mismatch && confirm === password
  const fields = (
    <>
      <Field label="New password" error={problem} hint="8+ characters, with a letter and a number.">
        {(a) => (
          <TextInput
            {...a}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>
      <Field label="Confirm new password" error={mismatch ? 'Passwords do not match' : undefined}>
        {(a) => (
          <TextInput
            {...a}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        )}
      </Field>
    </>
  )
  return { password, valid, fields }
}

/**
 * Change your own password. Mandatory (no way out except signing out) for seeded accounts and after
 * an admin reset; optional otherwise.
 */
export function ChangePasswordPage() {
  const { user, signOut, markPasswordChanged } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const action = useDynamicAction(900)
  const [current, setCurrent] = useState('')
  const next = useNewPassword()
  const forced = user?.mustChangePassword ?? false
  const sameAsOld = current.length > 0 && next.password === current

  const submit = () =>
    action
      .run(() => api.changePassword(current, next.password))
      .then(() => {
        markPasswordChanged()
        toast({ title: 'Password changed', tone: 'success' })
        window.setTimeout(() => navigate('/', { replace: true }), 600)
      })
      .catch((err) => toast({ title: 'Could not change password', description: errorText(err), tone: 'error' }))

  return (
    <Shell
      title={forced ? 'Choose your own password' : 'Change password'}
      subtitle={
        forced
          ? `Welcome${user ? `, ${user.name.split(' ')[0]}` : ''}. You signed in with a temporary password; set your own to continue.`
          : 'You will stay signed in on this device; other devices are signed out.'
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (current && next.valid && !sameAsOld) void submit()
        }}
      >
        <Field label={forced ? 'Temporary password' : 'Current password'}>
          {(a) => (
            <TextInput
              {...a}
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              data-autofocus
            />
          )}
        </Field>
        {next.fields}
        {sameAsOld && (
          <p className="text-xs font-medium text-rose">Choose a different password from the current one.</p>
        )}
        <DynamicButton
          type="submit"
          size="lg"
          className="w-full"
          disabled={!current || !next.valid || sameAsOld}
          state={action.state}
          icon={<ShieldCheckIcon weight="bold" />}
          labels={{ idle: 'Save new password', loading: 'Saving…', success: 'Saved' }}
        />
        {forced ? (
          <Button variant="ghost" className="w-full" onClick={() => signOut('manual')}>
            Sign out instead
          </Button>
        ) : (
          <Button variant="ghost" className="w-full" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        )}
      </form>
    </Shell>
  )
}

/** Landing page for the emailed reset link: /reset-password?token=… */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { toast } = useToast()
  const action = useDynamicAction()
  const token = params.get('token') ?? ''
  const next = useNewPassword()

  const submit = () =>
    action
      .run(() => api.completePasswordReset(token, next.password))
      .then(() => {
        toast({ title: 'Password updated', description: 'Sign in with your new password.', tone: 'success' })
        window.setTimeout(() => navigate('/login', { replace: true }), 800)
      })
      .catch((err) => toast({ title: 'Could not update password', description: errorText(err), tone: 'error' }))

  return (
    <Shell
      title="Choose a new password"
      subtitle={
        token
          ? 'Set a new password for your Ivy Hub account.'
          : 'This link is missing its reset token. Request a new one from the sign-in page.'
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (token && next.valid) void submit()
        }}
      >
        {next.fields}
        <DynamicButton
          type="submit"
          size="lg"
          className="w-full"
          disabled={!token || !next.valid}
          state={action.state}
          icon={<KeyIcon weight="bold" />}
          labels={{ idle: 'Update password', loading: 'Updating…', success: 'Updated' }}
        />
      </form>
    </Shell>
  )
}
