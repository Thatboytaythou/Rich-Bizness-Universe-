import { supabase } from './supabase-client.js';
const statusNode=document.querySelector('#metaStatus');
if(statusNode)statusNode.textContent=supabase?'META CONNECTED':'SUPABASE ENV VARIABLES REQUIRED';