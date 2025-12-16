import { Metadata } from "next";

export const templateMetadata: Metadata = {
  metadataBase: new URL("https://clerk-nextjs-app-router.vercel.app/"),
  title: "Xtock AI",
  description: "Forcast AI-powered stock management solution for restaurants.",
  openGraph: { images: ["/og.png"] },
};

// Default metadata for when template is removed
export const defaultMetadata: Metadata = {
  title: "Xtock App",
  description: "Xtock for all your stock management needs.",
};
