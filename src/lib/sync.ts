/**
 * Offline-first sync: localStorage <-> Supabase
 *
 * Strategy:
 *  - localStorage is always the source of truth for reads (fast, offline)
 *  - On login: pull from cloud then push local -> merge
 *  - On profile create/update: write localStorage first, then async push
 *  - On session complete: write localStorage first, then async push
 */

import { supabase } from './supabase'
import type { Profile, SessionRecord } from './types'

function db() {
  return supabase as NonNullable<typeof supabase>
}

function isReady(): boolean {
  return supabase !== null && (supabase as unknown) !== null
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export async function pushProfile(profile: Profile, userId: string): Promise<void> {
  if (!isReady()) return
  try {
    await db().from('profiles').upsert({
      id: profile.id,
      user_id: userId,
      nickname: profile.nickname,
      age: profile.age,
      avatar: profile.avatar,
      level: profile.level,
      total_exp: profile.totalExp,
      op_levels: profile.opLevels ?? {},
      created_at: profile.createdAt,
      updated_at: new Date().toISOString(),
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
    await db().from('profiles').upsert(
      profiles.map(p => ({
        id: p.id,
        user_id: userId,
        nickname: p.nickname,
        age: p.age,
        avatar: p.avatar,
        level: p.level,
        total_exp: p.totalExp,
        op_levels: p.opLevels ?? {},
        created_at: p.createdAt,
        updated_at: new Date().toISOString(),
      }))
    )
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
      id: d.id as string,
      nickname: d.nickname as string,
      age: d.age as number,
      avatar: d.avatar as string,
      level: d.level as number,
      totalExp: (d.total_exp as number) ?? 0,
      createdAt: d.created_at as string,
      opLevels: (d.op_levels as Profile['opLevels']) || undefined,
    }))
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
      id: record.id,
      profile_id: profileId,
      user_id: userId,
      date: record.date,
      op: record.op,
      score: record.score,
      total: record.total,
      accuracy: record.accuracy,
      avg_time_seconds: record.avgTimeSeconds,
      exp_gained: record.expGained,
      level: record.level,
    })
  } catch (e) {
    console.warn('[Sync] pushSession failed:', e)
  }
}

export async function pushAllSessions(profileId: string, userId: string): Promise<void> {
  if (!isReady()) return
  try {
    const history: SessionRecord[] = JSON.parse(localStorage.getItem(`nobi_history_${profileId}`) ?? '[]')
    if (history.length === 0) return
    await db().from('session_records').upsert(
      history.map(s => ({
        id: s.id,
        profile_id: profileId,
        user_id: userId,
        date: s.date,
        op: s.op,
        score: s.score,
        total: s.total,
        accuracy: s.accuracy,
        avg_time_seconds: s.avgTimeSeconds,
        exp_gained: s.expGained,
        level: s.level,
      }))
    )
  } catch (e) {
    console.warn('[Sync] pushAllSessions failed:', e)
  }
}

export async function pullSessions(profileId: string): Promise<void> {
  if (!isReady()) return
  try {
    const { data, error } = await db()
      .from('session_records')
      .select('*')
      .eq('profile_id', profileId)
      .order('date', { ascending: true })
    if (error || !data || data.length === 0) return

    const cloudRecords: SessionRecord[] = (data as Record<string, unknown>[]).map(d => ({
      id: d.id as string,
      date: d.date as string,
      op: d.op as SessionRecord['op'],
      score: d.score as number,
      total: d.total as number,
      accuracy: d.accuracy as number,
      avgTimeSeconds: d.avg_time_seconds as number,
      expGained: d.exp_gained as number,
      level: d.level as number,
    }))

    const local: SessionRecord[] = JSON.parse(localStorage.getItem(`nobi_history_${profileId}`) ?? '[]')
    const localIds = new Set(local.map(s => s.id))
    const newOnes = cloudRecords.filter(s => !localIds.has(s.id))

    if (newOnes.length > 0) {
      const merged = [...local, ...newOnes].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
      localStorage.setItem(`nobi_history_${profileId}`, JSON.stringify(merged))
    }
  } catch (e) {
    console.warn('[Sync] pullSessions failed:', e)
  }
}

// ─── Full bidirectional sync ──────────────────────────────────────────────────

export interface SyncResult {
  profilesPushed: number
  profilesPulled: number
  sessionsPushed: number
}

export async function fullSync(userId: string): Promise<SyncResult> {
  const localProfiles: Profile[] = JSON.parse(localStorage.getItem('nobi_profiles') ?? '[]')

  // 1. Push local profiles
  await pushAllProfiles(userId)

  // 2. Push session history for each local profile
  for (const p of localProfiles) {
    await pushAllSessions(p.id, userId)
  }

  // 3. Pull profiles from cloud and merge
  const cloudProfiles = await pullProfiles(userId)
  if (cloudProfiles.length > 0) {
    const merged = [...localProfiles]
    for (const cp of cloudProfiles) {
      const idx = merged.findIndex(lp => lp.id === cp.id)
      if (idx >= 0) {
        // Cloud wins if it has more EXP (more recent)
        if (cp.totalExp >= merged[idx].totalExp) merged[idx] = cp
      } else {
        merged.push(cp)
      }
    }
    localStorage.setItem('nobi_profiles', JSON.stringify(merged))

    // 4. Pull session history for any new profiles from cloud
    const localIds = new Set(localProfiles.map(p => p.id))
    for (const cp of cloudProfiles) {
      if (!localIds.has(cp.id)) {
        await pullSessions(cp.id)
      }
    }
  }

  return {
    profilesPushed: localProfiles.length,
    profilesPulled: cloudProfiles.length,
    sessionsPushed: localProfiles.length,
  }
}
