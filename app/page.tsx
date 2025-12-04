import DashboardLayout from '@/components/dashboard-layout'
import ReportsContent from '@/components/reports-content'
import { requireOnboarding } from '@/lib/auth-utils'

export default async function Home() {
  // Check authentication and onboarding status
  // Redirects to /welcome if not completed
  await requireOnboarding()

  return (
    <DashboardLayout>
      <ReportsContent />
    </DashboardLayout>
  )
}
