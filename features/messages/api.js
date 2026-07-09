import { supabase } from '../../src/supabase-client.js';

export async function listThreadIds(userId) {
  const { data, error } = await supabase
    .from('dm_thread_members')
    .select('thread_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(100);
  if (error) throw error;
  return (data || []).map((row) => row.thread_id).filter(Boolean);
}

export async function listThreads(ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('dm_threads')
    .select('*')
    .in('id', ids)
    .order('updated_at', { ascending: false })
    .limit(80);
  if (error) throw error;
  return data || [];
}

export async function listMessages(threadId) {
  const { data, error } = await supabase
    .from('dm_messages')
    .select('*')
    .eq('thread_id', threadId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return data || [];
}

export async function createMessage({ thread, user, profile, body }) {
  const { data, error } = await supabase
    .from('dm_messages')
    .insert({
      thread_id: thread.id,
      sender_id: user.id,
      username: profile?.username || null,
      display_name: profile?.display_name || null,
      body,
      message_type: 'text',
      bubble_style: thread?.bubble_theme || 'smoke-cloud',
      effect_style: 'rich'
    })
    .select('*')
    .maybeSingle();
  if (error) throw error;
  await supabase
    .from('dm_threads')
    .update({
      last_message: body,
      last_message_at: new Date().toISOString(),
      last_message_user_id: user.id,
      updated_at: new Date().toISOString()
    })
    .eq('id', thread.id);
  return data;
}

export function watchMessages({ onThreads, onMessages }) {
  return supabase.channel('messages-feature-owner')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_threads' }, onThreads)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_thread_members' }, onThreads)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages' }, onMessages)
    .subscribe();
}
