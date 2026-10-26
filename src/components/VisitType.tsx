import {
  BriefcaseIcon,
  DotsThreeIcon,
  HandshakeIcon,
  HouseLineIcon,
  PackageIcon,
  type IconProps,
} from '@phosphor-icons/react'
import type { ComponentType } from 'react'
import type { VisitType } from '../data/types'

export const VISIT_TYPES: { value: VisitType; label: string; short: string; Icon: ComponentType<IconProps> }[] = [
  { value: 'client', label: 'Client – property enquiry', short: 'Client', Icon: HouseLineIcon },
  { value: 'meeting', label: 'Meeting / visiting staff', short: 'Meeting', Icon: HandshakeIcon },
  { value: 'delivery', label: 'Delivery / courier', short: 'Delivery', Icon: PackageIcon },
  { value: 'interview', label: 'Job interview', short: 'Interview', Icon: BriefcaseIcon },
  { value: 'other', label: 'Other visit', short: 'Other', Icon: DotsThreeIcon },
]

export const visitTypeLabel = (t: VisitType) => VISIT_TYPES.find((v) => v.value === t)?.short ?? t

export function VisitTypeIcon({
  type,
  className,
  weight = 'duotone',
}: {
  type: VisitType
  className?: string
  weight?: IconProps['weight']
}) {
  const Icon = VISIT_TYPES.find((v) => v.value === type)?.Icon ?? DotsThreeIcon
  return <Icon className={className} weight={weight} />
}
