"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { saveSettingsAction, type SettingsState } from "@/lib/settings-actions";
import type { TenantSettingsView } from "@/lib/settings";

const initialState: SettingsState = { status: "idle" };

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900";

function p2(value: number): string {
  return (Math.round(value * 100 * 100) / 100).toString();
}

export function SettingsForm({ settings }: { settings: TenantSettingsView }) {
  const t = useTranslations("settings");
  const [state, formAction, pending] = useActionState(saveSettingsAction, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-8">
      <fieldset>
        <legend className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {t("sections.inventory")}
        </legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            {t("costOfCapital")}
            <input
              name="costOfCapitalPct"
              type="number"
              step="0.1"
              min="0"
              defaultValue={p2(settings.costOfCapitalPct)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            {t("defaultServiceLevel")}
            <input
              name="defaultServiceLevel"
              type="number"
              step="0.1"
              min="0"
              max="100"
              defaultValue={p2(settings.defaultServiceLevel)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            {t("globalLeadTime")}
            <input
              name="globalLeadTimeDays"
              type="number"
              step="1"
              min="1"
              defaultValue={settings.globalLeadTimeDays}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            {t("reviewPeriod")}
            <input
              name="reviewPeriodDays"
              type="number"
              step="1"
              min="1"
              defaultValue={settings.reviewPeriodDays}
              className={inputClass}
            />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {t("sections.abc")}
        </legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            {t("abcA")}
            <input
              name="abcAPct"
              type="number"
              step="0.1"
              min="0"
              max="100"
              defaultValue={p2(settings.abcAPct)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            {t("abcB")}
            <input
              name="abcBPct"
              type="number"
              step="0.1"
              min="0"
              max="100"
              defaultValue={p2(settings.abcBPct)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            {t("abcBasis")}
            <select name="abcBasis" defaultValue={settings.abcBasis} className={inputClass}>
              <option value="margin">{t("basis.margin")}</option>
              <option value="revenue">{t("basis.revenue")}</option>
              <option value="units">{t("basis.units")}</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {t("sections.defaults")}
        </legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            {t("stockoutThreshold")}
            <input
              name="stockoutThreshold"
              type="number"
              step="0.01"
              min="0"
              defaultValue={settings.stockoutThreshold}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            {t("defaultLocale")}
            <select name="defaultLocale" defaultValue={settings.defaultLocale} className={inputClass}>
              <option value="es">Espanol</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="block text-sm">
            {t("defaultTheme")}
            <select name="defaultTheme" defaultValue={settings.defaultTheme} className={inputClass}>
              <option value="system">{t("themes.system")}</option>
              <option value="light">{t("themes.light")}</option>
              <option value="dark">{t("themes.dark")}</option>
            </select>
          </label>
        </div>
      </fieldset>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {t("save")}
        </button>
        {state.status === "saved" ? (
          <span className="text-sm text-green-600 dark:text-green-400">{t("saved")}</span>
        ) : null}
        {state.status === "error" ? (
          <span className="text-sm text-red-600 dark:text-red-400">{t("error")}</span>
        ) : null}
      </div>
    </form>
  );
}
