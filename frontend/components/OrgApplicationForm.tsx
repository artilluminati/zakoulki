"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Landmark, LockKeyhole, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { getApiError } from "@/lib/errors";

type Kind = "administration" | "organization";
type AccountMode = "new" | "existing";

const KIND_OPTIONS: { id: Kind; label: string; hint: string; Icon: typeof Landmark }[] = [
  {
    id: "administration",
    label: "Администрация",
    hint: "Муниципалитет, департамент, служба",
    Icon: Landmark,
  },
  {
    id: "organization",
    label: "Организация",
    hint: "УК, ТСЖ, компания, НКО",
    Icon: Building2,
  },
];

const inputCls =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[15px] outline-none focus:border-lime-500 focus:bg-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:bg-neutral-900";
const areaCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[15px] outline-none focus:border-lime-500 focus:bg-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:bg-neutral-900";

export default function OrgApplicationForm() {
  const [kind, setKind] = useState<Kind>("organization");
  const [orgName, setOrgName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [accountMode, setAccountMode] = useState<AccountMode>("new");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [existingAccount, setExistingAccount] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ accountCreated: boolean } | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (orgName.trim().length < 2) {
      setError("Напишите название администрации или организации");
      return;
    }
    if (contactName.trim().length < 2) {
      setError("Укажите контактное лицо");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      setError("Проверьте email — на него придёт ответ");
      return;
    }
    if (accountMode === "new") {
      if (username.trim().length < 3) {
        setError("Ник — минимум 3 символа");
        return;
      }
      if (password.length < 6) {
        setError("Пароль — минимум 6 символов");
        return;
      }
    } else if (existingAccount.trim().length < 3) {
      setError("Укажите ник или email вашего аккаунта");
      return;
    }

    setBusy(true);
    try {
      const res = await api.post("/org-applications", {
        kind,
        org_name: orgName.trim(),
        city: city.trim() || undefined,
        address: address.trim() || undefined,
        website: website.trim() || undefined,
        description: description.trim() || undefined,
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim() || undefined,
        account_mode: accountMode,
        username: accountMode === "new" ? username.trim() : undefined,
        password: accountMode === "new" ? password : undefined,
        existing_account: accountMode === "existing" ? existingAccount.trim() : undefined,
      });
      setDone({ accountCreated: Boolean(res.data?.account_created) });
    } catch (err) {
      setError(getApiError(err, "Не получилось отправить заявку"));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/40">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        <h2 className="mt-3 text-xl font-extrabold text-emerald-900 dark:text-emerald-100">Заявка отправлена</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-emerald-900/80 dark:text-emerald-100/80">
          Проверим данные и ответим на указанный email. Обычно это занимает до двух рабочих дней.
          {done.accountCreated
            ? " Аккаунт уже создан — можно войти с ником и паролем, который вы указали."
            : " Аккаунт привяжем к вашей заявке при проверке."}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {done.accountCreated && (
            <Link
              href="/login"
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-500"
            >
              Войти в аккаунт <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          <Link
            href="/about"
            className="rounded-xl border border-emerald-300 px-4 py-2.5 text-sm font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
          >
            Вернуться на главную
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <div className="text-sm font-extrabold dark:text-neutral-100">Кто подаёт заявку</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {KIND_OPTIONS.map(({ id, label, hint, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setKind(id)}
              aria-pressed={kind === id}
              className={`flex items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
                kind === id
                  ? "border-emerald-500 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/50"
                  : "border-slate-200 bg-white hover:bg-slate-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
              }`}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <span className="block text-[15px] font-bold dark:text-neutral-100">{label}</span>
                <span className="block text-[13px] text-slate-500 dark:text-neutral-400">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <div className="text-sm font-extrabold dark:text-neutral-100">О заявителе</div>
        <input
          placeholder="Название: администрация города, УК «Дом», НКО «Парк»"
          value={orgName}
          maxLength={150}
          onChange={(e) => setOrgName(e.target.value)}
          className={inputCls}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            placeholder="Город или район"
            value={city}
            maxLength={120}
            onChange={(e) => setCity(e.target.value)}
            className={inputCls}
          />
          <input
            placeholder="Адрес (необязательно)"
            value={address}
            maxLength={255}
            onChange={(e) => setAddress(e.target.value)}
            className={inputCls}
          />
        </div>
        <input
          placeholder="Сайт или страница в соцсети (необязательно)"
          value={website}
          maxLength={255}
          onChange={(e) => setWebsite(e.target.value)}
          className={inputCls}
        />
        <textarea
          placeholder="Чем занимаетесь и на какие обращения готовы отвечать"
          value={description}
          maxLength={2000}
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
          className={areaCls}
        />
      </div>

      <div className="space-y-2.5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <div className="text-sm font-extrabold dark:text-neutral-100">Контакт для связи</div>
        <input
          placeholder="Имя и должность"
          value={contactName}
          maxLength={120}
          onChange={(e) => setContactName(e.target.value)}
          className={inputCls}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="email"
            placeholder="Email для ответа"
            value={contactEmail}
            maxLength={255}
            onChange={(e) => setContactEmail(e.target.value)}
            className={inputCls}
          />
          <input
            type="tel"
            placeholder="Телефон (необязательно)"
            value={contactPhone}
            maxLength={40}
            onChange={(e) => setContactPhone(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div className="space-y-2.5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <div className="text-sm font-extrabold dark:text-neutral-100">Аккаунт для ответов</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {(
            [
              { id: "new" as const, label: "Создать новый", Icon: UserRound },
              { id: "existing" as const, label: "У меня уже есть", Icon: LockKeyhole },
            ]
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setAccountMode(id)}
              aria-pressed={accountMode === id}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                accountMode === id
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {accountMode === "new" ? (
          <>
            <input
              placeholder="Ник на площадке, например «uk-dom»"
              value={username}
              maxLength={50}
              autoComplete="username"
              onChange={(e) => setUsername(e.target.value)}
              className={inputCls}
            />
            <input
              type="password"
              placeholder="Пароль (минимум 6 символов)"
              value={password}
              maxLength={100}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
            <p className="text-[13px] leading-relaxed text-slate-500 dark:text-neutral-400">
              Аккаунт создадим сразу. Входить будете по email, указанному выше.
            </p>
          </>
        ) : (
          <>
            <input
              placeholder="Ник или email существующего аккаунта"
              value={existingAccount}
              maxLength={255}
              onChange={(e) => setExistingAccount(e.target.value)}
              className={inputCls}
            />
            <p className="text-[13px] leading-relaxed text-slate-500 dark:text-neutral-400">
              Найдём аккаунт и привяжем заявку к нему — заново регистрироваться не нужно.
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-2xl bg-emerald-600 px-5 py-3.5 text-[15px] font-extrabold text-white hover:bg-emerald-500 disabled:opacity-60"
      >
        {busy ? "Отправляем…" : "Отправить заявку"}
      </button>

      <p className="px-1 text-center text-xs leading-relaxed text-slate-400 dark:text-neutral-500">
        Отправляя заявку, вы соглашаетесь на проверку данных администрацией сервиса.
        Публично ничего не появится до верификации.
      </p>
    </form>
  );
}
