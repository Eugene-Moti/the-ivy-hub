import { DEFAULT_COMPANY_NAME } from '../../lib/config'
import { addDays, compactDate, eatDayStart, todayKey, weekdayOf } from '../../lib/time'
import type {
  ActivityEntry,
  AppSettings,
  LeadSource,
  Profile,
  Project,
  TeamMember,
  UnitType,
  WalkIn,
  WalkInNotification,
} from '../types'

export interface DemoUser extends Profile {
  password: string
}

export interface DemoDb {
  version: number
  users: DemoUser[]
  projects: (Project & { deletedAt: string | null })[]
  unitTypes: (UnitType & { deletedAt: string | null })[]
  sources: (LeadSource & { deletedAt: string | null })[]
  team: TeamMember[]
  settings: AppSettings
  walkIns: WalkIn[]
  notifications: WalkInNotification[]
  activity: ActivityEntry[]
}

export const DEMO_DB_VERSION = 4

/** "Tap to fill" buttons on the login card (demo mode only). */
export const DEMO_LOGINS = [
  { title: 'Marketing Lead', username: 'admin', password: 'IvyAdmin#2026' },
  { title: 'Receptionist', username: 'reception', password: 'IvyDesk#2026' },
]

export const DEFAULT_SETTINGS: AppSettings = {
  companyName: DEFAULT_COMPANY_NAME,
  editWindowHours: 24,
  receptionistCanExport: false,
  workingDays: [1, 2, 3, 4, 5, 6],
  openTime: '09:00',
  closeTime: '17:30',
}

// Small deterministic PRNG so the demo data looks the same on every machine.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function weighted<T>(rand: () => number, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0)
  let r = rand() * total
  for (const [item, w] of items) {
    r -= w
    if (r <= 0) return item
  }
  return items[items.length - 1][0]
}

const FIRST = [
  'Achieng',
  'Brian',
  'Cynthia',
  'Dennis',
  'Esther',
  'Felix',
  'Gladys',
  'Hassan',
  'Irene',
  'James',
  'Joy',
  'Kelvin',
  'Lucy',
  'Mohamed',
  'Naomi',
  'Oscar',
  'Purity',
  'Peter',
  'Ruth',
  'Stephen',
  'Tabitha',
  'Victor',
  'Wanjiku',
  'Yusuf',
  'Zawadi',
  'Amina',
  'Collins',
  'Diana',
  'Edwin',
  'Faith',
  'George',
  'Halima',
  'Ian',
  'Janet',
  'Kevin',
  'Linda',
]
const LAST = [
  'Odhiambo',
  'Kamau',
  'Wanjiru',
  'Mutua',
  'Otieno',
  'Njoroge',
  'Chebet',
  'Kiprono',
  'Omondi',
  'Mwangi',
  'Achieng',
  'Kariuki',
  'Wafula',
  'Nyambura',
  'Ali',
  'Ndungu',
  'Kilonzo',
  'Barasa',
  'Muthoni',
  'Rotich',
  'Owino',
  'Gitau',
]
const NOTES = [
  'Wants a site visit on Saturday.',
  'Asked about payment plans.',
  'Comparing with another developer.',
  'Interested in a corner unit.',
  'Will come back with spouse.',
  'Asked about title deed timelines.',
  'Prefers ground floor.',
  'Diaspora buyer, visiting family.',
]

