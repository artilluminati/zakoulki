import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/lib/toast";
import AppShell from "@/components/AppShell";
import Onboarding from "@/components/Onboarding";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Закоулки — вопросы города", template: "%s · Закоулки" },
  description: "Геосоцсеть: спрашивайте город, отвечайте соседям, смотрите вопросы на карте.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
            <Onboarding />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
