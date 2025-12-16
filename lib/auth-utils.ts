import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

/**
 * Check if user needs onboarding
 * Redirects to /welcome if:
 * - User has no organization
 * - Organization exists but onboarding is not completed
 *
 * @returns organizationId if onboarding is complete
 */
export async function requireOnboarding(): Promise<string> {
  const authResult = await auth();

  // Not authenticated - redirect to sign in
  if (!authResult.userId) {
    console.log("No user ID, redirecting to sign-in");
    redirect("/sign-in");
  }

  console.log("User ID:", authResult.userId);

  // Get user's organizations from Clerk
  const client = await clerkClient();
  const orgMemberships = await client.users.getOrganizationMembershipList({
    userId: authResult.userId,
  });

  console.log("Organization memberships:", orgMemberships.data?.length || 0);
  console.log(
    "Organizations:",
    orgMemberships.data?.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
    }))
  );

  // No organization - needs onboarding
  if (!orgMemberships.data || orgMemberships.data.length === 0) {
    console.log("No organizations found, redirecting to welcome");
    redirect("/welcome");
  }

  const clerkOrgId = orgMemberships.data[0].organization.id;
  console.log("Using organization ID:", clerkOrgId);

  // Create server-side Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Check if organization has completed onboarding in Supabase
  const { data: org, error } = await supabase
    .from("organizations")
    .select("onboarding_completed")
    .eq("id", clerkOrgId)
    .maybeSingle();

  console.log("Supabase org data:", org);
  console.log("Supabase error:", error);

  // Organization doesn't exist in our DB or onboarding not completed
  if (!org || !org.onboarding_completed) {
    console.log(
      "Organization not found or onboarding not completed, redirecting to welcome"
    );
    redirect("/welcome");
  }

  console.log("Onboarding completed, allowing access to dashboard");
  return clerkOrgId;
}
