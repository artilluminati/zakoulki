import type { Metadata } from "next";
import DonateForm from "./DonateForm";

export const metadata: Metadata = {
  title: "Поддержать проект",
  description: "Помогите «Закоулкам»: хостинг и карты, модерация и поддержка сообщества.",
};

export default async function DonatePage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string | string[] }>;
}) {
  const sp = await searchParams;
  const paid = (Array.isArray(sp.paid) ? sp.paid[0] : sp.paid) === "1";
  return <DonateForm paid={paid} />;
}
