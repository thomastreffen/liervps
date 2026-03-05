import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Sweep orphaned project references
    const { data: sweepResult } = await supabase.rpc("sweep_orphan_schedule_blocks");

    // 2. Hard-delete blocks soft-deleted more than 30 days ago (optional cleanup)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { count: purgedCount } = await supabase
      .from("schedule_blocks")
      .delete({ count: "exact" })
      .not("deleted_at", "is", null)
      .lt("deleted_at", thirtyDaysAgo);

    return new Response(
      JSON.stringify({
        status: "ok",
        orphans_unlinked: sweepResult?.unlinked ?? 0,
        purged_old_deleted: purgedCount ?? 0,
        ran_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[schedule-sweep-orphans] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
