import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { readJSON, writeJSON } from '../lib/storage'
import { api } from '.'
import { DEFAULT_SETTINGS } from './demo/seed'
import type { AppSettings, LeadSource, Project, ReferenceData, SalesPerson, UnitType } from './types'

// Dropdown lists (projects, unit types, sources, sales persons) + app settings.
// Cached locally so the walk-in form keeps working offline.

const CACHE_KEY = 'ivy.refdata'

interface RefDataValue {
  data: ReferenceData | null
  settings: AppSettings
  loading: boolean
  /** True when showing the cached copy because the backend could not be reached. */
  fromCache: boolean
  refresh: () => Promise<void>
  /** Adds a sales person created offline so it can be selected before it syncs. */
  addLocalSalesPerson: (person: SalesPerson) => void
  project: (id: string | null | undefined) => Project | undefined
  unitType: (id: string | null | undefined) => UnitType | undefined
  source: (id: string | null | undefined) => LeadSource | undefined
  salesPerson: (id: string | null | undefined) => SalesPerson | undefined
}

const RefDataContext = createContext<RefDataValue | null>(null)

export function RefDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [data, setData] = useState<ReferenceData | null>(() => readJSON<ReferenceData>(CACHE_KEY))
  const [loading, setLoading] = useState(false)
  const [fromCache, setFromCache] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const fresh = await api.getReferenceData()
      setData((prev) => {
        // Keep offline-created sales persons that have not synced yet.
        const unsynced = (prev?.salesPersons ?? []).filter(
          (p) => p.createdAt.startsWith('local:') && !fresh.salesPersons.some((f) => f.id === p.id),
        )
        const next = { ...fresh, salesPersons: [...fresh.salesPersons, ...unsynced] }
        writeJSON(CACHE_KEY, next)
        return next
      })
      setFromCache(false)
    } catch {
      setFromCache(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) void refresh()
  }, [user, refresh])

  useEffect(() => {
    const onOnline = () => user && void refresh()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [user, refresh])

  const addLocalSalesPerson = useCallback((person: SalesPerson) => {
    setData((prev) => {
      if (!prev) return prev
      const next = { ...prev, salesPersons: [...prev.salesPersons.filter((p) => p.id !== person.id), person] }
      writeJSON(CACHE_KEY, next)
      return next
    })
  }, [])

  const value = useMemo<RefDataValue>(() => {
    const byId = <T extends { id: string }>(list: T[] | undefined) => {
      const map = new Map((list ?? []).map((x) => [x.id, x]))
      return (id: string | null | undefined) => (id ? map.get(id) : undefined)
    }
    return {
      data,
      settings: data?.settings ?? DEFAULT_SETTINGS,
      loading,
      fromCache,
      refresh,
      addLocalSalesPerson,
      project: byId(data?.projects),
      unitType: byId(data?.unitTypes),
      source: byId(data?.sources),
      salesPerson: byId(data?.salesPersons),
    }
  }, [data, loading, fromCache, refresh, addLocalSalesPerson])

  return <RefDataContext.Provider value={value}>{children}</RefDataContext.Provider>
}

export function useRefData() {
  const ctx = useContext(RefDataContext)
  if (!ctx) throw new Error('useRefData must be used inside RefDataProvider')
  return ctx
}
