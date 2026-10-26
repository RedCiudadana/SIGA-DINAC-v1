import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function getUserFromJwt(req: Request): Promise<{ id: string; email: string | null } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const url = `${supabaseUrl}/auth/v1/user`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
    },
  });
  if (!resp.ok) return null;
  const user = await resp.json();
  if (!user?.id) return null;
  return { id: user.id as string, email: user.email ?? null };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authUser = await getUserFromJwt(req);
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: "No autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { confirmation, scope } = await req.json();
    const user_id = authUser.id;
    const user_email = authUser.email;

    if (confirmation !== "RESET_CONFIRMED") {
      return new Response(
        JSON.stringify({ error: "Confirmación requerida. Envíe confirmation: 'RESET_CONFIRMED'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user has reset_database permission (looked up from verified JWT user_id)
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role_id")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!profile?.role_id) {
      return new Response(
        JSON.stringify({ error: "Usuario no encontrado o sin rol asignado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: permCheck } = await supabase
      .from("role_permissions")
      .select("permission:permissions(code)")
      .eq("role_id", profile.role_id);

    const hasResetPerm = (permCheck || []).some((rp) => {
      const p = rp.permission as unknown;
      if (Array.isArray(p) && p.length > 0) return p[0]?.code === "reset_database";
      if (p && typeof p === "object" && "code" in p) return (p as { code: string }).code === "reset_database";
      return false;
    });

    if (!hasResetPerm) {
      // Log the denied attempt
      await supabase.from("audit_logs").insert({
        action_type: "database_reset_denied",
        module: "admin",
        user_id,
        user_email: user_email || null,
        user_role: user_role || null,
        description: "Intento denegado de resetear la base de datos",
        result: "failure",
        metadata: { scope },
      });
      return new Response(
        JSON.stringify({ error: "No tiene permisos para resetear la base de datos" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resetScope = scope || "all"; // "all", "alerts", "processes"
    const tablesCleared: string[] = [];
    let recordsDeleted = 0;

    // Order matters: child tables first (FK constraints)
    if (resetScope === "all" || resetScope === "alerts") {
      // Clear alert-related tables
      await supabase.from("alert_documents").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("alert_comments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("alert_status_history").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("alert_processes").delete().neq("alert_id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("alerts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      tablesCleared.push("alert_documents", "alert_comments", "alert_status_history", "alert_processes", "alerts");
    }

    if (resetScope === "all" || resetScope === "processes") {
      // Clear data quality issues
      await supabase.from("data_quality_issues").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      // Clear procurement processes
      await supabase.from("procurement_processes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      // Clear data uploads
      await supabase.from("data_uploads").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      tablesCleared.push("data_quality_issues", "procurement_processes", "data_uploads");
    }

    // Count remaining records for verification
    const { count: procCount } = await supabase
      .from("procurement_processes").select("id", { count: "exact", head: true });
    const { count: alertCount } = await supabase
      .from("alerts").select("id", { count: "exact", head: true });
    const { count: uploadCount } = await supabase
      .from("data_uploads").select("id", { count: "exact", head: true });

    recordsDeleted = (procCount || 0) === 0 ? recordsDeleted : recordsDeleted;

    // Log the action
    await supabase.from("audit_logs").insert({
      action_type: "database_reset_executed",
      module: "admin",
      user_id,
      user_email: user_email || null,
      user_role: user_role || null,
      description: `Reseteo de base de datos ejecutado. Alcance: ${resetScope}. Tablas limpiadas: ${tablesCleared.join(", ")}`,
      result: "success",
      metadata: {
        scope: resetScope,
        tables_cleared: tablesCleared,
        remaining: { processes: procCount, alerts: alertCount, uploads: uploadCount },
        timestamp: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        scope: resetScope,
        tables_cleared: tablesCleared,
        remaining: {
          processes: procCount || 0,
          alerts: alertCount || 0,
          uploads: uploadCount || 0,
        },
        message: "Base de datos reseteada correctamente. Los datos de usuarios, roles, permisos y catálogos se conservaron.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
