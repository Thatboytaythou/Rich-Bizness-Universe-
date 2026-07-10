import { supabase } from '../../src/supabase-client.js';

const DM_BUCKET = 'general-uploads';

function safeName(value = 'attachment') {
  return String(value)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'attachment';
}

function inferType(mime = '', name = '') {
  const value = `${mime} ${name}`.toLowerCase();
  if (value.includes('image')) return 'image';
  if (value.includes('video')) return 'video';
  if (value.includes('audio')) return 'audio';
  return 'file';
}

export async function uploadDmAttachment({ threadId, userId, file }) {
  if (!threadId || !userId || !file) return null;

  const fileName = safeName(file.name || 'attachment');
  const filePath = `messages/${userId}/${threadId}/${Date.now()}-${crypto.randomUUID()}-${fileName}`;
  const { error: uploadError } = await supabase.storage
    .from(DM_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      contentType: file.type || 'application/octet-stream',
      upsert: false
    });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(DM_BUCKET).getPublicUrl(filePath);
  return {
    bucket: DM_BUCKET,
    file_path: filePath,
    file_url: data.publicUrl,
    file_name: file.name || fileName,
    file_type: inferType(file.type, file.name),
    mime_type: file.type || null,
    file_size: Number(file.size || 0),
    metadata: { source: 'rich-dm-upload' }
  };
}

export async function addDmAttachment({ messageId, userId, attachment, url }) {
  const cleanUrl = String(attachment?.file_url || url || '').trim();
  if (!messageId || !userId || !cleanUrl) return null;
  const name = attachment?.file_name || cleanUrl.split('/').pop() || 'Attachment';
  const payload = {
    message_id: messageId,
    user_id: userId,
    file_url: cleanUrl,
    thumbnail_url: attachment?.thumbnail_url || null,
    file_name: name,
    file_type: attachment?.file_type || inferType(attachment?.mime_type, name),
    mime_type: attachment?.mime_type || null,
    file_size: attachment?.file_size || null,
    duration_seconds: attachment?.duration_seconds || 0,
    metadata: {
      ...(attachment?.metadata || {}),
      bucket: attachment?.bucket || null,
      file_path: attachment?.file_path || null
    }
  };

  const { data, error } = await supabase
    .from('dm_message_attachments')
    .insert(payload)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function removeDmAttachment(attachment) {
  const bucket = attachment?.metadata?.bucket;
  const filePath = attachment?.metadata?.file_path;
  if (bucket && filePath) {
    await supabase.storage.from(bucket).remove([filePath]).then(() => {}, () => {});
  }
  if (attachment?.id) {
    const { error } = await supabase.from('dm_message_attachments').delete().eq('id', attachment.id);
    if (error) throw error;
  }
}