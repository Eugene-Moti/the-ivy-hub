import {
  CalendarIcon,
  CarIcon,
  DotsThreeIcon,
  EnvelopeSimpleIcon,
  FacebookLogoIcon,
  FlagIcon,
  GlobeIcon,
  GoogleLogoIcon,
  HandshakeIcon,
  HouseLineIcon,
  InstagramLogoIcon,
  MapPinIcon,
  MegaphoneIcon,
  NewspaperIcon,
  PhoneIcon,
  RadioIcon,
  ShareNetworkIcon,
  SignpostIcon,
  TelevisionIcon,
  TentIcon,
  TiktokLogoIcon,
  UsersThreeIcon,
  WhatsappLogoIcon,
  YoutubeLogoIcon,
  type IconProps,
} from '@phosphor-icons/react'
import type { ComponentType } from 'react'

/** Icons an admin can pick for a lead source (stored by key). */
export const SOURCE_ICONS: Record<string, { label: string; Icon: ComponentType<IconProps> }> = {
  globe: { label: 'Website', Icon: GlobeIcon },
  share: { label: 'Social', Icon: ShareNetworkIcon },
  'map-pin': { label: 'Map pin', Icon: MapPinIcon },
  whatsapp: { label: 'WhatsApp', Icon: WhatsappLogoIcon },
  phone: { label: 'Phone', Icon: PhoneIcon },
  tent: { label: 'Expo', Icon: TentIcon },
  envelope: { label: 'Email', Icon: EnvelopeSimpleIcon },
  handshake: { label: 'Handshake', Icon: HandshakeIcon },
  dots: { label: 'Other', Icon: DotsThreeIcon },
  megaphone: { label: 'Megaphone', Icon: MegaphoneIcon },
  newspaper: { label: 'Newspaper', Icon: NewspaperIcon },
  signpost: { label: 'Signpost', Icon: SignpostIcon },
  flag: { label: 'Billboard', Icon: FlagIcon },
  users: { label: 'Referral', Icon: UsersThreeIcon },
  house: { label: 'Show house', Icon: HouseLineIcon },
  car: { label: 'Drive-by', Icon: CarIcon },
  calendar: { label: 'Event', Icon: CalendarIcon },
  radio: { label: 'Radio', Icon: RadioIcon },
  tv: { label: 'TV', Icon: TelevisionIcon },
  google: { label: 'Google', Icon: GoogleLogoIcon },
  facebook: { label: 'Facebook', Icon: FacebookLogoIcon },
  instagram: { label: 'Instagram', Icon: InstagramLogoIcon },
  tiktok: { label: 'TikTok', Icon: TiktokLogoIcon },
  youtube: { label: 'YouTube', Icon: YoutubeLogoIcon },
}

export function SourceIcon({
  icon,
  className,
  weight = 'duotone',
}: {
  icon: string
  className?: string
  weight?: IconProps['weight']
}) {
  const Icon = SOURCE_ICONS[icon]?.Icon ?? DotsThreeIcon
  return <Icon className={className} weight={weight} />
}
