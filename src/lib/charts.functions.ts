import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { themeSchema } from "@/lib/theme";

const dataSchema = z.object({
  title: z.string().max(200),
  cols: z.number().int().min(1).max(10),
  rows: z.number().int().min(1).max(10),
  showNames: z.boolean(),
  cells: z.array(z.any()).max(100),
  // Invalid or tampered theme data falls back to the default instead of rejecting the save.
  theme: themeSchema.optional().catch(undefined),
});

export const createChart = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ data: dataSchema }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("charts").insert({ data: data.data }).select("id, edit_token").single();
    if (error) throw new Error(error.message);
    return { id: row.id, token: row.edit_token };
  });

export const saveChart = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), token: z.string().uuid(), data: dataSchema }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("charts")
      .update({ data: data.data, updated_at: new Date().toISOString() })
      .eq("id", data.id).eq("edit_token", data.token).select("id");
    if (error) throw new Error(error.message);
    return { ok: (rows?.length ?? 0) > 0 };
  });

export const getChart = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("charts").select("data").eq("id", data.id).maybeSingle();
    return row ? (row.data as any) : null;
  });
