import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Pixelify_Sans } from "next/font/google";
import "./globals.css";

const pixel = Pixelify_Sans({
  subsets: ["latin"],
  variable: "--font-pixel",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const body = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://simulization.vercel.app"),
  title: "Simulization — a multi-agent eval for in-group bias",
  description:
    "A minimal-group-paradigm test for AI agents: LABELED vs BLIND runs, every lie and theft checked against ground truth, plus power-structure metrics.",
  applicationName: "Simulization",
  openGraph: {
    type: "website",
    siteName: "Simulization",
    title: "Simulization — do AI models favor their own maker?",
    description:
      "18 AI agents from 3 labs trade in a simulated market. LABELED vs BLIND runs measure in-group favoritism and whether power structures form.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Simulization — a multi-agent eval for in-group bias",
    description:
      "LABELED vs BLIND runs measure in-group favoritism in AI agents.",
  },
};

export const viewport: Viewport = {
  themeColor: "#05060a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${pixel.variable} ${body.variable} h-full bg-background antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
