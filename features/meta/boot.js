import { supabase } from '../../src/supabase-client.js';
import './systems.js';

async function bootMetaSystems() {
  const { data } = await supabase
    .from('meta_worlds')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1);
  const world = data?.[0] || null;
  if (world) {
    window.dispatchEvent(new CustomEvent('rb:meta-world-selected', { detail: { world } }));
  }
}

bootMetaSystems();
