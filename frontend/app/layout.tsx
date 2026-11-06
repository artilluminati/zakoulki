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
      <head>
        {/* Яндекс.Метрика — аналитика посещений, кликов и вебвизор */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=114111239','ym');ym(114111239,'init',{ssr:true,webvisor:true,clickmap:true,ecommerce:"dataLayer",referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});`,
          }}
        />
        <noscript>
          <div>
            <img src="https://mc.yandex.ru/watch/114111239" style={{ position: "absolute", left: "-9999px" }} alt="" />
          </div>
        </noscript>
      </head>
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
