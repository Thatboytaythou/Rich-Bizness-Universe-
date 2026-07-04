import { AccessToken } from "npm:livekit-server-sdk@^2";
import { createClient } from "npm:@supabase/supabase-js@^2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Missing bearer token" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const livekitUrl = Deno.env.get("LIVEKIT_URL");
    const livekitApiKey = Deno.env.get("LIVEKIT_API_KEY");
    const livekitApiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    if (!supabaseUrl || !supabaseAnonKey || !livekitUrl || !livekitApiKey || !livekitApiSecret) return json({ error: "Missing function secrets" }, 500);
    const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);
    const body = await req.json();
    const room = String(body?.room ?? "").trim();
    const role = String(body?.role ?? "audience").trim();
    if (!room) return json({ error: "Missing room" }, 400);
    const token = new AccessToken(livekitApiKey, livekitApiSecret, { identity: String(body?.identity || authData.user.id), name: String(body?.name || authData.user.email || "Rich Bizness User"), ttl: "15m" });
    token.addGrant({ roomJoin: true, room, canSubscribe: true, canPublish: role === "host", canPublishData: true });
    return json({ token: await token.toJwt(), livekitUrl });
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});
