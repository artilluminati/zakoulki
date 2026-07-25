import type { Metadata } from "next";
import AuthScreen from "@/components/auth/AuthScreen";

export const metadata: Metadata = { title: "Регистрация" };

export default function RegisterPage() {
  return <AuthScreen mode="register" />;
}
