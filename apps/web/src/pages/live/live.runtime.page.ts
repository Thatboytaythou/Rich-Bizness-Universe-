import './live-payment.css';
import { installLiveKitCompatibility } from './livekit-compat';
import { mount as mountLive } from './live.page';
import { mountLivePayments } from './live-payments';

export async function mount():Promise<void>{
  installLiveKitCompatibility();
  await mountLive();
  mountLivePayments();
}
