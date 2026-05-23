'use client'
// Redirects legacy /profile/[id] → /profile?id=[id]
import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function ProfileRedirect() {
  const router = useRouter()
  const params = useParams()
  useEffect(() => {
    const id = params?.id as string
    if (id && id !== '_') router.replace(`/profile?id=${id}`)
    else router.replace('/')
  }, [params, router])
  return null
}
