"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { TableCard, Td, Th } from "@/components/TableCard";
import {
  saveServiceLevelsAction,
  type ClassificationState,
} from "@/lib/classification-actions";
import type { ClassificationData } from "@/lib/classification";

const initialState: ClassificationState = { status: "idle" };

export function ClassificationForm({ data }: { data: ClassificationData }) {
  const t = useTranslations("classification");
  const [state, formAction, pending] = useActionState(
    saveServiceLevelsAction,
    initialState,
  );

  const defaultPct = Math.round(data.defaultServiceLevel * 100 * 100) / 100;

  return (
    <form action={formAction} className="mt-6 space-y-8">
      {data.schemes.map((scheme) => (
        <div key={scheme.id}>
          <h2 className="mb-2 text-base font-semibold">
            {scheme.name}{" "}
            <span className="text-sm font-normal uppercase text-slate-400">{scheme.kind}</span>
          </h2>
          <TableCard>
            <thead className="border-b border-slate-200 dark:border-slate-800">
              <tr>
                <Th>{t("class")}</Th>
                <Th align="right">{t("products")}</Th>
                <Th align="right">{t("serviceLevel")}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {scheme.classes.map((c) => (
                <tr key={c.id}>
                  <Td className="font-medium">
                    {c.code} · {c.name}
                  </Td>
                  <Td align="right">{c.productCount}</Td>
                  <Td align="right">
                    <input
                      name={`sl_${c.id}`}
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      defaultValue={
                        c.serviceLevel !== null
                          ? Math.round(c.serviceLevel * 100 * 100) / 100
                          : ""
                      }
                      placeholder={String(defaultPct)}
                      className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-right text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900"
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        </div>
      ))}

      <p className="text-xs text-slate-400">{t("defaultHint", { value: defaultPct })}</p>

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
