'use client'

import { SignedIn, SignedOut, SignIn, useOrganizationList } from "@clerk/nextjs";
import { LandingHero } from "../_template/components/landing-hero";
import { LearnMore } from "../_template/components/learn-more";
import { Footer } from "../_template/components/footer";
import { CARDS } from "../_template/content/cards";
import Onboarding from "../../components/onboarding";

export default function WelcomePage() {
  const { userMemberships, isLoaded } = useOrganizationList()
  return (
    <>
      <SignedOut>
        <div className="h-screen">
          <div className="md:hidden h-full bg-cover bg-center flex justify-center items-center py-24" style={{ backgroundImage: 'url(/images/login-background4.jpg)' }}>
            <SignIn routing="hash" />
          </div>
          <div className="hidden md:flex h-full">
            <div className="w-1/2 bg-cover bg-center" style={{ backgroundImage: 'url(/images/login-background4.jpg)', boxShadow: '10px 0 20px rgba(0,0,0,0.3)' }}></div>
            <div className="w-1/2 flex justify-center items-center py-24">
              <SignIn routing="hash" />
            </div>
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <Onboarding />
      </SignedIn>
    </>
  );
}
