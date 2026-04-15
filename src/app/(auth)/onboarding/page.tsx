import type { Metadata } from "next";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Willkommen bei MeepleBase" };

export default function OnboardingPage() {
  return <OnboardingForm />;
}
