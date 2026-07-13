import { supabaseAdmin } from './_shared/supabase-admin';

type ApiResponse = {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): void;
  json(payload: unknown): unknown;
};

export default async function handler(_req: unknown, res: ApiResponse) {
  const startedAt = Date.now();
  res.setHeader('Cache-Control', 'no-store');

  const livekitConfigured = Boolean(
    process.env.LIVEKIT_URL &&
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET
  );

  try {
    const [{ count: routeCount, error: routeError }, { count: profileCount, error: profileError }] = await Promise.all([
      supabaseAdmin.from('route_registry').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true })
    ]);

    if (routeError) throw routeError;
    if (profileError) throw profileError;

    return res.status(200).json({
      ok: true,
      app: 'Rich Bizness Universe',
      canonicalUrl: process.env.APP_URL ?? 'https://rich-bizness.com',
      services: {
        api: 'ready',
        supabase: 'ready',
        livekit: livekitConfigured ? 'ready' : 'configuration_required'
      },
      supabase: {
        url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
        routeRegistryCount: routeCount ?? 0,
        profileCount: profileCount ?? 0
      },
      livekit: {
        url: process.env.LIVEKIT_URL ?? null,
        tokenEndpoint: '/api/livekit/token'
      },
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      app: 'Rich Bizness Universe',
      services: {
        api: 'ready',
        supabase: 'error',
        livekit: livekitConfigured ? 'ready' : 'configuration_required'
      },
      error: error instanceof Error ? error.message : 'Unknown health-check error',
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString()
    });
  }
}
