import { PageHeader } from '../components/ui/Primitives'
import { UsersSettings } from './SettingsPage'

/** Who can sign in to Ivy Hub: admins add receptionists (and other admins) here. */
export function UsersPage() {
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        eyebrow="Admin"
        title="Users"
        description="Add the receptionist and other staff who sign in to Ivy Hub, change roles, reset passwords or deactivate accounts."
      />
      <UsersSettings />
    </div>
  )
}
