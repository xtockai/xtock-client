import DashboardLayout from '@/components/dashboard-layout'
import { requireOnboarding } from '@/lib/auth-utils'

export default async function LocationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check authentication and onboarding status
  // Redirects to /welcome if not completed
  await requireOnboarding()

  return <DashboardLayout>{children}</DashboardLayout>
}
