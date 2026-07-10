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

export async function listProfiles({ userId, search = '' } = {}) {
  let query = supabase.from('profiles').select('id,username,display_name,avatar_url,online_status,rank_title').neq('id', userId).order('display_name', { ascending: true }).limit(40);
  const term = String(search || '').trim();
  if (term) query = query.or(`display_name.ilike.%${term}%,username.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createDirectThread({ userId, profile }) {
  if (!userId || !profile?.id) throw new Error('Choose a profile first.');
  const title = profile.display_name || profile.username || 'Rich-DM';
  const { data: thread, error: threadError } = await supabase.from('dm_threads').insert({
    title,
    thread_type: 'direct',
    created_by: userId,
    metadata: { direct_member_ids: [userId, profile.id] }
  }).select('*').single();
  if (threadError) throw threadError;
  const { error: memberError } = await supabase.from('dm_thread_members').insert([
    { thread_id: thread.id, user_id: userId, role: 'owner', status: 'active' },
    { thread_id: thread.id, user_id: profile.id, role: 'member', status: 'active' }
  ]);
  if (memberError) throw memberError;
  return thread;
}

export async function listMessages(threadId) {
  const { data, error } = await supabase
    .from('dm_messages')
    .select('*, attachments:dm_message_attachments(*), reactions:dm_message_reactions(*), reads:dm_message_reads(*)')
    .eq('thread_id', threadId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return (data || []).map((message) => ({
    ...message,
    reaction_counts: (message.reactions || []).reduce((counts, row) => {
      counts[row.emoji] = (counts[row.emoji] || 0) + 1;
      return counts;
    }, {}),
    read_count: (message.reads || []).length
  }));
}

export async function createMessage({ thread, user, profile, body, messageType = 'text', mediaUrl = null, mediaType = null }) {
  const payload = {
    thread_id: thread.id,
    sender_id: user.id,
    username: profile?.username || null,
    display_name: profile?.display_name || null,
    body,
    media_url: mediaUrl,
    media_type: mediaType,
    message_type: messageType,
    bubble_style: thread?.bubble_theme || 'smoke-cloud',
    effect_style: 'rich'
  };
  const { data, error } = await supabase.from('dm_messages').insert(payload).select('*').maybeSingle();
  if (error) throw error;
  await supabase.from('dm_threads').update({ last_message: body, last_message_at: new Date().toISOString(), last_message_user_id: user.id, updated_at: new Date().toISOString() }).eq('id', thread.id);
  return { ...data, attachments: [], reactions: [], reads: [], reaction_counts: {}, read_count: 0 };
}

export async function markThreadRead({ threadId, messageId, userId }) {
  if (!threadId || !messageId || !userId) return;
  const now = new Date().toISOString();
  const { error } = await supabase.from('dm_message_reads').upsert({ message_id: messageId, thread_id: threadId, user_id: userId, read_at: now }, { onConflict: 'message_id,user_id' });
  if (error) throw error;
  await supabase.from('dm_thread_members').update({ last_read_at: now }).eq('thread_id', threadId).eq('user_id', userId);
}

export async function reactToMessage({ messageId, userId, emoji = '💨' }) {
  if (!messageId || !userId) return null;
  const { data, error } = await supabase.from('dm_message_reactions').upsert({ message_id: messageId, user_id: userId, emoji, reaction_style: 'smoke-burst' }, { onConflict: 'message_id,user_id' }).select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function setTyping({ threadId, userId, isTyping }) {
  if (!threadId || !userId) return;
  const { error } = await supabase.from('dm_typing_status').upsert({ thread_id: threadId, user_id: userId, is_typing: Boolean(isTyping), typing_label: isTyping ? 'rolling smoke...' : '', updated_at: new Date().toISOString() }, { onConflict: 'thread_id,user_id' });
  if (error) throw error;
}

export async function listThreadMembers(threadId) {
  const { data, error } = await supabase.from('dm_thread_members').select('*, profile:profiles(id,username,display_name,avatar_url)').eq('thread_id', threadId).eq('status', 'active');
  if (error) throw error;
  return data || [];
}

export async function listActiveCalls(threadId) {
  const { data, error } = await supabase
    .from('dm_call_sessions')
    .select('*, participants:dm_call_participants(*, profile:profiles(id,username,display_name,avatar_url))')
    .eq('thread_id', threadId)
    .in('call_status', ['ringing', 'active'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function startCall({ thread, user }) {
  if (!thread?.id || !user?.id) return null;
  const room = 'rich-dm-' + thread.id.slice(0, 8) + '-' + Date.now().toString(36);
  const { data, error } = await supabase.from('dm_call_sessions').insert({ thread_id: thread.id, started_by: user.id, call_type: 'video', call_status: 'ringing', livekit_room_name: room, call_theme: thread.call_theme || 'Rich Call', visual_style: 'smoke-cloud' }).select('*').maybeSingle();
  if (error) throw error;
  const members = await listThreadMembers(thread.id);
  const participantRows = members.map((member) => ({
    call_id: data.id,
    user_id: member.user_id,
    role: member.user_id === user.id ? 'host' : 'participant',
    status: member.user_id === user.id ? 'joined' : 'invited',
    joined_at: member.user_id === user.id ? new Date().toISOString() : null
  }));
  if (!participantRows.some((row) => row.user_id === user.id)) participantRows.push({ call_id: data.id, user_id: user.id, role: 'host', status: 'joined', joined_at: new Date().toISOString() });
  const { error: participantError } = await supabase.from('dm_call_participants').upsert(participantRows, { onConflict: 'call_id,user_id' });
  if (participantError) throw participantError;
  return { ...data, participants: participantRows };
}

export function watchMessages({ onThreads, onMessages, onTyping, onCalls }) {
  return supabase.channel('messages-feature-owner')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_threads' }, onThreads)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_thread_members' }, onThreads)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages' }, onMessages)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_message_attachments' }, onMessages)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_message_reactions' }, onMessages)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_message_reads' }, onMessages)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_typing_status' }, onTyping || (() => {}))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_call_sessions' }, onCalls || (() => {}))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_call_participants' }, onCalls || (() => {}))
    .subscribe();
}