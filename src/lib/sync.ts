/**
 * Offline-first sync: localStorage <-> Supabase
 *
 * Strategy:
 *  - localStorage is always source of truth for reads (fast, offline)
 *  - fullSync: push local → pull cloud → merge (bidirectional)
 *  - Sessions: always pull for ALL profiles (not just new ones)
 *  - Stats (lifetime, trophies, streak, skill_stats) sync via profile row
 */

import { supabase } from './supabase'
import type { Profile, SessionRecord } from './types'
import type { SkillStats } from './types'
import type { LifetimeStats } from './trophies'
import type { UnlockedMap } from './trophies'
import { emptyLifetime } from './trophies'
import { generateId, isUUID } from './uuid'

function db() { return supabase as NonNullable<typeof supabase> }
function isReady(): boolean { return supabase !== null && (supabase as unknown) !== null }

// ─── ID Migration ─────────────────────────────────────────────────────────────
// Old profiles used `local_${Date.now()}` as ID — not a valid UUID.
// Before syncing, migrate any such IDs to proper UUIDs and update all localStorage keys.

const LS_KEYS_TO_RENAME = [
  (id: string) => `nobi_history_${id}`,
  (id: string) => `nobi_life_${id}`,
  (id: string) => `nobi_trophies_${id}`,
  (id: string) => `nobi_skills_${id}`,
  (id: string) => `nobi_mastery_${id}`,
  (id: string) => `nobi_streak_${id}`,
  (id: string) => `nobi_last_practice_date_${id}`,
]

