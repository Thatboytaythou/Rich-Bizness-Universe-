import { getSupabase, getSessionState } from "./supabase.js";

export const emptyIdentity = Object.freeze({
  signedIn: false,
  userId: "",
  displayName: "",
  username: "",
  avatarUrl: "",
  rank: "",
  level: 0,
  points: 0
});

export async function loadIdentity() {
  const { user } = await getSessionState();
  if (!user?.id) return { ...emptyIdentity };

  const supabase = getSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, rank_title, rich_level, rich_points")
    .eq("id", user.id)
    .maybeSingle();

  return {
    signedIn: true,
    userId: user.id,
    displayName: data?.display_name || user.user_metadata?.display_name || "",
    username: data?.username || "",
    avatarUrl: data?.avatar_url || "",
    rank: data?.rank_title || "",
    level: Number(data?.rich_level || 0),
    points: Number(data?.rich_points || 0)
  };
}
