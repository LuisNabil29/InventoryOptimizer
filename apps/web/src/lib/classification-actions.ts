"use server";

import { setServiceLevels } from "./classification";

export interface ClassificationState {
  status: "idle" | "saved" | "error";
}

export async function saveServiceLevelsAction(
  _prev: ClassificationState,
  formData: FormData,
): Promise<ClassificationState> {
  try {
    const entries: { classificationId: string; serviceLevel: number }[] = [];
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith("sl_")) continue;
      const classificationId = key.slice(3);
      const n = Number(value);
      if (!Number.isFinite(n)) continue;
      const fraction = Math.min(1, Math.max(0, Math.round((n / 100) * 10000) / 10000));
      entries.push({ classificationId, serviceLevel: fraction });
    }
    if (entries.length === 0) return { status: "idle" };
    const ok = await setServiceLevels(entries);
    return { status: ok ? "saved" : "error" };
  } catch {
    return { status: "error" };
  }
}
