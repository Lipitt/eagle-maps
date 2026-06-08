import type { User, Session } from '@supabase/supabase-js'
import type { Restaurant } from '@/types/restaurant'
import type { Filters } from '@/types/filters'
import { DEFAULT_FILTERS } from '@/types/filters'

export interface State {
  user: User | null
  session: Session | null
  authLoading: boolean
  restaurants: Restaurant[]
  filters: Filters
}

type Listener = (state: State) => void

let state: State = {
  user: null,
  session: null,
  authLoading: true,
  restaurants: [],
  filters: { ...DEFAULT_FILTERS },
}

const listeners = new Set<Listener>()

export function getState(): State {
  return state
}

export function setState(partial: Partial<State>): void {
  state = { ...state, ...partial }
  listeners.forEach((fn) => fn(state))
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
