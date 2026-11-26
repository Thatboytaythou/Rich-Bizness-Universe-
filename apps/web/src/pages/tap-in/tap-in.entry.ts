import '../../styles/tokens.css';
import '../../styles/base.css';
import './tap-in.elite.css';
import { bootstrap } from '../../bootstrap';

// Access is a separate entry point: no XP, portal or feature runtime startup.
document.body.dataset.rbAccessRelease='rich-id-single-layer-4';
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
void bootstrap().catch(()=>{
  const app=document.getElementById('app');
  if(app&&!app.querySelector('.auth-shell')){const section=document.createElement('section');section.id='rb-access-startup';const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Access screen could not start. Reload the gateway.';const reload=document.createElement('a');reload.href='';reload.textContent='Reload Tap In';section.append(status,reload);app.replaceChildren(section);}
});
