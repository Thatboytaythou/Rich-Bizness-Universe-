import './rich-call.css';
import { mount as mountMessages } from './messages.page';
import { mountRichCall } from './rich-call';

export async function mount():Promise<void>{
  await mountMessages();
  await mountRichCall();
}
