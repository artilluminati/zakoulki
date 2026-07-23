import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
    title: "Zakoulki",
    description: "Интерактивная карта городских находок",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ru">
            <body>
                <AuthProvider>{children}</AuthProvider>
            </body>
        </html>
    );
}
