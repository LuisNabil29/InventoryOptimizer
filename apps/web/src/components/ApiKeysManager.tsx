"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { TableCard, Td, Th } from "@/components/TableCard";
import type { ApiKeyView } from "@/lib/apikeys";
import {
  createApiKeyAction,
  revokeApiKeyAction,
  type CreateKeyState,
  type RevokeKeyState,
} from "@/lib/apikeys-actions";

const AVAILABLE_SCOPES = ["ingest:write", "read"] as const;

const input =
  "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900";
const btn =
  "rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200";
const ghost =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800";

function fmtDate(iso: string | null, never: string): string {
  if (!iso) return never;
  return new Date(iso).toLocaleString();
}

function RevokeButton({ id }: { id: string }) {
  const t = useTranslations("apikeys");
  const router = useRouter();
  const [state, action, pending] = useActionState<RevokeKeyState, FormData>(
    revokeApiKeyAction,
    { status: "idle" },
  );
  useEffect(() => {
    if (state.status === "revoked") router.refresh();
  }, [state, router]);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(t("confirmRevoke"))) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} readOnly />
      <button type="submit" disabled={pending} className={ghost}>
        {t("revoke")}
      </button>
    </form>
  );
}

export function ApiKeysManager({ keys }: { keys: ApiKeyView[] }) {
  const t = useTranslations("apikeys");
  const router = useRouter();
  const [state, action, pending] = useActionState<CreateKeyState, FormData>(
    createApiKeyAction,
    { status: "idle" },
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state.status === "created") router.refresh();
  }, [state, router]);

  const copy = async () => {
    if (!state.plaintext) return;
    await navigator.clipboard.writeText(state.plaintext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-6 space-y-6">
      {state.status === "created" && state.plaintext ? (
        <div className="rounded-xl border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/40">
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">
            {t("newKeyTitle")}
          </p>
          <p className="mt-1 text-xs text-green-700 dark:text-green-400">{t("newKeyHint")}</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2 text-xs dark:bg-slate-900">
              {state.plaintext}
            </code>
            <button type="button" className={btn} onClick={copy}>
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
        </div>
      ) : null}

      <form action={action} className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div>
          <span className="block text-xs text-slate-500 dark:text-slate-400">{t("name")}</span>
          <input name="name" required placeholder={t("namePlaceholder")} className={input} />
        </div>
        <div>
          <span className="block text-xs text-slate-500 dark:text-slate-400">{t("scopes")}</span>
          <div className="mt-1 flex gap-3">
            {AVAILABLE_SCOPES.map((scope) => (
              <label key={scope} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  name="scopes"
                  value={scope}
                  defaultChecked={scope === "ingest:write"}
                />
                {scope}
              </label>
            ))}
          </div>
        </div>
        <button type="submit" disabled={pending} className={btn}>
          {t("create")}
        </button>
      </form>
      {state.status === "error" ? (
        <p className="text-sm text-red-600 dark:text-red-400">{t("error")}</p>
      ) : null}

      <TableCard>
        <thead className="border-b border-slate-200 dark:border-slate-800">
          <tr>
            <Th>{t("name")}</Th>
            <Th>{t("prefix")}</Th>
            <Th>{t("scopes")}</Th>
            <Th>{t("created")}</Th>
            <Th>{t("lastUsed")}</Th>
            <Th>{t("status")}</Th>
            <Th align="right" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {keys.length === 0 ? (
            <tr>
              <Td>
                <span className="text-slate-500 dark:text-slate-400">{t("empty")}</span>
              </Td>
            </tr>
          ) : (
            keys.map((k) => (
              <tr key={k.id}>
                <Td className="font-medium">{k.name}</Td>
                <Td>
                  <code className="text-xs">{k.keyPrefix}</code>
                </Td>
                <Td>{k.scopes.join(", ")}</Td>
                <Td>{fmtDate(k.createdAt, t("never"))}</Td>
                <Td>{fmtDate(k.lastUsedAt, t("never"))}</Td>
                <Td>
                  {k.revokedAt ? (
                    <span className="text-red-600 dark:text-red-400">{t("revoked")}</span>
                  ) : (
                    <span className="text-green-600 dark:text-green-400">{t("active")}</span>
                  )}
                </Td>
                <Td align="right">{k.revokedAt ? null : <RevokeButton id={k.id} />}</Td>
              </tr>
            ))
          )}
        </tbody>
      </TableCard>
    </div>
  );
}
