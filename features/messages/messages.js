import { supabase } from '../../src/supabase-client.js';
import { getAuthoritativeIdentity } from '../../src/rb-identity.js?v=profile-avatar-separate-1';

export const messagesFeature = {
  key: 'messages',
  status: 'imports-ready'
};

window.RB_MESSAGES = { key: 'messages' };
console.log('[RB] Messages feature imports ready', Boolean(supabase), Boolean(getAuthoritativeIdentity));
