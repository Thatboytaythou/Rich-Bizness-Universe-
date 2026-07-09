import { supabase } from '../../src/supabase-client.js';

export async function listThreadIds(userId) {
  const { data, error } = await supabase.from('dm_thread_members').select('thread_id').eq('user_id', userId).eq('status', 'active').limit(100);
  if (error) throw error;
  return (data || []).map((row) => row.thread_id).filter(Boolean);
}

export async function listThreads(ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('dm_threads').select('*').in('id', ids).order('updated_at', { ascending: false }).limit(80);
  if (error) throw error;
  return data || [];
}

export async function listMessages(threadId) {
  const { data, error } = await supabase.from('dm_messages').select('*').eq('thread_id', threadId).eq('is_deleted', false).order('created_at', { ascending: true }).limit(100);
  if (error) throw error;
  return data || [];
}

export async function createMessage({ thread, user, profile, body }) {
  const { data, error } = await supabase.from('dm_messages').insert({ thread_id: thread.id, sender_id: user.id, username: profile?.username || null, display_name: profile?.display_name || null, body, message_type: 'text', bubble_style: thread?.bubble_theme || 'smoke-cloud', effect_style: 'rich' }).select('*').maybeSingle();
  if (error) throw error;
  await supabase.from('dm_threads').update({ last_message: body, last_message_at: new Date().toISOString(), last_message_user_id: user.id, updated_at: new Date().toISOString() }).eq('id', thread.id);
  return data;
}

export async function markThreadRead({ threadId, messageId, userId }) {
  if (!threadId || !messageId || !userId) return;
  await supabase.from('dm_message_reads').upsert({ message_id: messageId, thread_id: threadId, user_id: userId, read_at: new Date().toISOString() }, { onConflict: 'message_id,user_id' }).then(() => {}, () => {});
  await supabase.from('dm_thread_members').update({ last_read_at: new Date().toISOString() }).eq('thread_id', threadId).eq('user_id', userId).then(() => {}, () => {});
}

export async function reactToMessage({ messageId, userId, emoji = 'SMOKE' }) {
  if (!messageId || !userId) return null;
  const { data, error } = await supabase.from('dm_message_reactions').upsert({ message_id: messageId, user_id: userId, emoji, reaction_style: 'smoke' }, { onConflict: 'message_id,user_id' }).select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function setTyping({ threadId, userId, isTyping }) {
  if (!threadId || !userId) return;
  await supabase.from('dm_typing_status').upsert({ thread_id: threadId, user_id: userId, is_typing: Boolean(isTyping), typing_label: isTyping ? 'rolling smoke...' : '', updated_at: new Date().toISOString() }, { onConflict: 'thread_id,user_id' }).then(() => {}, () => {});
}

export async function startCall({ thread, user }) {
  if (!thread?.id || !user?.id) return null;
  const room = 'rich-dm-' + thread.id.slice(0, 8) + '-' + Date.now().toString(36);
  const { data, error } = await supabase.from('dm_call_sessions').insert({ thread_id: thread.id, started_by: user.id, call_type: 'video', call_status: 'ringing', livekit_room_name: room, call_theme: thread.call_theme || 'Rich Call', visual_style: 'smoke-cloud' }).select('*').maybeSingle();
  if (error) throw error;
  await supabase.from('dm_call_participants').insert({ call_id: data.id, user_id: user.id, role: 'host', status: 'joined' }).then(() => {}, () => {});
  return data;
}

export function watchMessages({ onThreads, onMessages, onTyping }) {
  return supabase.channel('messages-feature-owner').on('postgres_changes', { event: '*', schema: 'public', table: 'dm_threads' }, onThreads).on('postgres_changes', { event: '*', schema: 'public', table: 'dm_thread_members' }, onThreads).on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages' }, onMessages).on('postgres_changes', { event: '*', schema: 'public', table: 'dm_typing_status' }, onTyping || (() => {})).subscribe();
}
