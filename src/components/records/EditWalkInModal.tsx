import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useAuth } from '../../auth/AuthProvider'
import { api } from '../../data'
import { useRefData } from '../../data/RefDataProvider'
import type { WalkIn } from '../../data/types'
import { formatPhone } from '../../lib/phone'
import { zodResolver } from '../../lib/zodResolver'
import { Button } from '../ui/Button'
import { DynamicButton, useDynamicAction } from '../ui/DynamicButton'
import { Modal } from '../ui/Overlay'
import { useToast } from '../ui/Toaster'
import { toWalkInFields, walkInSchema, WalkInFields, type WalkInFormValues } from '../walkin/WalkInFields'

export function EditWalkInModal({
  walkIn,
  onClose,
  onSaved,
}: {
  walkIn: WalkIn | null
  onClose: () => void
  onSaved: (w: WalkIn) => void
}) {
  const { user } = useAuth()
  const ref = useRefData()
  const sources = useMemo(() => ref.data?.sources ?? [], [ref.data?.sources])
  const schema = useMemo(() => walkInSchema(sources, false), [sources])
  const form = useForm<WalkInFormValues>({ resolver: zodResolver(schema) })
  const action = useDynamicAction(1000)
  const { toast } = useToast()

  useEffect(() => {
    if (!walkIn) return
    form.reset({
      fullName: walkIn.fullName,
      phone: formatPhone(walkIn.phone),
      email: walkIn.email ?? '',
      projectId: walkIn.projectId,
      unitTypeId: walkIn.unitTypeId,
      sourceId: walkIn.sourceId,
      salesPersonId: walkIn.salesPersonId ?? '',
      otherSourceText: walkIn.otherSourceText ?? '',
      notes: walkIn.notes ?? '',
      consent: walkIn.consent,
    })
  }, [walkIn, form])

  const onSubmit = async (v: WalkInFormValues) => {
    if (!walkIn) return
    try {
      const updated = await action.run(() => api.updateWalkIn(walkIn.id, toWalkInFields(v, sources)))
      onSaved(updated)
      toast({ title: 'Changes saved', tone: 'success' })
      window.setTimeout(onClose, 500)
    } catch (err) {
      toast({
        title: 'Could not save changes',
        description: err instanceof Error ? err.message : undefined,
        tone: 'error',
      })
    }
  }

  return (
    <Modal
      open={Boolean(walkIn)}
      onClose={onClose}
      title="Edit walk-in"
      description={
        user?.role === 'admin'
          ? 'Every change is recorded in the activity log.'
          : `You can correct your own records for ${ref.settings.editWindowHours} hours after saving.`
      }
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <DynamicButton
            type="submit"
            form="edit-walk-in"
            state={action.state}
            labels={{ idle: 'Save changes', loading: 'Saving…', success: 'Saved' }}
          />
        </>
      }
    >
      {walkIn && (
        <form id="edit-walk-in" noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <WalkInFields form={form} includeInactiveSalesPersonId={walkIn.salesPersonId} compact />
        </form>
      )}
    </Modal>
  )
}
