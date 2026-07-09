const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
const fmt = (value) => Number(value || 0).toLocaleString();

export function installMessagesLayout(root) {
  if (!root || document.querySelector('#dmThreadList')) return;
  root.innerHTML = `
    <section class="dm-shell">
      <section class="dm-list">
        <h2>Threads</h2>
        <div id="dmThreadList" class="cards"><div class="empty">Checking Rich-DM's...</div></div>
      </section>
      <section class="dm-room">
        <h2 id="roomTitle">Select Thread</h2>
        <p id="roomStatus">Open a thread to view messages.</p>
        <div id="dmMessages" class="dm-messages"><div class="empty">No thread selected.</div></div>
        <form id="dmForm" class="dm-compose">
          <input id="dmBody" placeholder="Type Rich-DM..." autocomplete="off" />
          <input id="dmAttachment" placeholder="Attachment URL" autocomplete="off" />
          <button class="primary" type="submit">SEND</button>
          <button type="button" id="dmReact">SMOKE</button>
          <button type="button" id="dmCall">CALL</button>
        </form>
      </section>
    </section>`;
}

export function setDmStatus(text) {
  const status = document.querySelector('#roomStatus');
  if (status) status.textContent = text;
}

export function renderThreads({ threads, activeId }) {
  const list = document.querySelector('#dmThreadList');
  const count = document.querySelector('#recordCount');
  if (count) count.textContent = fmt(threads.length);
  if (!list) return;
  list.innerHTML = threads.length ? threads.map((thread) => {
    const active = thread.id === activeId ? ' active' : '';
    return `<article class="card dm-thread${active}" data-thread-id="${thread.id}"><b>${esc(thread.title || thread.thread_type || 'Rich-DM Thread')}</b><p>${esc(thread.last_message || 'Message thread ready.')}</p><small>${esc(thread.thread_type || 'direct')} • ${thread.is_archived ? 'ARCHIVED' : 'ACTIVE'} • ${esc(thread.dm_brand || 'Rich-DM')}</small></article>`;
  }).join('') : '<div class="empty">No Rich-DM threads yet.</div>';
}

export function renderMessages({ thread, messages, userId }) {
  const title = document.querySelector('#roomTitle');
  const status = document.querySelector('#roomStatus');
  const box = document.querySelector('#dmMessages');
  const messageCount = document.querySelector('#messageCount');
  if (messageCount) messageCount.textContent = fmt(messages.length);
  if (title) title.textContent = thread?.title || thread?.thread_type || 'Rich-DM Thread';
  if (status) status.textContent = thread ? `${thread.dm_brand || 'Rich-DM'} • ${thread.typing_label || 'rolling smoke...'}` : 'Open a thread.';
  if (!box) return;
  box.innerHTML = messages.length ? messages.map((msg) => {
    const attachment = msg.attachments?.length ? `<p>${msg.attachments.map((a) => `<a class="identity-pill" href="${esc(a.file_url)}">${esc(a.file_name || 'Attachment')}</a>`).join(' ')}</p>` : '';
    return `<article class="dm-msg ${msg.sender_id === userId ? 'mine' : ''}"><b>${esc(msg.display_name || msg.username || 'Rich User')}</b><p>${esc(msg.body || '')}</p>${attachment}<small>${esc(msg.message_type || 'text')} • ${new Date(msg.created_at).toLocaleString()}</small></article>`;
  }).join('') : '<div class="empty">No messages in this thread yet.</div>';
  box.scrollTop = box.scrollHeight;
}
