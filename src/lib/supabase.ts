import { createClient } from '@supabase/supabase-js'
import type { Profile, AssessmentResult, PracticeSession } from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

// Must check BEFORE calling createClient — supabase-js v2 throws if URL/key are empty strings
function isConfigured(): boolean {
  return Boolean(
    supabaseUrl &&
    supabaseKey &&
    !supabaseUrl.includes('your-project-id')
  )
}

// Conditionally create client to avoid crash when env vars are not set (e.g. Vercel without secrets)
export const supabase = isConfigured()
  ? createClient(supabaseUrl, supabaseKey)
  : (null as unknown as ReturnType<typeof createClient>)

export async function saveProfile(profile: Profile): Promise<void> {
  if (!isConfigured()) return
  try {
    await supabase.from('profiles').upsert({
      id: profile.id,
      nickname: profile.nickname,
      age: profile.age,
      avatar: profile.avatar,
      level: profile.level,
      total_exp: profile.totalExp,
      created_at: profile.createdAt,
    })
  } catch (e) {
    console.warn('[Supabase] saveProfile failed:', e)
  }
}

export async function getProfile(id: string): Promise<Profile | null> {
  if (!isConfigured()) return null
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !data) return null
    return {
      id: data.id,
      nickname: data.nickname,
      age: data.age,
      avatar: data.avatar,
      level: data.level,
      totalExp: data.total_exp ?? 0,
      createdAt: data.created_at,
    }
  } catch (e) {
    console.warn('[Supabase] getProfile failed:', e)
    return null
  }
}

export async function saveAssessmentResult(result: AssessmentResult): Promise<void> {
  if (!isConfigured()) return
  try {
    await supabase.from('assessment_results').upsert({
      profile_id: result.profileId,
      determined_level: result.determinedLevel,
      accuracy: result.accuracy,
      avg_time_seconds: result.avgTimeSeconds,
      total_questions: result.totalQuestions,
      answers: result.answers,
      completed_at: result.completedAt,
    })
  } catch (e) {
    console.warn('[Supabase] saveAssessmentResult failed:', e)
  }
}

export async function savePracticeSession(session: PracticeSession): Promise<void> {
  if (!isConfigured()) return
  try {
    await supabase.from('practice_sessions').upsert({
      id: session.id,
      profile_id: session.profileId,
      scheduled_date: session.scheduledDate,
      level: session.level,
      problems: session.problems,
      submitted_answers: session.submittedAnswers ?? null,
      score: session.score ?? null,
      accuracy: session.accuracy ?? null,
      avg_time_seconds: session.avgTimeSeconds ?? null,
      status: session.status,
      created_at: session.createdAt,
      completed_at: session.completedAt ?? null,
    })
  } catch (e) {
    console.warn('[Supabase] savePracticeSession failed:', e)
  }
}
