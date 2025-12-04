import { auth, clerkClient } from "@clerk/nextjs/server"
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

/**
 * Check if user needs onboarding
 * Redirects to /welcome if:
 * - User has no organization
 * - Organization exists but onboarding is not completed
 *
 * @returns organizationId if onboarding is complete
 */
export async function requireOnboarding(): Promise<string> {
  const authResult = await auth()

  // Not authenticated - redirect to sign in
  if (!authResult.userId) {
    redirect('/sign-in')
  }

  // Get user's organizations from Clerk
  const client = await clerkClient()
  const orgMemberships = await client.users.getOrganizationMembershipList({
    userId: authResult.userId
  })

  // No organization - needs onboarding
  if (!orgMemberships.data || orgMemberships.data.length === 0) {
    redirect('/welcome')
  }

  const clerkOrgId = orgMemberships.data[0].organization.id

  // Create server-side Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Check if organization has completed onboarding in Supabase
  const { data: org, error } = await supabase
    .from('organizations')
    .select('onboarding_completed')
    .eq('id', clerkOrgId)
    .maybeSingle()

  // Organization doesn't exist in our DB or onboarding not completed
  if (!org || !org.onboarding_completed) {
    redirect('/welcome')
  }

  return clerkOrgId
}
