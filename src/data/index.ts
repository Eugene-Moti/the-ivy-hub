import { IS_DEMO } from '../lib/config'
import type { Api } from './api'
import { demoApi } from './demo/demoApi'
import { neonApi } from './neon/neonApi'

export const api: Api = IS_DEMO ? demoApi : neonApi
