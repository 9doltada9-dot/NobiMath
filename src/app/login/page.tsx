'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { authSignIn, authSignUp } from '@/lib/auth'
import { fullSync } from '@/lib/sync'

type Mode = 'login' | 'signup'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
      const { user, error: err } = await authSignUp(email, password)
      if (err || !user) {
        setError(err ?? 'สมัครสมาชิกไม่สำเร็จ')
        setLoading(false)
        return
      }
      setSuccess('สร้างบัญชีสำเร็จ! กำลังซิงค์ข้อมูล...')
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
          className="bg-white rounded-3xl shadow-2xl overflow-hidden"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {/* Tab toggle */}
          <div className="flex border-b border-gray-100">
            {(['login', 'signup'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); setSuccess(null) }}
                className={`flex-1 py-3.5 text-sm font-black transition-colors ${
                  mode === m
                    ? 'text-violet-700 border-b-2 border-violet-500'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {m === 'login' ? '🔑 เข้าสู่ระบบ' : '✨ สมัครสมาชิก'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1.5">อีเมล</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="parent@email.com"
                className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:border-violet-400 transition-colors"
                autoComplete="email"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-black text-gray-500 mb-1.5">รหัสผ่าน</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:border-violet-400 transition-colors"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                disabled={loading}
              />
            </div>

            {/* Error / Success */}
            <AnimatePresence>
              {error && (
                <motion.div
                  className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-xs font-bold text-red-600"
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                >
                  ❌ {error}
                </motion.div>
              )}
              {success && (
                <motion.div
                  className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-xs font-bold text-green-700"
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                >
                  ✅ {success}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-500 to-pink-500 text-white font-black py-3.5 rounded-2xl text-sm shadow-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
            >
              {loading
                ? '⏳ กำลังดำเนินการ...'
                : mode === 'login' ? '🚀 เข้าสู่ระบบ' : '🎉 สร้างบัญชี'}
            </button>

            {/* Note */}
            <p className="text-center text-[11px] text-gray-400 font-semibold leading-relaxed">
              {mode === 'login'
                ? 'ข้อมูลบนเครื่องจะถูกซิงค์ขึ้น Cloud อัตโนมัติ'
                : 'บัญชีสำหรับผู้ปกครอง · ข้ามอุปกรณ์ได้'}
            </p>
          </form>
        </motion.div>

        {/* Skip */}
        <motion.button
          onClick={() => router.push('/')}
          className="w-full mt-4 text-white/60 text-xs font-bold py-2 hover:text-white/90 transition-colors"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        >
          ← ใช้ต่อโดยไม่ login (ข้อมูลเก็บในเครื่อง)
        </motion.button>

      </div>
    </div>
  )
}
