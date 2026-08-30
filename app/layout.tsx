import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import type { ComponentProps } from "react";
import "./globals.css";

// Poppins is not a variable font, so every weight used by the type scale must
// be requested explicitly: 400 Regular, 500 Medium, 600 SemiBold, 700 Bold.
const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SKEW news — Balanced news coverage, powered by AI.",
  description: "Balanced news coverage, powered by AI.",
};

/*
  Themes every Clerk component (sign-in, sign-up, user button) with the SKEW news
  design system, so Clerk's card does not arrive in its own default palette.

  The values are literal copies of the `@theme` tokens in `app/globals.css`,
  which stays the source of truth — keep them in sync by hand. They are NOT
  written as `var(--color-…)` on purpose: Clerk derives its hover/active shades
  with `color-mix()` and relative color syntax, which needs a resolvable color
  rather than a custom property.

  `fontFamily` is omitted deliberately — it defaults to `inherit`, so Clerk
  picks up Poppins from `<body class="font-sans">` for free.
*/
const clerkAppearance: ComponentProps<typeof ClerkProvider>["appearance"] = {
  variables: {
    colorPrimary: "#0d0d0f", // --color-text-primary
    colorForeground: "#0d0d0f", // --color-text-primary
    colorMutedForeground: "#6b7280", // --color-text-secondary
    colorBackground: "#ffffff", // --color-bg-primary
    colorInput: "#ffffff", // --color-bg-primary
    colorMuted: "#f6f6f6", // --color-surface
    colorBorder: "#e5e7eb", // --color-border
    colorRing: "#1d4ed8", // --color-bias-right, matches buttonClasses' focus ring
    colorDanger: "#b42318", // --color-bias-left
    borderRadius: "8px", // --radius-md
    fontSize: "14px", // --text-body-md
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg-primary text-text-primary font-sans">
        {/* Must sit inside <body>, not around <html> (Clerk Core 3). */}
        <ClerkProvider afterSignOutUrl="/" appearance={clerkAppearance}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
