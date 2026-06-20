"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { loginAction, type LoginState } from "@/lib/auth-actions";

const initialState: LoginState = { error: null };

export function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          {t("email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          {t("password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900"
        />
      </div>

      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{t(state.error)}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
      >
        {t("submit")}
      </button>

      <p className="text-center text-xs text-slate-400">{t("demoHint")}</p>
    </form>
  );
}
