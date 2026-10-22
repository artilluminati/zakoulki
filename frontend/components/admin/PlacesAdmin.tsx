"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Pencil, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useConfirm } from "@/lib/confirm";
import {
  Counter,
  EmptyBlock,
  ErrorBlock,
  LoadingRows,
  btnGhost,
  btnPrimary,
  errMessage,
  inputCls,
} from "./common";

interface Place {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  district: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

interface FormState {
  name: string;
  address: string;
  city: string;
  district: string;
  region: string;
}

const EMPTY_FORM: FormState = { name: "", address: "", city: "", district: "", region: "" };

export default function PlacesAdmin() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [items, setItems] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Place | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const loadedRef = useRef(false);

  const load = useCallback(async (q: string) => {
    // скелетон показываем только при первой загрузке, дальше — обновляем список тихо
    if (!loadedRef.current) setLoading(true);
    try {
      const res = await api.get("/admin/places", { params: q.trim() ? { q: q.trim() } : {} });
      setItems(res.data ?? []);
      setError(null);
    } catch (e) {
      setError(errMessage(e, "Не получилось загрузить места"));
    } finally {
      loadedRef.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query), 350);
    return () => clearTimeout(t);
  }, [load, query]);

  const openEdit = (p: Place) => {
    setEditing(p);
    setForm({
      name: p.name ?? "",
      address: p.address ?? "",
      city: p.city ?? "",
      district: p.district ?? "",
      region: p.region ?? "",
    });
  };

  const save = async () => {
    if (!editing) return;
    const name = form.name.trim();
    if (!name) {
      toast("Укажите название места", "error");
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/admin/places/${editing.id}`, {
        name,
        address: form.address.trim(),
        city: form.city.trim(),
        district: form.district.trim(),
        region: form.region.trim(),
      });
      toast("Место обновлено", "success");
      setEditing(null);
      load(query);
    } catch (e) {
      toast(errMessage(e, "Не получилось сохранить место"), "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Place) => {
    if (!(await confirm({
      title: `Удалить место «${p.name}»?`,
      text: "Место исчезнет из списка и с карты.",
      ok: "Удалить",
      danger: true,
    }))) return;
    try {
      await api.delete(`/admin/places/${p.id}`);
      toast("Место удалено", "success");
      if (editing?.id === p.id) setEditing(null);
      load(query);
    } catch (e) {
      toast(errMessage(e, "Не получилось удалить место"), "error");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-extrabold dark:text-neutral-100">
          <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Места
        </h2>
        <Counter count={items.length} label="найдено" />
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по названию или адресу…"
          maxLength={80}
          className={`${inputCls} pl-9`}
        />
      </div>

      {loading && <LoadingRows rows={3} />}
      {!loading && error && <ErrorBlock message={error} onRetry={() => load(query)} />}
      {!loading && !error && items.length === 0 && (
        <EmptyBlock
          icon={<MapPin className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />}
          title={query.trim() ? "Ничего не нашли" : "Мест пока нет"}
          text={query.trim() ? "Попробуйте изменить запрос." : "Места появятся здесь, когда их добавят жители."}
        />
      )}

      <div className="space-y-2">
        {items.map((p) => (
          <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-extrabold dark:text-neutral-100">{p.name}</span>
              <button
                onClick={() => openEdit(p)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <Pencil className="h-3.5 w-3.5" /> Изменить
              </button>
              <button
                onClick={() => remove(p)}
                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" /> Удалить
              </button>
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
              {[p.address, p.district, p.city, p.region].filter(Boolean).join(" · ") || "Без адреса"}
            </div>

            {editing?.id === p.id && (
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-bold text-slate-500 dark:text-neutral-400">Название</span>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    maxLength={255}
                    className={inputCls}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-bold text-slate-500 dark:text-neutral-400">Адрес</span>
                  <input
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    maxLength={500}
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-500 dark:text-neutral-400">Город</span>
                  <input
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    maxLength={200}
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-500 dark:text-neutral-400">Район</span>
                  <input
                    value={form.district}
                    onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
                    maxLength={200}
                    className={inputCls}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-bold text-slate-500 dark:text-neutral-400">Регион</span>
                  <input
                    value={form.region}
                    onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                    maxLength={200}
                    className={inputCls}
                  />
                </label>
                <div className="flex gap-1.5 sm:col-span-2">
                  <button onClick={save} disabled={busy} className={btnPrimary}>
                    {busy ? "Сохраняем…" : "Сохранить"}
                  </button>
                  <button onClick={() => setEditing(null)} className={btnGhost}>Отмена</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
