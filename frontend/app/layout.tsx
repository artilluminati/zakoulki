import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/lib/toast";
import { ScopeProvider } from "@/lib/scope";
import { ThemeProvider } from "@/lib/theme";
import { ConfirmProvider } from "@/lib/confirm";
import AppShell from "@/components/AppShell";
import ChunkReload from "@/components/ChunkReload";
import Onboarding from "@/components/Onboarding";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Закоулки — вопросы города", template: "%s · Закоулки" },
  description: "Платформа городских вопросов: от ямы во дворе до судьбы парка. Спрашивайте, отвечайте, смотрите на карте.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        {/* выставляем тему до отрисовки, чтобы не мигало */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('zakoulki_theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        <ThemeProvider>
          <ChunkReload />
          <ConfirmProvider>
          <AuthProvider>
            <ToastProvider>
              <ScopeProvider>
                <AppShell>{children}</AppShell>
                <Onboarding />
              </ScopeProvider>
            </ToastProvider>
          </AuthProvider>
          </ConfirmProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
