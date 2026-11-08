import type { Metadata } from "next";
import localFont from "next/font/local";
import { labBranding } from "@/lib/branding";
import "./globals.css";

const gellix = localFont({
  src: [
    { path: "./fonts/gellix/Gellix-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/gellix/Gellix-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/gellix/Gellix-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/gellix/Gellix-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-gellix",
  display: "swap",
});

export const metadata: Metadata = {
  title: labBranding.name,
  description: "Laboratory patient, order, and result workflow for Henks Medical Limited",
  icons: { icon: "/mainicon.webp" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${gellix.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
