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

export async function authSignUp(
  email: string,
  password: string,
  redirectTo?: string
): Promise<{ user: AuthUser | null; error: string | null; needsConfirmation?: boolean }> {
  if (!available()) return { user: null, error: 'Supabase not configured' }
  try {
    const { data, error } = await client().auth.signUp({
      email,
      password,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    })
    if (error) return { user: null, error: error.message }
    if (!data.user) return { user: null, error: 'ไม่ได้รับข้อมูลผู้ใช้' }
    // session is null when email confirmation is required
    const needsConfirmation = !data.session
    return { user: { id: data.user.id, email: data.user.email! }, error: null, needsConfirmation }
  } catch (e: unknown) {
    return { user: null, error: String(e) }
  }
}

// Called when user lands back on /login after clicking confirmation email link
export async function handleAuthCallback(): Promise<AuthUser | null> {
  if (!available() || typeof window === 'undefined') return null
  try {
    // PKCE flow: Supabase v2 puts a `code` query param
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      const { data } = await client().auth.exchangeCodeForSession(code)
      if (data.session?.user) {
        return { id: data.session.user.id, email: data.session.user.email ?? '' }
      }
    }
    // Fallback: implicit flow (hash fragment)
    const { data } = await client().auth.getSession()
    if (data.session?.user) {
      return { id: data.session.user.id, email: data.session.user.email ?? '' }
    }
    return null
  } catch {
    return null
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
