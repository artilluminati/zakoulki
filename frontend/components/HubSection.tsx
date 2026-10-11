"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchPlaceHubs, attachHub, detachHub, makeHub, type PlaceHub } from "@/lib/v5";
import { useToast } from "@/lib/toast";
import { useConfirm } from "@/lib/confirm";
import type { ThreadV5 } from "@/types/v5";

/** Панель раздела на странице обычного треда: привязка, открепление, создание. */
export default function HubSection({ t, user, reload }: {
  t: ThreadV5;
  user: { id: number; role?: string } | null;
  reload: () => void;
}) {
  const toast = useToast();
  const { prompt } = useConfirm();
  const [hubs, setHubs] = useState<PlaceHub[]>([]);
  const [attaching, setAttaching] = useState(false);
  const canMod = !!user && (user.id === t.author_id || user.role === "admin" ||
    hubs.some((h) => h.can_moderate));

  useEffect(() => {
    if (!t.is_hub && t.place?.id && !t.hub_id && !t.is_hub_talk) {
      fetchPlaceHubs(t.place.id).then(setHubs).catch(() => {});
    }
  }, [t.id, t.is_hub, t.hub_id, t.is_hub_talk, t.place?.id]);

  const doAttach = async (hubId: number) => {
    setAttaching(true);
    try {
      await attachHub(t.id, hubId);
      toast("Прикреплено к разделу", "success");
      reload();
    } catch { toast("Не получилось", "error"); }
    finally { setAttaching(false); }
  };

  const doDetach = async () => {
    try {
      await detachHub(t.id);
      toast("Откреплено", "success");
      reload();
    } catch { toast("Не получилось", "error"); }
  };

  const doMakeHub = async () => {
    const title = await prompt({
      title: "Название раздела:",
      input: { placeholder: "Например: Наш двор", initial: t.title || "Раздел" },
      ok: "Создать",
    });
    if (title === null) return;
    try {
      await makeHub(t.id, title.trim() || null);
      toast("Раздел создан", "success");
      reload();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast(detail ?? "Не получилось", "error");
    }
  };

  if (t.is_hub_talk && t.hub) {
    return (
      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[13px] dark:border-emerald-800 dark:bg-emerald-950/40">
        <span className="text-slate-500 dark:text-neutral-400">Общее обсуждение раздела </span>
        <Link href={`/hub/${t.hub.id}`} className="font-bold text-emerald-700 hover:underline dark:text-emerald-300">{t.hub.title}</Link>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
      {t.hub ? (
        <>
          <span className="text-slate-500 dark:text-neutral-400">Раздел:</span>
          <Link href={`/hub/${t.hub.id}`} className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">
            {t.hub.title}
          </Link>
          {canMod && (
            <button onClick={doDetach} className="font-semibold text-slate-400 hover:text-red-500 dark:text-neutral-500">
              открепить
            </button>
          )}
        </>
      ) : (
        <>
          {t.place && hubs.length > 0 && canMod && (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-500 dark:text-neutral-400">В раздел:</span>
              {hubs.map((h) => (
                <button
                  key={h.id}
                  disabled={attaching}
                  onClick={() => doAttach(h.id)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  {h.title}
                </button>
              ))}
            </span>
          )}
          {t.place && canMod && (
            <button onClick={doMakeHub} className="font-bold text-emerald-700 hover:underline dark:text-emerald-300">
              Сделать разделом
            </button>
          )}
        </>
      )}
    </div>
  );
}
