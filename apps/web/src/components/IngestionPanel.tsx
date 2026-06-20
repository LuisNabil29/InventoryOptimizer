"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import {
  runEngineAction,
  uploadCsvAction,
  type RunState,
  type UploadState,
} from "@/lib/ingestion-actions";
import { INGESTION_ENTITIES } from "@/lib/ingestion";

const uploadInitial: UploadState = { status: "idle" };
const runInitial: RunState = { status: "idle" };

const cardClass =
  "rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";
const btnClass =
  "rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200";
const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900";

export function IngestionPanel() {
  const t = useTranslations("ingestion");
  const router = useRouter();
  const [uploadState, uploadAction, uploading] = useActionState(uploadCsvAction, uploadInitial);
  const [runState, runAction, running] = useActionState(runEngineAction, runInitial);

  useEffect(() => {
    if (uploadState.status === "done" || runState.status === "done") {
      router.refresh();
    }
  }, [uploadState.status, runState.status, router]);

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <form action={uploadAction} className={cardClass}>
        <h2 className="text-base font-semibold">{t("uploadTitle")}</h2>
        <label className="mt-3 block text-sm">
          {t("entity")}
          <select name="entity" defaultValue="sales" className={fieldClass}>
            {INGESTION_ENTITIES.map((e) => (
              <option key={e} value={e}>
                {t(`entities.${e}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm">
          {t("file")}
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm dark:file:bg-slate-800"
          />
        </label>
        <button type="submit" disabled={uploading} className={`${btnClass} mt-4`}>
          {t("upload")}
        </button>

        {uploadState.status === "error" && uploadState.message ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            {t(`errors.${uploadState.message}`)}
          </p>
        ) : null}
        {uploadState.status === "done" ? (
          <div className="mt-3 text-sm">
            <p className="text-green-600 dark:text-green-400">
              {t("result", {
                persisted: uploadState.persisted ?? 0,
                total: uploadState.totalRows ?? 0,
                errors: uploadState.errorRows ?? 0,
              })}
            </p>
            {uploadState.sampleErrors && uploadState.sampleErrors.length > 0 ? (
              <div className="mt-2">
                <p className="font-medium text-slate-500 dark:text-slate-400">
                  {t("sampleErrorsTitle")}
                </p>
                <ul className="mt-1 list-disc pl-5 text-xs text-slate-500 dark:text-slate-400">
                  {uploadState.sampleErrors.map((e, i) => (
                    <li key={i}>
                      #{e.row + 1} · {e.field}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </form>

      <form action={runAction} className={cardClass}>
        <h2 className="text-base font-semibold">{t("runTitle")}</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t("runHint")}</p>
        <button type="submit" disabled={running} className={`${btnClass} mt-4`}>
          {t("run")}
        </button>

        {runState.status === "error" ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{t("errors.runFailed")}</p>
        ) : null}
        {runState.status === "done" ? (
          <p className="mt-3 text-sm text-green-600 dark:text-green-400">
            {t("runDone", {
              id: (runState.runId ?? "").slice(0, 8),
              status: runState.runStatus ?? "",
            })}
          </p>
        ) : null}
      </form>
    </div>
  );
}
