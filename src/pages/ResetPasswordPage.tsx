import { useState } from 'react'
import { useNavigate } from 'react-router'
import { KeyIcon } from '@phosphor-icons/react'
import { z } from 'zod'
import { IvyLogo } from '../components/IvyLogo'
import { DynamicButton, useDynamicAction } from '../components/ui/DynamicButton'
import { Field, TextInput } from '../components/ui/Field'
import { Card } from '../components/ui/Primitives'
import { useToast } from '../components/ui/Toaster'
import { supabase } from '../data/supabase/supabaseApi'
import { IS_DEMO } from '../lib/config'

const rule = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Za-z]/, 'Include a letter')
  .regex(/\d/, 'Include a number')

/** Landing page for the password-reset email (admins). Supabase signs the user in from the link. */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const action = useDynamicAction()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const check = rule.safeParse(password)
  const mismatch = confirm.length > 0 && confirm !== password

  const submit = () =>
    action
      .run(async () => {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw new Error(error.message)
        await supabase.auth.signOut({ scope: 'local' })
      })
      .then(() => {
        toast({ title: 'Password updated', description: 'Sign in with your new password.', tone: 'success' })
        window.setTimeout(() => navigate('/login', { replace: true }), 800)
      })
      .catch((err) =>
        toast({
          title: 'Could not update password',
          description: err instanceof Error ? err.message : undefined,
          tone: 'error',
        }),
      )

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <IvyLogo className="mb-4 size-16" />
          <h1 className="font-display text-2xl text-fg">Choose a new password</h1>
          {IS_DEMO && (
            <p className="mt-2 text-sm text-muted">
              Password-reset links only work once the Supabase backend is connected.
            </p>
          )}
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (check.success && !mismatch && confirm) void submit()
          }}
        >
          <Field label="New password" error={password && !check.success ? check.error.issues[0].message : undefined}>
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
          <Field label="Confirm password" error={mismatch ? 'Passwords do not match' : undefined}>
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
          <DynamicButton
            type="submit"
            size="lg"
            className="w-full"
            disabled={IS_DEMO || !check.success || mismatch || !confirm}
            state={action.state}
            icon={<KeyIcon weight="bold" />}
            labels={{ idle: 'Update password', loading: 'Updating…', success: 'Updated' }}
          />
        </form>
      </Card>
    </main>
  )
}
