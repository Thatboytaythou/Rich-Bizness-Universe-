import type {AnimationAction} from 'three';
// Exclusive transition ownership for each fitted character. Snapshot the effective
// weights before restarting a clip; interrupted fades begin from the actual pose mix.
type Owner={actions:Map<string,AnimationAction>};
type Entry={action:AnimationAction;from:number};
type Blend={entries:Entry[];target:AnimationAction;elapsed:number;duration:number};
const transitions=new WeakMap<Owner,Blend>();
export function captureMotionWeights(owner:Owner){
 const entries:Entry[]=[];const seen=new Set<AnimationAction>();let total=0;
 for(const action of owner.actions.values()){if(seen.has(action))continue;seen.add(action);if(!action.isScheduled())continue;const weight=action.getEffectiveWeight();if(!Number.isFinite(weight)||weight<=.0001){action.stop();continue;}entries.push({action,from:weight});total+=weight;}
 if(total>0)for(const e of entries)e.from/=total;
 return entries;
}
export function beginMotionBlend(owner:Owner,target:AnimationAction,entries:Entry[],duration:number){
 transitions.delete(owner);
 const span=Number.isFinite(duration)?Math.max(0,Math.min(.65,duration)):0;
 if(!span||!entries.length){for(const action of new Set(owner.actions.values()))if(action!==target&&action.isScheduled())action.stop();target.setEffectiveWeight(1);return;}
 if(!entries.some(e=>e.action===target))entries.push({action:target,from:0});
 for(const e of entries){e.action.stopFading();e.action.setEffectiveWeight(e.from);}
 transitions.set(owner,{entries,target,elapsed:0,duration:span});
}
export function tickMotionBlend(owner:Owner,dt:number){
 const blend=transitions.get(owner);if(!blend)return;
 if(Number.isFinite(dt)&&dt>0)blend.elapsed+=Math.min(dt,.075);
 const t=Math.min(1,blend.elapsed/blend.duration),smooth=t*t*(3-2*t);
 for(const e of blend.entries){const w=e.from+(Number(e.action===blend.target)-e.from)*smooth;e.action.setEffectiveWeight(w);}
 if(t===1){for(const e of blend.entries)if(e.action!==blend.target)e.action.stop();transitions.delete(owner);}
}
export function clearMotionBlend(owner:Owner){transitions.delete(owner);}
