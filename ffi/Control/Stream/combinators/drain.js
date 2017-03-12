import { defaultScheduler } from '../scheduler'
import { runEffects } from '../runEffects'

export const drain = stream => () => runEffects(stream, defaultScheduler)
