import { z } from "zod";

export const CONDITIONS = ["LABELED", "BLIND"] as const;
export const ConditionSchema = z.enum(CONDITIONS);
export type Condition = z.infer<typeof ConditionSchema>;

export const WEALTH_VISIBILITIES = ["private", "public"] as const;
export const WealthVisibilitySchema = z.enum(WEALTH_VISIBILITIES);
export type WealthVisibility = z.infer<typeof WealthVisibilitySchema>;
export const DEFAULT_WEALTH_VISIBILITY: WealthVisibility = "private";

export const LABEL_MODES = ["true", "swapped"] as const;
export const LabelModeSchema = z.enum(LABEL_MODES);
export type LabelMode = z.infer<typeof LabelModeSchema>;
export const DEFAULT_LABEL_MODE: LabelMode = "true";

export const MONITORINGS = ["standard", "unmonitored"] as const;
export const MonitoringSchema = z.enum(MONITORINGS);
export type Monitoring = z.infer<typeof MonitoringSchema>;
export const DEFAULT_MONITORING: Monitoring = "standard";

/** Body accepted by POST /api/runs (field names validated by createRun in _service.ts). */
export type CreateRunBody = {
  condition: Condition;
  seed: number;
  wealth_visibility: WealthVisibility;
  /** LABELED only; the server rejects "swapped" for BLIND. Omitted means "true". */
  label_mode?: LabelMode;
  /** Omitted means "standard". */
  monitoring?: Monitoring;
};

/** Build a POST body; label_mode is sent only for LABELED runs so BLIND bodies stay valid. */
export function buildRunBody(condition: Condition, seed: number, wealth: WealthVisibility, labelMode: LabelMode, monitoring: Monitoring): CreateRunBody {
  return {
    condition,
    seed,
    wealth_visibility: wealth,
    ...(condition === "LABELED" && labelMode !== DEFAULT_LABEL_MODE ? { label_mode: labelMode } : {}),
    ...(monitoring !== DEFAULT_MONITORING ? { monitoring } : {}),
  };
}

export const SEED_MIN = -2147483648;
export const SEED_MAX = 2147483647;
export const DEFAULT_SEED = 1;

export const CreateRunResponseSchema = z.object({ runId: z.string().min(1) });
export const ApiErrorSchema = z.object({ error: z.string() });

export const RunSummarySchema = z.object({
  id: z.string(),
  condition: z.string(),
  seed: z.number().nullish(),
  status: z.string(),
  round: z.number().nullish(),
  phase: z.string().nullish(),
  mode: z.string().nullish(),
  wealth_visibility: z.string().nullish(),
  label_mode: z.string().nullish(),
  monitoring: z.string().nullish(),
  createdAt: z.union([z.string(), z.number()]).nullish(),
});
export type RunSummary = z.infer<typeof RunSummarySchema>;
export const RunListSchema = z.array(RunSummarySchema);

/** Parse an integer seed string; returns an error message or the value. */
export function parseSeed(raw: string): { ok: true; value: number } | { ok: false; message: string } {
  const text = raw.trim();
  if (!/^-?\d+$/.test(text)) return { ok: false, message: "Seed must be a whole number." };
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < SEED_MIN || value > SEED_MAX) {
    return { ok: false, message: `Seed must be between ${SEED_MIN} and ${SEED_MAX}.` };
  }
  return { ok: true, value };
}

/** Read the `{error}` message from a failed response body, falling back to the status. */
export async function readErrorMessage(res: Response): Promise<string> {
  try {
    const parsed = ApiErrorSchema.safeParse(await res.json());
    if (parsed.success) return parsed.data.error;
  } catch {
    // non-JSON body
  }
  return `Request failed with status ${res.status}.`;
}
