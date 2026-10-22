import type { Metadata } from "next";
import ForgotForm from "./ForgotForm";

export const metadata: Metadata = {
  title: "Восстановление пароля",
  description: "Пришлите ссылку для смены пароля на вашу почту.",
};

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