export function migrateProfileIds(): boolean {
  if (typeof window === 'undefined') return false
  const profiles: Profile[] = JSON.parse(localStorage.getItem('nobi_profiles') ?? '[]')
  const needsMigration = profiles.filter(p => !isUUID(p.id))
  if (needsMigration.length === 0) return false

  const idMap = new Map<string, string>()  // old → new
  needsMigration.forEach(p => idMap.set(p.id, generateId()))

  // Rename all localStorage keys for each migrated profile
  for (const [oldId, newId] of idMap) {
    for (const keyFn of LS_KEYS_TO_RENAME) {
      const old = keyFn(oldId)
      const nxt = keyFn(newId)
      const val = localStorage.getItem(old)
      if (val !== null) {
        localStorage.setItem(nxt, val)
        localStorage.removeItem(old)
      }
    }
  }

  // Update profile IDs in the profiles array
  const updated = profiles.map(p =>
    idMap.has(p.id) ? { ...p, id: idMap.get(p.id)! } : p
  )
  localStorage.setItem('nobi_profiles', JSON.stringify(updated))

  // Update the active profile cache
  const active = localStorage.getItem('nobi_active_profile')
  if (active && idMap.has(active)) {
    localStorage.setItem('nobi_active_profile', idMap.get(active)!)
  }
  const cached = localStorage.getItem('nobi_profile')
  if (cached) {
    try {
      const cp: Profile = JSON.parse(cached)
      if (idMap.has(cp.id)) {
        localStorage.setItem('nobi_profile', JSON.stringify({ ...cp, id: idMap.get(cp.id)! }))
      }
    } catch { /* ignore */ }
  }

  console.log(`[Sync] Migrated ${idMap.size} profile IDs to UUID format`)
  return true
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export async function pushProfile(profile: Profile, userId: string): Promise<void> {
  if (!isReady()) return
  try {
    const life  = loadLocalLifetime(profile.id)
    const troph = loadLocalTrophies(profile.id)
    const skill = loadLocalSkillStats(profile.id)
    const streak = parseInt(localStorage.getItem(`nobi_streak_${profile.id}`) ?? '0', 10)

    await db().from('profiles').upsert({
      id:             profile.id,
      user_id:        userId,
      nickname:       profile.nickname,
      age:            profile.age,
      avatar:         profile.avatar,
      level:          profile.level,
      current_level:  profile.level,
      total_exp:      profile.totalExp,
      op_levels:      profile.opLevels ?? {},
      created_at:     profile.createdAt,
      updated_at:     new Date().toISOString(),
      lifetime_stats: life,
      trophies_json:  troph,
      skill_stats:    skill,
      streak,
    })
  } catch (e) {
    console.warn('[Sync] pushProfile failed:', e)
  }
}

export async function pushAllProfiles(userId: string): Promise<void> {
  if (!isReady()) return
  try {
    const profiles: Profile[] = JSON.parse(localStorage.getItem('nobi_profiles') ?? '[]')
    if (profiles.length === 0) return

    const rows = profiles.map(p => {
      const life  = loadLocalLifetime(p.id)
      const troph = loadLocalTrophies(p.id)
      const skill = loadLocalSkillStats(p.id)
      const streak = parseInt(localStorage.getItem(`nobi_streak_${p.id}`) ?? '0', 10)
      return {
        id:             p.id,
        user_id:        userId,
        nickname:       p.nickname,
        age:            p.age,
        avatar:         p.avatar,
        level:          p.level,
        current_level:  p.level,
        total_exp:      p.totalExp,
        op_levels:      p.opLevels ?? {},
        created_at:     p.createdAt,
        updated_at:     new Date().toISOString(),
        lifetime_stats: life,
        trophies_json:  troph,
        skill_stats:    skill,
        streak,
      }
    })
    await db().from('profiles').upsert(rows)
  } catch (e) {
    console.warn('[Sync] pushAllProfiles failed:', e)
  }
}

export async function pullProfiles(userId: string): Promise<Profile[]> {
  if (!isReady()) return []
  try {
    const { data, error } = await db()
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
    if (error || !data) return []

    return data.map((d: Record<string, unknown>) => ({
      id:        d.id as string,
      nickname:  d.nickname as string,
      age:       d.age as number,
      avatar:    d.avatar as string,
      // 'level' column added by migration; fall back to current_level for old rows
      level:     (d.level as number) || (d.current_level as number) || 1,
      totalExp:  (d.total_exp as number) ?? 0,
      createdAt: d.created_at as string,
      opLevels:  (d.op_levels as Profile['opLevels']) || undefined,
      // Extra stats bundled in profile row
      _lifetimeStats: d.lifetime_stats as LifetimeStats | undefined,
      _trophies:      d.trophies_json as UnlockedMap | undefined,
      _skillStats:    d.skill_stats as SkillStats | undefined,
      _streak:        (d.streak as number) ?? 0,
    })) as Profile[]
  } catch (e) {
    console.warn('[Sync] pullProfiles failed:', e)
    return []
  }
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function pushSession(record: SessionRecord, profileId: string, userId: string): Promise<void> {
  if (!isReady()) return
  try {
    await db().from('session_records').upsert({
      id:               record.id,
      profile_id:       profileId,
      user_id:          userId,
      date:             record.date,
      op:               record.op,
      score:            record.score,
      total:            record.total,
      accuracy:         record.accuracy,
      avg_time_seconds: record.avgTimeSeconds,
      exp_gained:       record.expGained,
      level:            record.level,
    })
  } catch (e) {
    console.warn('[Sync] pushSession failed:', e)
  }
}

export async function pushAllSessions(profileId: string, userId: string): Promise<void> {
  if (!isReady()) return
  try {
    const history: SessionRecord[] = JSON.parse(
      localStorage.getItem(`nobi_history_${profileId}`) ?? '[]'
    )
    if (history.length === 0) return

    // Batch in chunks of 100 to stay under request limits
    const CHUNK = 100
    for (let i = 0; i < history.length; i += CHUNK) {
      const chunk = history.slice(i, i + CHUNK)
      await db().from('session_records').upsert(
        chunk.map(s => ({
          id:               s.id,
          profile_id:       profileId,
          user_id:          userId,
          date:             s.date,
          op:               s.op,
          score:            s.score,
          total:            s.total,
          accuracy:         s.accuracy,
          avg_time_seconds: s.avgTimeSeconds,
          exp_gained:       s.expGained,
          level:            s.level,
        }))
      )
    }
  } catch (e) {
    console.warn('[Sync] pushAllSessions failed:', e)
  }
}

/**
 * Pull sessions from cloud and merge into localStorage.
 * Returns the number of NEW sessions added.
 */
export async function pullSessions(profileId: string): Promise<number> {
  if (!isReady()) return 0
  try {
    const { data, error } = await db()
      .from('session_records')
      .select('*')
      .eq('profile_id', profileId)
      .order('date', { ascending: true })
    if (error || !data || data.length === 0) return 0

    const cloudRecords: SessionRecord[] = (data as Record<string, unknown>[]).map(d => ({
      id:             d.id as string,
      date:           d.date as string,
      op:             d.op as SessionRecord['op'],
      score:          d.score as number,
      total:          d.total as number,
      accuracy:       d.accuracy as number,
      avgTimeSeconds: d.avg_time_seconds as number,
      expGained:      d.exp_gained as number,
      level:          d.level as number,
    }))

    const local: SessionRecord[] = JSON.parse(
      localStorage.getItem(`nobi_history_${profileId}`) ?? '[]'
    )
    const localIds = new Set(local.map(s => s.id))
    const newOnes  = cloudRecords.filter(s => !localIds.has(s.id))

    if (newOnes.length > 0) {
      const merged = [...local, ...newOnes].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
      localStorage.setItem(`nobi_history_${profileId}`, JSON.stringify(merged))
    }

    return newOnes.length
  } catch (e) {
    console.warn('[Sync] pullSessions failed:', e)
    return 0
  }
}

// ─── Helpers: read local stats without circular deps ─────────────────────────

function loadLocalLifetime(profileId: string): LifetimeStats {
  try {
    const raw = localStorage.getItem(`nobi_life_${profileId}`)
    return raw ? { ...emptyLifetime(), ...JSON.parse(raw) } : emptyLifetime()
  } catch { return emptyLifetime() }
}

function loadLocalTrophies(profileId: string): UnlockedMap {
  try {
    return JSON.parse(localStorage.getItem(`nobi_trophies_${profileId}`) ?? '{}')
  } catch { return {} }
}

function loadLocalSkillStats(profileId: string): SkillStats {
  try {
    return JSON.parse(localStorage.getItem(`nobi_skills_${profileId}`) ?? '{}')
  } catch { return {} }
}

// ─── Merge helpers ────────────────────────────────────────────────────────────

/** Merge two opLevels — take the max level per operation. */
function mergeOpLevels(
  a: Partial<Record<string, number>> | undefined,
  b: Partial<Record<string, number>> | undefined,
): Partial<Record<string, number>> {
  const result: Record<string, number> = { ...(a ?? {}) }
  for (const [op, lvl] of Object.entries(b ?? {})) {
    result[op] = Math.max(result[op] ?? 1, lvl ?? 1)
  }
  return result
}

/** Merge two LifetimeStats — take the max of every counter. */
function mergeLifetime(a: LifetimeStats, b: LifetimeStats): LifetimeStats {
  const ops: Partial<Record<string, number>> = { ...(a.ops ?? {}) }
  for (const [op, count] of Object.entries(b.ops ?? {})) {
    ops[op] = Math.max(ops[op] ?? 0, count ?? 0)
  }
  return {
    sessions:    Math.max(a.sessions,    b.sessions),
    problems:    Math.max(a.problems,    b.problems),
    correct:     Math.max(a.correct,     b.correct),
    perfect:     Math.max(a.perfect,     b.perfect),
    fast:        Math.max(a.fast,        b.fast),
    bestStreak:  Math.max(a.bestStreak,  b.bestStreak),
    ops:         ops as LifetimeStats['ops'],
  }
}

// ─── Full bidirectional sync ──────────────────────────────────────────────────

export interface SyncResult {
  profilesPushed:  number
  profilesPulled:  number
  sessionsPushed:  number
  sessionsNewLocal: number  // sessions pulled from cloud that were new here
}

export async function fullSync(userId: string): Promise<SyncResult> {
  // Step 0: Migrate any old-style `local_XXXXXX` IDs to proper UUIDs
  migrateProfileIds()

  const localProfiles: Profile[] = JSON.parse(localStorage.getItem('nobi_profiles') ?? '[]')
  let sessionsNewLocal = 0

  // ── 1. Push everything local → cloud ────────────────────────────────────────
  await pushAllProfiles(userId)
  for (const p of localProfiles) {
    await pushAllSessions(p.id, userId)
  }

  // ── 2. Pull profiles from cloud ─────────────────────────────────────────────
  const cloudProfiles = await pullProfiles(userId)

  if (cloudProfiles.length > 0) {
    const merged = [...localProfiles]

    for (const cp of cloudProfiles) {
      const idx = merged.findIndex(lp => lp.id === cp.id)

      // Extra stats bundled in the cloud profile row
      const cloudLife   = (cp as Profile & { _lifetimeStats?: LifetimeStats })._lifetimeStats
      const cloudTroph  = (cp as Profile & { _trophies?: UnlockedMap })._trophies
      const cloudSkill  = (cp as Profile & { _skillStats?: SkillStats })._skillStats
      const cloudStreak = (cp as Profile & { _streak?: number })._streak ?? 0

      if (idx >= 0) {
        const local = merged[idx]
        // Merge: take the best of both worlds
        merged[idx] = {
          ...local,
          totalExp: Math.max(local.totalExp, cp.totalExp),
          level:    Math.max(local.level, cp.level),
          opLevels: mergeOpLevels(local.opLevels, cp.opLevels),
        }
        // Merge stats — take whichever is higher per field
        if (cloudLife) {
          const localLife = loadLocalLifetime(local.id)
          const best      = mergeLifetime(localLife, cloudLife)
          localStorage.setItem(`nobi_life_${local.id}`, JSON.stringify(best))
        }
        if (cloudTroph) {
          const localTroph = loadLocalTrophies(local.id)
          const bestTroph  = { ...cloudTroph, ...localTroph }  // local wins on conflict (newer)
          localStorage.setItem(`nobi_trophies_${local.id}`, JSON.stringify(bestTroph))
        }
        if (cloudSkill) {
          const localSkill = loadLocalSkillStats(local.id)
          // Merge skill stats: take max attempts for each tag
          const bestSkill: SkillStats = { ...cloudSkill }
          for (const [tag, stat] of Object.entries(localSkill)) {
            const cs = bestSkill[tag]
            if (!cs || stat.attempts > cs.attempts) bestSkill[tag] = stat
          }
          localStorage.setItem(`nobi_skills_${local.id}`, JSON.stringify(bestSkill))
        }
        const localStreak = parseInt(localStorage.getItem(`nobi_streak_${local.id}`) ?? '0', 10)
        const bestStreak  = Math.max(localStreak, cloudStreak)
        localStorage.setItem(`nobi_streak_${local.id}`, String(bestStreak))
      } else {
        // New profile from cloud — add to local
        const clean: Profile = {
          id:        cp.id,
          nickname:  cp.nickname,
          age:       cp.age,
          avatar:    cp.avatar,
          level:     cp.level,
          totalExp:  cp.totalExp,
          createdAt: cp.createdAt,
          opLevels:  cp.opLevels,
        }
        merged.push(clean)
        // Restore stats for this new profile
        if (cloudLife)   localStorage.setItem(`nobi_life_${cp.id}`,     JSON.stringify(cloudLife))
        if (cloudTroph)  localStorage.setItem(`nobi_trophies_${cp.id}`, JSON.stringify(cloudTroph))
        if (cloudSkill)  localStorage.setItem(`nobi_skills_${cp.id}`,   JSON.stringify(cloudSkill))
        if (cloudStreak) localStorage.setItem(`nobi_streak_${cp.id}`,   String(cloudStreak))
      }
    }

    // Save merged profiles
    const cleanMerged = merged.map(p => ({
      id: p.id, nickname: p.nickname, age: p.age, avatar: p.avatar,
      level: p.level, totalExp: p.totalExp, createdAt: p.createdAt,
      opLevels: p.opLevels,
    }))
    localStorage.setItem('nobi_profiles', JSON.stringify(cleanMerged))

    // ── 3. Pull sessions for ALL profiles (not just new ones) ─────────────────
    for (const cp of cloudProfiles) {
      const added = await pullSessions(cp.id)
      sessionsNewLocal += added
    }
  }

  return {
    profilesPushed:   localProfiles.length,
    profilesPulled:   cloudProfiles.length,
    sessionsPushed:   localProfiles.length,
    sessionsNewLocal,
  }
}
