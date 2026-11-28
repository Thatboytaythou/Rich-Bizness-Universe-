/** Read-only summary of the bounded receipt list returned to a room owner.
 * Not a balance, lifetime total, or payout authorization. */
type Receipt=Record<string,unknown>;
export function recentPaidReceipts(rows:readonly Receipt[],kind:'tip'|'purchase',streamId:string){
 let count=0,gross=0,creator=0;const seen=new Set<string>();
 for(const row of rows){
  const intent=row.stripe_payment_intent_id;
  if(row.stream_id!==streamId||row.status!=='paid'||row.currency!=='usd'||typeof intent!=='string'||!/^pi_[A-Za-z0-9]+$/.test(intent)||seen.has(intent))continue;
  const paidAt=kind==='tip'?row.paid_at:row.purchased_at;
  if(typeof paidAt!=='string'||!Number.isFinite(Date.parse(paidAt)))continue;
  if(kind==='purchase'&&Number(row.refunded_amount_cents??0)!==0)continue;
  const amount=Number(row.amount_cents),share=Number(row.creator_amount_cents);
  if(row.creator_amount_cents==null||!Number.isSafeInteger(amount)||amount<=0||!Number.isSafeInteger(share)||share<0||share>amount)continue;
  seen.add(intent);count++;gross+=amount;creator+=share;
 }
 return {count,gross,creator};
}
