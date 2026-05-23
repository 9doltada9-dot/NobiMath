import { supabase } from './supabase'

export interface AuthUser {
  id: string
  email: string
}

function client() {
  return supabase as NonNullable<typeof supabase>
}

function available(): boolean {
  return supabase !== null && (supabase as unknown) !== null
}

export async function authSignUp(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
  if (!available()) return { user: null, error: 'Supabase not configured' }
  try {
    const { data, error } = await client().auth.signUp({ email, password })
    if (error) return { user: null, error: error.message }
    if (!data.user) return { user: null, error: 'ไม่ได้รับข้อมูลผู้ใช้' }
    return { user: { id: data.user.id, email: data.user.email! }, error: null }
  } catch (e: unknown) {
    return { user: null, error: String(e) }
  }
}

export async function authSignIn(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
  if (!available()) return { user: null, error: 'Supabase not configured' }
  try {
    const { data, error } = await client().auth.signInWithPassword({ email, password })
    if (error) return { user: null, error: error.message }
    if (!data.user) return { user: null, error: 'เข้าสู่ระบบไม่สำเร็จ' }
    return { user: { id: data.user.id, email: data.user.email! }, error: null }
  } catch (e: unknown) {
    return { user: null, error: String(e) }
  }
}

export async function authSignOut(): Promise<void> {
  if (!available()) return
  await client().auth.signOut()
}

export async function getAuthUser(): Promise<AuthUser | null> {
  if (!available()) return null
  try {
    const { data } = await client().auth.getUser()
    if (!data.user) return null
    return { id: data.user.id, email: data.user.email ?? '' }
  } catch {
    return null
  }
}