export function createSeed(): DemoDb {
  const rand = mulberry32(20261026)
  const now = new Date()
  const iso = (d: Date) => d.toISOString()
  const created = iso(new Date(now.getTime() - 120 * 86400_000))

  const users: DemoUser[] = [
    {
      id: 'u-admin',
      name: 'Grace Wanjiru',
      email: 'admin@ivyhub.demo',
      username: 'admin',
      role: 'admin',
      title: 'Marketing Lead',
      isActive: true,
      mustChangePassword: false,
      createdAt: created,
      password: 'IvyAdmin#2026',
    },
    {
      id: 'u-reception',
      name: 'Mercy Achieng',
      email: 'reception@ivyhub.demo',
      username: 'reception',
      role: 'receptionist',
      title: 'Receptionist',
      isActive: true,
      mustChangePassword: false,
      createdAt: created,
      password: 'IvyDesk#2026',
    },
  ]

  const projects = [
    { id: 'p-gardens', name: 'Ivy Gardens', isActive: true, sortOrder: 1, deletedAt: null },
    { id: 'p-heights', name: 'Ivy Heights', isActive: true, sortOrder: 2, deletedAt: null },
    { id: 'p-ridge', name: 'Ivy Ridge Plots', isActive: true, sortOrder: 3, deletedAt: null },
  ]
  const ut = (id: string, projectId: string, name: string, sortOrder: number) => ({
    id,
    projectId,
    name,
    isActive: true,
    sortOrder,
    deletedAt: null,
  })
  const unitTypes = [
    ut('ut-g-studio', 'p-gardens', 'Studio', 1),
    ut('ut-g-1br', 'p-gardens', '1 Bedroom', 2),
    ut('ut-g-2br', 'p-gardens', '2 Bedroom', 3),
    ut('ut-g-3br', 'p-gardens', '3 Bedroom', 4),
    ut('ut-h-2br', 'p-heights', '2 Bedroom', 1),
    ut('ut-h-3br', 'p-heights', '3 Bedroom', 2),
    ut('ut-h-mais', 'p-heights', 'Maisonette', 3),
    ut('ut-r-eighth', 'p-ridge', '1/8 Acre Plot', 1),
    ut('ut-r-quarter', 'p-ridge', '1/4 Acre Plot', 2),
  ]

  const src = (id: string, name: string, icon: string, sortOrder: number, kind: LeadSource['kind'] = 'standard') => ({
    id,
    name,
    icon,
    kind,
    isActive: true,
    sortOrder,
    deletedAt: null,
  })
  const sources = [
    src('s-website', 'Website', 'globe', 1),
    src('s-social', 'Social Media', 'share', 2),
    src('s-google', 'Google Business Profile', 'map-pin', 3),
    src('s-whatsapp', 'WhatsApp Broadcast', 'whatsapp', 4),
    src('s-phone', 'Phone Call', 'phone', 5),
    src('s-expo', 'Expo', 'tent', 6),
    src('s-email', 'Promotional Email', 'envelope', 7),
    src('s-sales', 'Sales Person', 'handshake', 8, 'sales_person'),
    src('s-other', 'Other', 'dots', 9, 'other'),
  ]

  const member = (
    id: string,
    fullName: string,
    n: number,
    title: string,
    branch: string,
    isSalesPerson: boolean,
  ): TeamMember => ({
    id,
    fullName,
    phone: `+2547000001${String(n).padStart(2, '0')}`,
    whatsapp: `+2547000001${String(n).padStart(2, '0')}`,
    email: `${fullName.split(' ')[0].toLowerCase()}@ivygroup.demo`,
    title,
    branch,
    isSalesPerson,
    isActive: true,
    createdBy: 'u-admin',
    createdAt: created,
  })
  const team = [
    member('sp-brian', 'Brian Otieno', 1, 'Sales Executive', 'Westlands', true),
    member('sp-faith', 'Faith Njeri', 2, 'Sales Executive', 'Westlands', true),
    member('sp-kevin', 'Kevin Mutua', 3, 'Sales Executive', 'Kilimani', true),
    member('sp-lilian', 'Lilian Chebet', 4, 'Senior Sales Executive', 'Kilimani', true),
    member('sp-samuel', 'Samuel Kiprono', 5, 'Diaspora Sales', 'Diaspora desk', true),
    member('tm-daniel', 'Daniel Mwangi', 6, 'Chief Executive Officer', 'Head office', false),
    member('tm-agnes', 'Agnes Wambui', 7, 'Accounts', 'Head office', false),
    member('tm-peter', 'Peter Kamau', 8, 'Operations Manager', 'Head office', false),
  ]
  const ORGS = [
    'KCB Bank',
    'G4S Courier',
    'Fine Interiors Ltd',
    'Safaricom Business',
    'Apex Surveyors',
    'County Government',
  ]
  const PURPOSES: Record<string, string[]> = {
    meeting: [
      'Partnership discussion',
      'Bank financing meeting',
      'Contractor progress review',
      'Legal documents signing',
    ],
    delivery: ['Documents delivery', 'Office supplies', 'Signed contracts pick-up'],
    interview: ['Sales Executive interview', 'Accounts Assistant interview'],
    other: ['Collecting a cheque', 'Site survey appointment', 'Personal visit'],
  }

  // ~11 weeks of walk-ins inside office hours (Mon–Sat, 09:00–17:30).
  const walkIns: WalkIn[] = []
  const notifications: WalkInNotification[] = []
  const activity: ActivityEntry[] = []
  const visitors: { name: string; phone: string; email: string | null }[] = []
  const today = todayKey()
  const sourceWeights: [string, number][] = [
    ['s-website', 14],
    ['s-social', 22],
    ['s-google', 10],
    ['s-whatsapp', 8],
    ['s-phone', 7],
    ['s-expo', 5],
    ['s-email', 4],
    ['s-sales', 24],
    ['s-other', 6],
  ]
  const hourWeights: [number, number][] = [
    [9, 4],
    [10, 9],
    [11, 12],
    [12, 9],
    [13, 6],
    [14, 9],
    [15, 10],
    [16, 7],
    [17, 2],
  ]

  for (let offset = -77; offset <= 0; offset++) {
    const day = addDays(today, offset)
    const weekday = weekdayOf(day)
    if (weekday === 7) continue
    const base = weekday === 6 ? 9 : weekday === 1 ? 4 : 6
    const trend = 1 + (offset + 77) / 160
    let count = Math.max(1, Math.round((base + (rand() - 0.5) * 5) * trend))
    const dayStart = eatDayStart(day).getTime()
    const times: number[] = []
    for (let i = 0; i < count; i++) {
      const hour = weighted(rand, hourWeights)
      const minute = Math.floor(rand() * (hour === 17 ? 30 : 60))
      const t = dayStart + (hour * 60 + minute) * 60_000 + Math.floor(rand() * 59_000)
      if (t < now.getTime() - 5 * 60_000) times.push(t)
    }
    times.sort((a, b) => a - b)
    count = times.length

    times.forEach((t, i) => {
      // About one in six visitors is not a client: meetings, deliveries, interviews…
      const visitType =
        rand() < 0.16
          ? weighted<WalkIn['visitType']>(rand, [
              ['meeting', 50],
              ['delivery', 25],
              ['interview', 15],
              ['other', 10],
            ])
          : 'client'
      const isClient = visitType === 'client'
      const returning = visitors.length > 20 && rand() < 0.09
      const visitor = returning
        ? visitors[Math.floor(rand() * visitors.length)]
        : (() => {
            const first = FIRST[Math.floor(rand() * FIRST.length)]
            const last = LAST[Math.floor(rand() * LAST.length)]
            const v = {
              name: `${first} ${last}`,
              phone: `+2547${String(Math.floor(rand() * 1e8)).padStart(8, '0')}`,
              email: rand() < 0.6 ? `${first}.${last}${Math.floor(rand() * 90 + 10)}@example.com`.toLowerCase() : null,
            }
            visitors.push(v)
            return v
          })()
      const projectId = weighted(rand, [
        ['p-gardens', 45],
        ['p-heights', 32],
        ['p-ridge', 23],
      ])
      const options = unitTypes.filter((u) => u.projectId === projectId)
      const unit = options[Math.floor(rand() * options.length)]
      const sourceId = isClient ? weighted(rand, sourceWeights) : null
      const hostId = isClient
        ? null
        : visitType === 'interview'
          ? 'tm-peter'
          : weighted(rand, [
              ['tm-daniel', 35],
              ['tm-agnes', 25],
              ['tm-peter', 20],
              ['sp-lilian', 10],
              ['sp-brian', 10],
            ])
      const salesPersonId =
        sourceId === 's-sales'
          ? weighted(rand, [
              ['sp-brian', 30],
              ['sp-faith', 26],
              ['sp-kevin', 18],
              ['sp-lilian', 16],
              ['sp-samuel', 10],
            ])
          : null
      const at = iso(new Date(t))
      const createdBy = rand() < 0.88 ? users[1] : users[0]
      const id = `w-${day}-${i}`
      walkIns.push({
        id,
        reference: `IVY-${compactDate(at)}-${String(i + 1).padStart(3, '0')}`,
        visitedAt: at,
        fullName: visitor.name,
        phone: visitor.phone,
        email: visitor.email,
        visitType,
        projectId: isClient ? projectId : null,
        unitTypeId: isClient ? unit.id : null,
        sourceId,
        salesPersonId,
        hostId,
        hostName: null,
        organisation:
          !isClient && visitType !== 'interview' && rand() < 0.75 ? ORGS[Math.floor(rand() * ORGS.length)] : null,
        purpose: isClient ? null : PURPOSES[visitType][Math.floor(rand() * PURPOSES[visitType].length)],
        otherSourceText:
          sourceId === 's-other'
            ? weighted(rand, [
                ['Billboard', 3],
                ['Drove past the site', 4],
                ['Friend referral', 5],
              ])
            : null,
        notes: isClient && rand() < 0.35 ? NOTES[Math.floor(rand() * NOTES.length)] : null,
        consent: true,
        isReturning: returning,
        createdBy: createdBy.id,
        createdByName: createdBy.name,
        createdAt: at,
        updatedAt: at,
        deletedAt: null,
        deleteReason: null,
      })
      const recipientId = salesPersonId ?? hostId
      if (recipientId) {
        for (const channel of ['email', 'whatsapp'] as const) {
          notifications.push({
            id: `n-${id}-${channel}`,
            walkInId: id,
            recipientId,
            channel,
            status: 'sent',
            error: null,
            attempts: 1,
            sentAt: iso(new Date(t + 4000)),
            createdAt: at,
          })
        }
      }
      if (offset >= -6) {
        activity.push({
          id: `a-${id}`,
          userId: createdBy.id,
          userName: createdBy.name,
          action: 'walk_in_created',
          entity: 'walk_in',
          entityId: id,
          oldValues: null,
          newValues: { full_name: visitor.name, reference: `IVY-${compactDate(at)}-${String(i + 1).padStart(3, '0')}` },
          createdAt: at,
        })
      }
    })
    if (offset >= -6 && times.length) {
      activity.push({
        id: `a-login-${day}`,
        userId: 'u-reception',
        userName: 'Mercy Achieng',
        action: 'login',
        entity: 'session',
        entityId: null,
        oldValues: null,
        newValues: null,
        createdAt: iso(new Date(dayStart + (8 * 60 + 55) * 60_000)),
      })
    }
  }

  activity.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return {
    version: DEMO_DB_VERSION,
    users,
    projects,
    unitTypes,
    sources,
    team,
    settings: { ...DEFAULT_SETTINGS },
    walkIns,
    notifications,
    activity,
  }
}
