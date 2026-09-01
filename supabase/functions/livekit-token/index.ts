import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AccessToken } from "npm:livekit-server-sdk@2.13.3";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const TOKEN_TTL = "10m";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store" }
});

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ ok: false, error: "missing_bearer_token" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const livekitUrl = Deno.env.get("LIVEKIT_URL") ?? "";
    const livekitApiKey = Deno.env.get("LIVEKIT_API_KEY") ?? "";
    const livekitApiSecret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
    if (!supabaseUrl || !publishableKey || !livekitUrl || !livekitApiKey || !livekitApiSecret) {
      return json({ ok: false, error: "livekit_not_configured" }, 503);
    }

    const supabase = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "invalid_or_expired_session" }, 401);

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }

    const roomName = String(body.roomName ?? body.room ?? "").trim();
    if (!roomName || roomName.length > 160) return json({ ok: false, error: "room_required" }, 400);

    const { data: authorization, error: authorizationError } = await supabase.rpc("rb_authorize_livekit_room", {
      p_room_name: roomName
    });
    if (authorizationError || !authorization?.allowed) {
      return json({ ok: false, error: "room_access_denied" }, 403);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name,username,avatar_url,rank_title,rich_level")
      .eq("id", user.id)
      .maybeSingle();

    const role = String(authorization.role ?? "viewer");
    const participantName = String(profile?.display_name ?? profile?.username ?? user.email ?? "Rich Member").slice(0, 128);
    const metadata = JSON.stringify({
      user_id: user.id,
      role,
      room_type: authorization.room_type ?? null,
      resource_id: authorization.resource_id ?? null,
      avatar_url: profile?.avatar_url ?? null,
      rank_title: profile?.rank_title ?? null,
      rich_level: profile?.rich_level ?? 1
    });

    const token = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: user.id,
      name: participantName,
      metadata,
      ttl: TOKEN_TTL
    });
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canSubscribe: authorization.can_subscribe !== false,
      canPublish: authorization.can_publish === true,
      canPublishData: authorization.can_publish_data !== false,
      roomAdmin: role === "host"
    });

    return json({
      ok: true,
      token: await token.toJwt(),
      url: livekitUrl,
      roomName,
      role,
      expiresIn: TOKEN_TTL
    });
  } catch (error) {
    console.error("livekit-token failed", error);
    return json({ ok: false, error: "livekit_token_failed" }, 500);
  }
});
