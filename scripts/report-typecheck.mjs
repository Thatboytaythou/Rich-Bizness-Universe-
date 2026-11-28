import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.base.json','--noEmit','--pretty','false'],{encoding:'utf8',maxBuffer:16*1024*1024,timeout:120000});const lines=(result.stdout??'').split(/\r?\n/).filter(x=>/error TS\d+:/.test(x));const files=new Map(),codes=new Map();for(const line of lines){const file=line.split('(')[0],code=line.match(/error (TS\d+):/)?.[1]??'unknown';files.set(file,(files.get(file)??0)+1);codes.set(code,(codes.get(code)??0)+1);}
console.log('V1 strict TypeScript diagnostic: '+(result.status===0?'PASS':result.error?'incomplete':'FAIL')+' · '+lines.length+' reported errors');console.log('V1 TypeScript by code: '+JSON.stringify([...codes].sort((a,b)=>b[1]-a[1])));console.log('V1 TypeScript by file: '+JSON.stringify([...files].sort((a,b)=>b[1]-a[1]).slice(0,35)));
for(let i=0;i<lines.length;i+=15)console.log('V1 TypeScript batch '+(i/15+1)+' '+JSON.stringify(lines.slice(i,i+15)));
if(result.error)console.log(String(result.error));if(result.stderr)console.log(result.stderr.slice(0,2000));
// Diagnostic until repository strict errors are fixed; no compiler options suppressed.
