// One owner for explicit facial expression and automatic idle / motion moods.
// Pure state: no extra timers, rigs, materials or stored identity data.
export function createExpressionControl<T extends string>(neutral:T){
 let value=neutral,strength=1,manual=false;
 const bounded=(v:number)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):1;
 return {
  selected:()=>({value,strength,manual}),
  select:(next:T,amount=1)=>{value=next;strength=bounded(amount);manual=true;},
  automatic:(next:T,amount=1)=>{if(manual)return false;value=next;strength=bounded(amount);return true;},
  release:()=>{manual=false;value=neutral;strength=1;},
  apply:(set:((value:T,strength:number)=>void)|undefined)=>{set?.(value,strength);}
 };
}
