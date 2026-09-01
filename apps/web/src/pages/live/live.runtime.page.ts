import './live-payment.css';
import { mount as mountLive } from './live.page';
import { mountLivePayments } from './live-payments';

export async function mount():Promise<void>{
  await mountLive();
  mountLivePayments();
}
