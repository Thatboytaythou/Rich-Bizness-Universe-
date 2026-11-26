import '../../styles/tokens.css';
import '../../styles/base.css';
import '../../styles/cinematic.css';
import '../../styles/identity.css';
import '../../styles/media-containment.css';
import { bootstrap } from '../../bootstrap';

// Access is a separate entry point: no XP, portal or feature runtime startup.
document.body.dataset.rbAccessRelease='rich-id-isolated-3';
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
void bootstrap().catch(()=>{
  const panel=document.getElementById('rb-access-startup');
  if(panel){panel.hidden=false;const status=panel.querySelector('[role=status]');if(status)status.textContent='Access screen could not start. Reload the gateway.';}
});
