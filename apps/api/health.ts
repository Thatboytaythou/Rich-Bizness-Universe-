import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_shared/supabase-admin';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const startedAt = Date.now();

  try {
    const { count, error } = await supabaseAdmin
      .from('route_registry')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    return res.status(200).json({
      ok: true,
      app: 'Rich Bizness Universe',
      services: { api: 'ready', supabase: 'ready' },
      routeRegistryCount: count ?? 0,
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      app: 'Rich Bizness Universe',
      services: { api: 'ready', supabase: 'error' },
      error: error instanceof Error ? error.message : 'Unknown health-check error',
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString()
    });
  }
}
