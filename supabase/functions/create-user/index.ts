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

    const {
      email,
      password,
      full_name,
      position,
      organizational_unit,
      role_id,
    } = await req.json();

    const requester_id = authUser.id;
    const requester_email = authUser.email;

    if (!email || !password || !full_name || !role_id) {
      return new Response(
        JSON.stringify({ error: "Faltan campos obligatorios: email, password, full_name, role_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 12) {
      return new Response(
        JSON.stringify({ error: "La contraseña debe tener al menos 12 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 0. Verify requester has permission to manage users
    const { data: requesterProfile } = await supabase
      .from("user_profiles")
      .select("role_id")
      .eq("user_id", requester_id)
      .maybeSingle();

    if (!requesterProfile?.role_id) {
      return new Response(
        JSON.stringify({ error: "Usuario no encontrado o sin rol asignado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: reqPerms } = await supabase
      .from("role_permissions")
      .select("permission:permissions(code)")
      .eq("role_id", requesterProfile.role_id);

    const canManageUsers = (reqPerms || []).some((rp) => {
      const p = rp.permission as unknown;
      if (Array.isArray(p) && p.length > 0) return p[0]?.code === "manage_users";
      if (p && typeof p === "object" && "code" in p) return (p as { code: string }).code === "manage_users";
      return false;
    });

    if (!canManageUsers) {
      return new Response(
        JSON.stringify({ error: "No tiene permisos para gestionar usuarios" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (authError) {
      const msg = authError.message || "Error al crear el usuario";
      const isDuplicate = msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered");
      return new Response(
        JSON.stringify({
          error: isDuplicate
            ? "Ya existe un usuario con ese correo electrónico"
            : `No se pudo crear el usuario: ${msg}`,
        }),
        { status: isDuplicate ? 409 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: "No se pudo crear el usuario" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Create user profile
    const { error: profileError } = await supabase.from("user_profiles").insert({
      user_id: authData.user.id,
      full_name,
      email,
      position: position || null,
      organizational_unit: organizational_unit || null,
      role_id,
      status: "active",
      is_active: true,
      force_password_change: true,
      mfa_enabled: false,
      failed_attempts: 0,
      password_changed_at: new Date().toISOString(),
      created_by: requester_id || null,
    });

    if (profileError) {
      // If profile creation fails, try to clean up the auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: `Error al crear el perfil: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Audit log
    await supabase.from("audit_logs").insert({
      action_type: "user_created",
      module: "admin",
      user_id: requester_id || null,
      user_email: requester_email || null,
      affected_record: authData.user.id,
      description: `Usuario creado: ${email}`,
      result: "success",
      metadata: { created_email: email, full_name, role_id },
    });

    return new Response(
      JSON.stringify({ success: true, user_id: authData.user.id }),
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
