// Server wrapper — generateStaticParams requires a server component
// Redirect logic is in ProfileRedirect (client component)
import ProfileRedirect from './ProfileRedirect'

export function generateStaticParams() {
  return [{ id: '_' }]
}

export default function ProfilePageLegacy() {
  return <ProfileRedirect />
}
