import { IS_DEMO } from '../lib/config'
import type { Api } from './api'
import { demoApi } from './demo/demoApi'
import { supabaseApi } from './supabase/supabaseApi'

export const api: Api = IS_DEMO ? demoApi : supabaseApi
