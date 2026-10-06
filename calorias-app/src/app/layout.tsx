import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/BottomNav";
import { ClientGate } from "@/components/ClientGate";
import { Toaster } from "@/components/Toaster";
import { UsageTracker } from "@/components/UsageTracker";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mis Calorías",
  description: "Registra lo que comes con una foto y las calorías que quemas cada día.",
  applicationName: "Mis Calorías",
  appleWebApp: { capable: true, title: "Calorías", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body className="min-h-dvh antialiased">
        <div className="mx-auto min-h-dvh max-w-md pb-[calc(5rem+env(safe-area-inset-bottom))]">
          <ClientGate>{children}</ClientGate>
        </div>
        <BottomNav />
        <Toaster />
        <UsageTracker />
      </body>
    </html>
  );
}
