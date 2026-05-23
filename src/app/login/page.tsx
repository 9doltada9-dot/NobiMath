'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { authSignIn, authSignUp, handleAuthCallback } from '@/lib/auth'
import { fullSync } from '@/lib/sync'

type Mode = 'login' | 'signup'

// Production redirect URL — Supabase will send user back here after confirming email
const EMAIL_REDIRECT = 'https://9doltada9-dot.github.io/NobiMath/login/'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [signupPending, setSignupPending] = useState(false)
  const [callbackLoading, setCallbackLoading] = useState(false)

  // ─── Handle redirect back from confirmation email ────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hasCode = params.has('code')
    const hasToken = window.location.hash.includes('access_token')

    if (!hasCode && !hasToken) return

    setCallbackLoading(true)
    handleAuthCallback().then(async user => {
      if (user) {
        await fullSync(user.id)
        localStorage.setItem('nobi_auth_email', user.email)
        router.push('/')
      } else {
        setCallbackLoading(false)
        setError('ยืนยัน email ไม่สำเร็จ กรุณาลองใหม่')
      }
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!email.trim() || !password.trim()) {
      setError('กรุณากรอก email และรหัสผ่าน')
      return
    }
    if (password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
      return
    }
    setLoading(true)

    if (mode === 'signup') {
      const { user, error: err, needsConfirmation } = await authSignUp(email, password, EMAIL_REDIRECT)
      if (err || !user) {
        setError(err ?? 'สมัครสมาชิกไม่สำเร็จ')
        setLoading(false)
        return
      }
      if (needsConfirmation) {
        // Show "check your email" screen
        setLoading(false)
        setSignupPending(true)
        return
      }
      // Email confirmation disabled — go straight in
      await fullSync(user.id)
      localStorage.setItem('nobi_auth_email', user.email)
      router.push('/')
    } else {
      const { user, error: err } = await authSignIn(email, password)
      if (err || !user) {
        setError(err ?? 'เข้าสู่ระบบไม่สำเร็จ')
        setLoading(false)
        return
      }
      setSuccess('กำลังซิงค์ข้อมูล...')
      await fullSync(user.id)
      localStorage.setItem('nobi_auth_email', user.email)
      router.push('/')
    }
  }

  // ─── Callback loading screen ─────────────────────────────────────────────────
  if (callbackLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
        <motion.div
          className="bg-white rounded-3xl shadow-2xl p-10 text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            className="text-5xl mb-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            ⭐
          </motion.div>
          <p className="text-gray-700 font-black text-lg">กำลังยืนยันบัญชี...</p>
          <p className="text-gray-400 text-sm font-semibold mt-1">โปรดรอสักครู่</p>
        </motion.div>
      </div>
    )
  }

  // ─── Signup pending — waiting for email confirmation ─────────────────────────
  if (signupPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
        <motion.div
          className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.div
            className="text-6xl mb-4"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            📧
          </motion.div>
          <h2 className="text-xl font-black text-gray-800 mb-2">ตรวจสอบ Email!</h2>
          <p className="text-gray-500 text-sm font-semibold mb-2">ส่ง email ยืนยันไปที่</p>
          <div className="bg-violet-50 rounded-2xl px-4 py-2.5 mb-5">
            <p className="text-violet-700 font-black text-sm break-all">{email}</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 mb-6 text-left">
            <p className="text-amber-800 text-xs font-bold leading-relaxed">
              📌 ขั้นตอน:<br />
              1. เปิด inbox ของ {email}<br />
              2. กดลิงก์ <strong>"Confirm your signup"</strong><br />
              3. ระบบจะพาคุณเข้าสู่หน้าหลักอัตโนมัติ
            </p>
          </div>
          <button
            onClick={() => { setSignupPending(false); setMode('login') }}
            className="w-full bg-gradient-to-r from-violet-500 to-pink-500 text-white font-black py-3.5 rounded-2xl text-sm shadow-lg hover:opacity-90 transition-all"
          >
            🔑 ยืนยันแล้ว — ไปหน้า Login
          </button>
          <button
            onClick={() => router.push('/')}
            className="mt-3 w-full text-gray-400 text-xs font-bold py-2 hover:text-gray-600 transition-colors"
          >
            ← ใช้งานโดยไม่ login
          </button>
        </motion.div>
      </div>
    )
  }

  // ─── Normal Login / Signup form ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-5xl mb-2">🧮</div>
          <h1 className="text-white font-black text-3xl">Nobi Skill</h1>
          <p className="text-white/70 text-sm font-semibold mt-1">
            ซิงค์โปรไฟล์ข้ามอุปกรณ์
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          className="bg-white rounded-3xl shadow-2xl p-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {/* Mode tabs */}
          <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
            {(['login', 'signup'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); setSuccess(null) }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${
                  mode === m
                    ? 'bg-white text-violet-600 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {m === 'login' ? '🔑 เข้าสู่ระบบ' : '✨ สมัครสมาชิก'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-800 focus:outline-none focus:border-violet-300 transition-colors bg-gray-50"
                disabled={loading}
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 mb-1.5 uppercase tracking-wide">
                รหัสผ่าน
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-800 focus:outline-none focus:border-violet-300 transition-colors bg-gray-50"
                disabled={loading}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {/* Error / Success */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-red-600 text-sm font-bold"
                >
                  ⚠️ {error}
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="bg-green-50 border border-green-100 rounded-2xl px-4 py-3 text-green-600 text-sm font-bold"
                >
                  ✅ {success}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-500 to-pink-500 text-white font-black py-4 rounded-2xl text-sm shadow-lg hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="inline-block"
                  >
                    ⭐
                  </motion.span>
                  กำลังดำเนินการ...
                </span>
              ) : (
                mode === 'login' ? '🔑 เข้าสู่ระบบ' : '✨ สมัครสมาชิก'
              )}
            </button>
          </form>

          {/* Skip login */}
          <div className="mt-5 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-gray-400 text-xs font-bold hover:text-gray-600 transition-colors"
            >
              ← ใช้งานโดยไม่ login
            </button>
          </div>
        </motion.div>

        {/* Info */}
        <motion.p
          className="text-center text-white/50 text-xs font-semibold mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          ข้อมูลของคุณปลอดภัยและเป็นส่วนตัว
        </motion.p>

      </div>
    </div>
  )
}
