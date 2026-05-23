// Server component wrapper — required for generateStaticParams with static export
// All UI logic is in ProfilePageClient.tsx ('use client')
import ProfilePageClient from './ProfilePageClient'

export function generateStaticParams() {
  // Static export requires at least 1 entry.
  // Actual profile IDs are loaded client-side from localStorage.
  // All navigation is client-side (router.push), so this placeholder is never used directly.
  return [{ id: '_' }]
}

export default function ProfilePage() {
  return <ProfilePageClient />
}
