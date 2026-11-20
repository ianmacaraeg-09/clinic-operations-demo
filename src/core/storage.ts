import { defaultConfig } from '../config/clinic.config.ts'
import { emptySnapshot } from './seed.ts'
import type { DataSnapshot } from './types.ts'

/**
 * The ONLY door between the app and wherever data lives.
 * Today: browser storage (falls back to memory when storage is blocked, e.g. private mode or an iframe).
 * Production: implement the same two methods against Supabase and swap `repository` below;
 * pages never touch storage directly. Keep per-service row-level security and an audit log there.
 */
export interface Repository {
  load(): DataSnapshot | null
  save(s: DataSnapshot): void
}

export function createLocalRepository(namespace: string): Repository {
  const key = `clinic-ops:v1:${namespace}`
  let memory: DataSnapshot | null = null
  return {
    load() {
      if (memory) return structuredClone(memory)
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<DataSnapshot>
          const base = emptySnapshot()
          memory = { ...base, ...parsed, counters: { ...base.counters, ...parsed.counters } }
          return structuredClone(memory)
        }
      } catch {
        /* blocked or corrupt: start fresh */
      }
      return null
    },
    save(s) {
      memory = structuredClone(s)
      try {
        localStorage.setItem(key, JSON.stringify(s))
      } catch {
        /* quota or blocked: keep working in memory */
      }
    },
  }
}

export const repository: Repository = createLocalRepository(defaultConfig.storageNamespace)
export const backendKind: 'local' | 'supabase' = 'local'
