import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/lib/toast";

const inter = Inter({
    subsets: ["latin", "cyrillic"],
    variable: "--font-inter",
    display: "swap",
});

export const metadata: Metadata = {
    title: {
        default: "Закоулки — карта городских находок",
        template: "%s · Закоулки",
    },
    description:
        "Интерактивная карта необычных городских мест: стрит-арт, заброшенные объекты, скрытые дворы и другие находки, которые отмечают сами жители.",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ru" className={inter.variable}>
            <body className="font-sans antialiased">
                <AuthProvider>
                    <ToastProvider>{children}</ToastProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
