'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Check if user has a profile
    const profile = localStorage.getItem('nobi_profile')
    if (!profile) {
      router.replace('/setup')
      return
    }

    // Check if user has completed assessment
    const assessment = localStorage.getItem('nobi_assessment')
    if (!assessment) {
      router.replace('/assessment')
      return
    }

    // User has profile + assessment → go to practice
    router.replace('/practice')
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-bounce">⭐</div>
        <p className="text-white text-xl font-bold animate-pulse">กำลังโหลด Nobi Skill...</p>
      </div>
    </div>
  )
}
