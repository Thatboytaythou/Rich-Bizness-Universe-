const esc=(v)=>String(v??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmt=(v)=>Number(v||0).toLocaleString();

export function installMessagesLayout(root){
  if(!root||document.querySelector('#dmThreadList'))return;
  root.innerHTML=`
    <section class="dm-app" id="dmApp">
      <aside class="dm-inbox">
        <div class="dm-inbox-head">
          <div><small>PRIVATE MESSAGES</small><h2>Rich DMs</h2></div>
          <button type="button" id="dmNew" aria-label="Start a new conversation">＋</button>
        </div>
        <div id="dmThreadList" class="dm-thread-list"><div class="dm-loading">Loading conversations…</div></div>
      </aside>

      <section class="dm-chat">
        <header class="dm-chat-head">
          <button type="button" id="dmBack" class="dm-back" aria-label="Back to conversations">‹</button>
          <div class="dm-chat-title"><h2 id="roomTitle">Messages</h2><p id="roomStatus">Choose a conversation</p></div>
          <button type="button" id="dmCall" class="dm-call" disabled>CALL</button>
        </header>

        <div id="dmCallPanel" class="dm-call-panel"></div>
        <div id="dmMessages" class="dm-messages">
          <div class="dm-welcome"><span>RB</span><b>Your private conversations live here.</b><small>Tap NEW to message somebody.</small></div>
        </div>

        <form id="dmForm" class="dm-compose">
          <label class="dm-attach" aria-label="Attach a file">＋<input id="dmAttachmentFile" type="file" disabled></label>
          <input id="dmBody" class="dm-body" placeholder="Message…" autocomplete="off" disabled>
          <button class="dm-send" type="submit" disabled aria-label="Send message">➤</button>
          <input id="dmAttachment" class="dm-url" placeholder="Paste attachment URL" autocomplete="off" disabled>
        </form>
      </section>
    </section>

    <dialog id="dmNewDialog" class="dm-new-dialog">
      <div class="dm-dialog-head"><div><small>RICH DMS</small><h2>New conversation</h2></div><button type="button" data-close-new>✕</button></div>
      <input id="dmProfileSearch" type="search" placeholder="Search people" autocomplete="off">
      <div id="dmProfileList" class="dm-profile-list"><div class="dm-loading">Loading people…</div></div>
    </dialog>

    <dialog id="dmAttachmentViewer" class="dm-viewer">
      <button type="button" data-close-viewer>CLOSE</button><div id="dmViewerBody"></div>
    </dialog>`;
}

export function setDmStatus(text){const n=document.querySelector('#roomStatus');if(n)n.textContent=text;}
export function setComposerEnabled(enabled){document.querySelectorAll('#dmForm input,#dmForm button,#dmCall').forEach((el)=>{el.disabled=!enabled;});}
export function setConversationView(open){document.querySelector('#dmApp')?.classList.toggle('chat-open',Boolean(open));}

export function renderProfiles(profiles=[]){
  const list=document.querySelector('#dmProfileList');if(!list)return;
  list.innerHTML=profiles.length?profiles.map((p)=>`<button class="dm-profile" type="button" data-profile-id="${p.id}" data-profile-name="${esc(p.display_name||p.username||'Rich User')}"><img src="${esc(p.avatar_url||'/images/brand/Avatar-hero-Banner.png.jpeg')}" alt=""><span><b>${esc(p.display_name||p.username||'Rich User')}</b><small>@${esc(p.username||'member')} · ${esc(p.online_status||'offline')}</small></span><i>›</i></button>`).join(''):'<div class="dm-empty-compact">No profiles found.</div>';
}

export function renderThreads({threads,activeId}){
  const list=document.querySelector('#dmThreadList');const count=document.querySelector('#recordCount');if(count)count.textContent=fmt(threads.length);if(!list)return;
  list.innerHTML=threads.length?threads.map((t)=>`<button class="dm-thread${t.id===activeId?' active':''}" type="button" data-thread-id="${t.id}"><span class="dm-thread-avatar">${esc((t.title||'R').slice(0,1).toUpperCase())}</span><span class="dm-thread-copy"><b>${esc(t.title||'Rich-DM')}</b><small>${esc(t.last_message||'Start the conversation.')}</small></span><time>${t.last_message_at?new Date(t.last_message_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):''}</time></button>`).join(''):'<div class="dm-empty-inbox"><span>💬</span><b>No conversations yet</b><small>Tap the plus button to start one.</small></div>';
}

function attachmentHtml(a){const type=String(a.file_type||a.mime_type||'file');const preview=type.includes('image')?`<img src="${esc(a.file_url)}" alt="${esc(a.file_name||'Attachment')}">`:type.includes('video')?`<video src="${esc(a.file_url)}" controls preload="metadata"></video>`:type.includes('audio')?`<audio src="${esc(a.file_url)}" controls preload="metadata"></audio>`:`<span class="dm-file-icon">FILE</span>`;return `<button class="dm-attachment" type="button" data-view-attachment data-url="${esc(a.file_url)}" data-type="${esc(type)}" data-name="${esc(a.file_name||'Attachment')}">${preview}<b>${esc(a.file_name||'Attachment')}</b></button>`;}

export function renderMessages({thread,messages,userId}){
  const title=document.querySelector('#roomTitle'),status=document.querySelector('#roomStatus'),box=document.querySelector('#dmMessages'),messageCount=document.querySelector('#messageCount');
  if(messageCount)messageCount.textContent=fmt(messages.length);if(title)title.textContent=thread?.title||'Messages';if(status)status.textContent=thread?(thread.typing_label||'Rich-DM ready'):'Choose a conversation';if(!box)return;
  box.innerHTML=thread?(messages.length?messages.map((msg)=>{const attachments=(msg.attachments||[]).map(attachmentHtml).join('');const reactions=Object.entries(msg.reaction_counts||{}).map(([emoji,count])=>`<span>${esc(emoji)} ${fmt(count)}</span>`).join('');return `<article class="dm-msg ${msg.sender_id===userId?'mine':''}" data-message-id="${msg.id}"><div class="dm-bubble"><p>${esc(msg.body||'')}</p>${attachments?`<div class="dm-attachments">${attachments}</div>`:''}<small>${new Date(msg.created_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}${msg.sender_id===userId?` · Read ${fmt(msg.read_count)}`:''}</small></div><div class="dm-reactions"><button type="button" data-react="💨">💨</button><button type="button" data-react="🔥">🔥</button><button type="button" data-react="💸">💸</button>${reactions}</div></article>`;}).join(''):'<div class="dm-welcome"><span>👋</span><b>Conversation ready</b><small>Send the first Rich-DM.</small></div>'):'<div class="dm-welcome"><span>RB</span><b>Your private conversations live here.</b><small>Choose a thread or tap NEW.</small></div>';
  box.scrollTop=box.scrollHeight;
}

export function renderCallParticipants(calls=[]){const panel=document.querySelector('#dmCallPanel');if(!panel)return;const call=calls[0];if(!call){panel.innerHTML='';return;}panel.innerHTML=`<div class="dm-call-card"><div><b>${esc(call.call_theme||'Rich Call')}</b><small>${esc(call.call_status||'ringing')} · ${esc(call.call_type||'video')}</small></div><div class="dm-participants">${(call.participants||[]).map((p)=>`<span><img src="${esc(p.profile?.avatar_url||'/images/brand/Avatar-hero-Banner.png.jpeg')}" alt=""><b>${esc(p.profile?.display_name||p.profile?.username||'Participant')}</b></span>`).join('')}</div></div>`;}
export function openAttachmentViewer({url,type,name}){const dialog=document.querySelector('#dmAttachmentViewer'),body=document.querySelector('#dmViewerBody');if(!dialog||!body)return;const safe=esc(url);body.innerHTML=String(type).includes('image')?`<img src="${safe}" alt="${esc(name)}">`:String(type).includes('video')?`<video src="${safe}" controls autoplay></video>`:String(type).includes('audio')?`<audio src="${safe}" controls autoplay></audio>`:`<a href="${safe}" target="_blank" rel="noopener">OPEN ${esc(name||'ATTACHMENT')}</a>`;dialog.showModal();}