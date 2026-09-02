import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = (Deno.env.get("APP_ORIGIN") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
const json = (body: unknown, status = 200, origin = "") => new Response(JSON.stringify(body), { status, headers: { "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] ?? ""), "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Content-Type": "application/json" } });
const PERMISSIONS = new Set(["students.read","attendance.manage","content.read","lessons.manage","assignments.read","assignments.manage","exams.manage","exams.questions","notifications.read","notifications.manage","analytics.read","audit.read"]);

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") ?? "";
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] ?? ""), "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" } });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentication required" }, 401, origin);
  const url = Deno.env.get("SUPABASE_URL"); const anonKey = Deno.env.get("SUPABASE_ANON_KEY"); const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) return json({ error: "Function environment is incomplete" }, 500, origin);
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: { user }, error: userError } = await caller.auth.getUser();
  if (userError || !user) return json({ error: "Invalid authentication" }, 401, origin);
  const { data: callerProfile, error: profileError } = await admin.from("profiles").select("id,role,is_active").eq("id", user.id).maybeSingle();
  if (profileError || !callerProfile || callerProfile.role !== "admin" || !callerProfile.is_active) return json({ error: "Administrator access required" }, 403, origin);
  const body = await req.json().catch(() => null) as { email?: string; password?: string; display_name?: string; permissions?: Record<string, boolean> } | null;
  const email = body?.email?.trim().toLowerCase() ?? ""; const password = body?.password ?? ""; const displayName = body?.display_name?.trim() ?? ""; const requested = body?.permissions ?? {};
  if (!email || !email.includes("@")) return json({ error: "Valid email is required" }, 400, origin);
  if (password.length < 8) return json({ error: "Password must contain at least 8 characters" }, 400, origin);
  if (displayName.length < 2 || displayName.length > 150) return json({ error: "Display name is invalid" }, 400, origin);
  const permissions: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(requested)) { if (value === true && PERMISSIONS.has(key)) permissions[key] = true; }

  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: displayName, account_type: "assistant" } });
  if (createError || !created.user) return json({ error: "Unable to create assistant account" }, 400, origin);
  const userId = created.user.id;
  const { error: profileUpsertError } = await admin.from("profiles").upsert({ id: userId, full_name: displayName, role: "admin", is_active: true });
  if (profileUpsertError) { await admin.auth.admin.deleteUser(userId, false); return json({ error: "Unable to create assistant profile" }, 400, origin); }
  const { error: staffError } = await admin.from("staff_members").insert({ user_id: userId, display_name: displayName, permissions: { permissions }, is_active: true });
  if (staffError) { await admin.auth.admin.deleteUser(userId, false); return json({ error: "Unable to save assistant permissions" }, 400, origin); }
  await admin.from("audit_logs").insert({ actor_id: user.id, action: "create", entity_type: "staff_member", entity_id: userId, metadata: { email, display_name: displayName, permissions } });
  return json({ success: true, id: userId, email, display_name: displayName }, 200, origin);
});
