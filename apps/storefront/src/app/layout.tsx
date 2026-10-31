import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CartProvider } from "@/components/cart-provider";
import { DemoBanner } from "@/components/demo-banner";
import { DemoInboxProvider } from "@/components/demo-inbox";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Plantify",
  description: "Plantify is a demo plant store. Nothing here is real.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DemoInboxProvider>
          <CartProvider>
            <DemoBanner />
            <SiteHeader />
            <main className="flex-1">{children}</main>
          </CartProvider>
        </DemoInboxProvider>
        <Toaster />
      </body>
    </html>
  );
}
