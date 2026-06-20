"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { TableCard, Td, Th } from "@/components/TableCard";
import { money, num as fmtNum } from "@/lib/format";
import {
  saveLocationAction,
  saveProductAction,
  saveSupplierAction,
  type MasterState,
} from "@/lib/masters-actions";
import type {
  LocationView,
  MastersData,
  ProductView,
  SupplierView,
} from "@/lib/masters";

const initial: MasterState = { status: "idle" };
const input =
  "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900";
const btn =
  "rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200";
const ghost =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800";
const label = "block text-xs text-slate-500 dark:text-slate-400";

function Status({ state, ok }: { state: MasterState; ok: string }) {
  const t = useTranslations("masters");
  if (state.status === "saved") {
    return <span className="text-sm text-green-600 dark:text-green-400">{ok}</span>;
  }
  if (state.status === "error") {
    return <span className="text-sm text-red-600 dark:text-red-400">{t("error")}</span>;
  }
  return null;
}

export function MastersManager({ data }: { data: MastersData }) {
  const t = useTranslations("masters");
  const router = useRouter();

  const [locState, locAction, locPending] = useActionState(saveLocationAction, initial);
  const [supState, supAction, supPending] = useActionState(saveSupplierAction, initial);
  const [prodState, prodAction, prodPending] = useActionState(saveProductAction, initial);

  const [editLoc, setEditLoc] = useState<LocationView | null>(null);
  const [editSup, setEditSup] = useState<SupplierView | null>(null);
  const [editProd, setEditProd] = useState<ProductView | null>(null);

  useEffect(() => {
    if (locState.status === "saved") {
      setEditLoc(null);
      router.refresh();
    }
  }, [locState, router]);
  useEffect(() => {
    if (supState.status === "saved") {
      setEditSup(null);
      router.refresh();
    }
  }, [supState, router]);
  useEffect(() => {
    if (prodState.status === "saved") {
      setEditProd(null);
      router.refresh();
    }
  }, [prodState, router]);

  const supplierName = (id: string | null) =>
    id ? data.suppliers.find((s) => s.id === id)?.code ?? "—" : "—";

  return (
    <div className="mt-6 space-y-12">
      {/* Ubicaciones */}
      <section>
        <h2 className="mb-3 text-base font-semibold">{t("locations")}</h2>
        <TableCard>
          <thead className="border-b border-slate-200 dark:border-slate-800">
            <tr>
              <Th>{t("code")}</Th>
              <Th>{t("name")}</Th>
              <Th>{t("type")}</Th>
              <Th>{t("active")}</Th>
              <Th align="right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.locations.map((l) => (
              <tr key={l.id}>
                <Td className="font-medium">{l.code}</Td>
                <Td>{l.name}</Td>
                <Td>{t(`types.${l.type}`)}</Td>
                <Td>{l.isActive ? t("yes") : t("no")}</Td>
                <Td align="right">
                  <button type="button" className={ghost} onClick={() => setEditLoc(l)}>
                    {t("edit")}
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
        <form
          key={editLoc?.id ?? "new-loc"}
          action={locAction}
          className="mt-4 grid items-end gap-3 sm:grid-cols-5"
        >
          <input type="hidden" name="id" defaultValue={editLoc?.id ?? ""} />
          <div>
            <span className={label}>{t("code")}</span>
            <input name="code" defaultValue={editLoc?.code ?? ""} required className={input} />
          </div>
          <div>
            <span className={label}>{t("name")}</span>
            <input name="name" defaultValue={editLoc?.name ?? ""} required className={input} />
          </div>
          <div>
            <span className={label}>{t("type")}</span>
            <select name="type" defaultValue={editLoc?.type ?? "store"} className={input}>
              <option value="store">{t("types.store")}</option>
              <option value="warehouse">{t("types.warehouse")}</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={editLoc?.isActive ?? true} />
            {t("active")}
          </label>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={locPending} className={btn}>
              {editLoc ? t("save") : t("add")}
            </button>
            {editLoc ? (
              <button type="button" className={ghost} onClick={() => setEditLoc(null)}>
                {t("cancel")}
              </button>
            ) : null}
            <Status state={locState} ok={t("saved")} />
          </div>
        </form>
      </section>

      {/* Proveedores */}
      <section>
        <h2 className="mb-3 text-base font-semibold">{t("suppliers")}</h2>
        <TableCard>
          <thead className="border-b border-slate-200 dark:border-slate-800">
            <tr>
              <Th>{t("code")}</Th>
              <Th>{t("name")}</Th>
              <Th align="right">{t("minOrderValue")}</Th>
              <Th align="right">{t("leadTime")}</Th>
              <Th align="right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.suppliers.map((s) => (
              <tr key={s.id}>
                <Td className="font-medium">{s.code}</Td>
                <Td>{s.name}</Td>
                <Td align="right">{money(s.minOrderValue)}</Td>
                <Td align="right">{s.defaultLeadTimeDays}</Td>
                <Td align="right">
                  <button type="button" className={ghost} onClick={() => setEditSup(s)}>
                    {t("edit")}
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
        <form
          key={editSup?.id ?? "new-sup"}
          action={supAction}
          className="mt-4 grid items-end gap-3 sm:grid-cols-5"
        >
          <input type="hidden" name="id" defaultValue={editSup?.id ?? ""} />
          <div>
            <span className={label}>{t("code")}</span>
            <input name="code" defaultValue={editSup?.code ?? ""} required className={input} />
          </div>
          <div>
            <span className={label}>{t("name")}</span>
            <input name="name" defaultValue={editSup?.name ?? ""} required className={input} />
          </div>
          <div>
            <span className={label}>{t("minOrderValue")}</span>
            <input
              name="minOrderValue"
              type="number"
              step="0.01"
              min="0"
              defaultValue={editSup?.minOrderValue ?? 0}
              className={input}
            />
          </div>
          <div>
            <span className={label}>{t("leadTime")}</span>
            <input
              name="defaultLeadTimeDays"
              type="number"
              step="1"
              min="0"
              defaultValue={editSup?.defaultLeadTimeDays ?? 7}
              className={input}
            />
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={supPending} className={btn}>
              {editSup ? t("save") : t("add")}
            </button>
            {editSup ? (
              <button type="button" className={ghost} onClick={() => setEditSup(null)}>
                {t("cancel")}
              </button>
            ) : null}
            <Status state={supState} ok={t("saved")} />
          </div>
        </form>
      </section>

      {/* Productos */}
      <section>
        <h2 className="mb-3 text-base font-semibold">{t("products")}</h2>
        <TableCard>
          <thead className="border-b border-slate-200 dark:border-slate-800">
            <tr>
              <Th>{t("sku")}</Th>
              <Th>{t("name")}</Th>
              <Th align="right">{t("unitCost")}</Th>
              <Th align="right">{t("unitPrice")}</Th>
              <Th align="right">{t("packSize")}</Th>
              <Th>{t("supplier")}</Th>
              <Th>{t("active")}</Th>
              <Th align="right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.products.map((p) => (
              <tr key={p.id}>
                <Td className="font-medium">{p.sku}</Td>
                <Td>{p.name}</Td>
                <Td align="right">{money(p.unitCost)}</Td>
                <Td align="right">{money(p.unitPrice)}</Td>
                <Td align="right">{fmtNum(p.packSize)}</Td>
                <Td>{supplierName(p.primarySupplierId)}</Td>
                <Td>{p.isActive ? t("yes") : t("no")}</Td>
                <Td align="right">
                  <button type="button" className={ghost} onClick={() => setEditProd(p)}>
                    {t("edit")}
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
        <form
          key={editProd?.id ?? "new-prod"}
          action={prodAction}
          className="mt-4 grid items-end gap-3 sm:grid-cols-4 lg:grid-cols-7"
        >
          <input type="hidden" name="id" defaultValue={editProd?.id ?? ""} />
          <div>
            <span className={label}>{t("sku")}</span>
            <input name="sku" defaultValue={editProd?.sku ?? ""} required className={input} />
          </div>
          <div className="lg:col-span-2">
            <span className={label}>{t("name")}</span>
            <input name="name" defaultValue={editProd?.name ?? ""} required className={input} />
          </div>
          <div>
            <span className={label}>{t("unitCost")}</span>
            <input
              name="unitCost"
              type="number"
              step="0.01"
              min="0"
              defaultValue={editProd?.unitCost ?? 0}
              className={input}
            />
          </div>
          <div>
            <span className={label}>{t("unitPrice")}</span>
            <input
              name="unitPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={editProd?.unitPrice ?? 0}
              className={input}
            />
          </div>
          <div>
            <span className={label}>{t("supplier")}</span>
            <select
              name="primarySupplierId"
              defaultValue={editProd?.primarySupplierId ?? ""}
              className={input}
            >
              <option value="">—</option>
              {data.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={editProd?.isActive ?? true}
              />
              {t("active")}
            </label>
          </div>
          <input type="hidden" name="packSize" defaultValue={editProd?.packSize ?? 1} />
          <div className="flex items-center gap-2 sm:col-span-4 lg:col-span-7">
            <button type="submit" disabled={prodPending} className={btn}>
              {editProd ? t("save") : t("add")}
            </button>
            {editProd ? (
              <button type="button" className={ghost} onClick={() => setEditProd(null)}>
                {t("cancel")}
              </button>
            ) : null}
            <Status state={prodState} ok={t("saved")} />
          </div>
        </form>
      </section>
    </div>
  );
}
