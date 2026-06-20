import { withTenant } from "./prisma";
import { getCurrentTenantId } from "./tenant";

export interface ClassView {
  id: string;
  code: string;
  name: string;
  serviceLevel: number | null;
  productCount: number;
}

export interface SchemeView {
  id: string;
  code: string;
  name: string;
  kind: string;
  classes: ClassView[];
}

export interface ClassificationData {
  defaultServiceLevel: number;
  schemes: SchemeView[];
}

export async function getClassifications(): Promise<ClassificationData | null> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;
  return withTenant(tenantId, async (tx) => {
    const [settings, schemes, classes, policies, counts] = await Promise.all([
      tx.tenantSettings.findUnique({ where: { tenantId } }),
      tx.classificationScheme.findMany({ orderBy: { createdAt: "asc" } }),
      tx.classification.findMany({ orderBy: { code: "asc" } }),
      tx.serviceLevelPolicy.findMany({ where: { classificationId: { not: null } } }),
      tx.productClassification.groupBy({
        by: ["classificationId"],
        _count: { _all: true },
      }),
    ]);

    const slByClass = new Map<string, number>();
    for (const p of policies) {
      if (p.classificationId) slByClass.set(p.classificationId, Number(p.serviceLevel));
    }
    const countByClass = new Map<string, number>(
      counts.map((c) => [c.classificationId, c._count._all]),
    );

    return {
      defaultServiceLevel: Number(settings?.defaultServiceLevel ?? 0.95),
      schemes: schemes.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        kind: s.kind,
        classes: classes
          .filter((c) => c.schemeId === s.id)
          .map((c) => ({
            id: c.id,
            code: c.code,
            name: c.name,
            serviceLevel: slByClass.has(c.id) ? slByClass.get(c.id)! : null,
            productCount: countByClass.get(c.id) ?? 0,
          })),
      })),
    };
  });
}

/** Upsert manual del nivel de servicio por clase (no hay unique en la tabla). */
export async function setServiceLevels(
  entries: { classificationId: string; serviceLevel: number }[],
): Promise<boolean> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return false;
  await withTenant(tenantId, async (tx) => {
    for (const { classificationId, serviceLevel } of entries) {
      const updated = await tx.serviceLevelPolicy.updateMany({
        where: { classificationId },
        data: { serviceLevel },
      });
      if (updated.count === 0) {
        await tx.serviceLevelPolicy.create({
          data: { tenantId, classificationId, serviceLevel },
        });
      }
    }
  });
  return true;
}
