import { supabase } from '../../supabase-client.js';

const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));

export async function loadDmThreads(userId) {
  const members = await supabase
    .from('dm_thread_members')
    .select('thread_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(100);

  if (members.error) throw members.error;

  const ids = (members.data || []).map((row) => row.thread_id).filter(Boolean);
  if (!ids.length) return { threads: [], memberRows: 0 };

  const { data, error } = await supabase
    .from('dm_threads')
    .select('*')
    .in('id', ids)
    .order('updated_at', { ascending: false })
    .limit(60);

  if (error) throw error;
  return { threads: data || [], memberRows: ids.length };
}

export async function loadThreadMessages(threadId) {
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

export async function markThreadRead({ threadId, userId, messageId }) {
  if (!threadId || !userId || !messageId) return;
  await supabase.from('dm_message_reads').upsert({
    thread_id: threadId,
    user_id: userId,
    message_id: messageId,
    read_at: new Date().toISOString(),
  }, { onConflict: 'message_id,user_id' }).then(() => {}, () => {});

  await supabase
    .from('dm_thread_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .then(() => {}, () => {});
}

export function renderThreadCard(thread, isActive = false) {
  return `<article class="card dm-thread ${isActive ? 'active' : ''}" data-thread-id="${esc(thread.id)}">
    <b>${esc(thread.title || thread.thread_type || 'Rich-DM Thread')}</b>
    <p>${esc(thread.last_message || 'Message thread ready.')}</p>
    <small>${esc(thread.thread_type || 'direct')} • ${thread.is_archived ? 'ARCHIVED' : 'ACTIVE'} • ${esc(thread.dm_brand || 'Rich-DM’s')}</small>
  </article>`;
}

export function renderMessage(message, userId) {
  return `<article class="dm-message ${message.sender_id === userId ? 'mine' : ''}" data-message-id="${esc(message.id)}">
    <b>${esc(message.display_name || message.username || 'Rich User')}</b>
    <p>${esc(message.body || '')}</p>
    ${message.media_url ? `<a class="identity-pill" href="${esc(message.media_url)}">Attachment</a>` : ''}
    <small>${esc(message.message_type || 'text')} • ${message.created_at ? new Date(message.created_at).toLocaleString() : 'now'}</small>
  </article>`;
}
