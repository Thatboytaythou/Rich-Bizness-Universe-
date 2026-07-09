import { supabase } from '../../src/supabase-client.js';

export async function addDmAttachment({ messageId, userId, url }) {
  const clean = String(url || '').trim();
  if (!messageId || !userId || !clean) return null;
  const name = clean.split('/').pop() || 'Attachment';
  const { data, error } = await supabase
    .from('dm_message_attachments')
    .insert({
      message_id: messageId,
      user_id: userId,
      file_url: clean,
      file_name: name,
      file_type: 'link',
      metadata: { source: 'rich-dm-url' }
    })
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}
