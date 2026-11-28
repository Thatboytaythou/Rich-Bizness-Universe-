import type {CharacterConfig} from './avatar.identity';
// Original lightweight vector portrait; not a rendered 3D model.
export function characterPortrait(config:CharacterConfig):SVGSVGElement{
 const ns='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 96 96');svg.setAttribute('width','64');svg.setAttribute('height','64');svg.setAttribute('aria-hidden','true');svg.dataset.rbPortrait='saved-character';
 const add=(tag:string,attrs:Record<string,string|number>)=>{const node=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));svg.append(node);};
 const l=config.look;
 const skin=({deep:'#70422d',warm:'#a56c48',tan:'#bc8962',light:'#e6b99b',ebony:'#492d24',brown:'#885337',caramel:'#b77a50',olive:'#b39a70'} as Record<string,string>)[l.skin]??'#a56c48';
 const hair=({black:'#171619','dark-brown':'#35241d',brown:'#66402c',blond:'#c5a46a',silver:'#c6c8ce'} as Record<string,string>)[l.hairColor]??'#171619';
 const cloth=({emerald:'#17694b',onyx:'#252830',gold:'#aa8438',ice:'#83b9cb'} as Record<string,string>)[l.color]??'#17694b';
 const eyes=({brown:'#593b2c',hazel:'#827447',blue:'#5488af',green:'#507c51',grey:'#82919a',deepblue:'#324f88',bluegreen:'#438f8c',ice:'#a5d7e6',lightblue:'#8abbd9'} as Record<string,string>)[l.eyes]??'#593b2c';
 add('rect',{width:96,height:96,rx:16,fill:'#10271e'});
 if(['long','braids','bob','bob-classic','ponytail'].includes(l.hair))add('path',{d:'M25 26 Q48 4 71 26 L76 76 H20Z',fill:hair});
 add('path',{d:'M8 96 Q10 76 36 70 L60 70 Q86 76 88 96Z',fill:cloth});
 add('rect',{x:39,y:57,width:18,height:20,rx:5,fill:skin});
 const width=19+Number(l.headWidth)/25;
 add('ellipse',{cx:48,cy:43,rx:width,ry:27,fill:skin});
 if(l.hair!=='bald')add('path',{d:l.hair==='fade'||l.hair==='short-crop'?'M29 34 Q25 10 48 12 Q72 12 67 34 L62 23 Q48 28 34 23Z':'M26 39 Q20 9 48 10 Q76 9 71 39 L60 23 Q45 37 29 28Z',fill:hair});
 for(const x of [40,56]){add('ellipse',{cx:x,cy:42,rx:5,ry:2.8,fill:'#eee2d8'});add('circle',{cx:x,cy:42,r:2.2,fill:eyes});}
 add('path',{d:'M48 44 L46 51 L50 51 M42 59 Q48 62 54 59',fill:'none',stroke:'#38271f','stroke-opacity':0.65,'stroke-width':1.4,'stroke-linecap':'round'});
 if(l.gear.includes('chain'))add('path',{d:'M31 74 Q48 95 65 74',fill:'none',stroke:'#dfbc63','stroke-width':3});
 if(l.gear.includes('shades'))add('path',{d:'M32 38 H64 L61 47 H51 L48 42 L45 47 H35Z',fill:'#171c22'});
 return svg;
}
