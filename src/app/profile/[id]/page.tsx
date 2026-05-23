// Server component wrapper — required for generateStaticParams with static export
// All UI logic is in ProfilePageClient.tsx ('use client')
import ProfilePageClient from './ProfilePageClient'

export function generateStaticParams() {
  // Profile IDs are only known at runtime (localStorage).
  // Client-side navigation handles all routes; no pages need pre-rendering.
  return []
}

export default function ProfilePage() {
  return <ProfilePageClient />
}
