import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const baseline=JSON.parse(readFileSync(new URL('./strict-typecheck-baseline.json',import.meta.url),'utf8'));
const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.base.json','--noEmit','--pretty','false'],{encoding:'utf8',maxBuffer:16*1024*1024,timeout:120000});
const lines=(result.stdout??'').split(/\r?\n/).filter(x=>/error TS\d+:/.test(x));const files=new Map(),codes=new Map();
for(const line of lines){const file=line.split('(')[0],code=line.match(/error (TS\d+):/)?.[1]??'unknown';files.set(file,(files.get(file)??0)+1);codes.set(code,(codes.get(code)??0)+1);}
const complete=!result.error&&!result.signal&&(result.status===0||((result.status===1||result.status===2)&&lines.length>0));
console.log('V1 strict TypeScript diagnostic: '+(!complete?'incomplete':result.status===0?'PASS':'FAIL')+' · '+lines.length+' reported errors');
console.log('V1 TypeScript by code: '+JSON.stringify([...codes].sort((a,b)=>b[1]-a[1])));
const ordered=[...files].sort((a,b)=>b[1]-a[1]);for(let i=0;i<ordered.length;i+=8)console.log('V1 TypeScript files '+(i/8+1)+' '+JSON.stringify(ordered.slice(i,i+8)));
for(let i=0;i<lines.length;i++)console.log('V1 TS diagnostic '+(i+1)+' '+lines[i]);
if(result.error)console.error(String(result.error));if(result.stderr)console.error(result.stderr.slice(0,2000));
if(!complete||!Number.isSafeInteger(baseline.maxErrors)||baseline.maxErrors<0||lines.length>baseline.maxErrors||(result.status===0&&lines.length!==0)){console.error('V1 production blocked: incomplete compiler or regression against measured ceiling '+baseline.maxErrors);process.exit(1);}
console.log('V1 production compiler regression gate: '+lines.length+' / '+baseline.maxErrors+' maximum; '+(lines.length===0?'strict clean':'existing debt remains — NOT strict clean'));
// Reduce the measured ceiling after each verified improvement. Final acceptance requires zero.
