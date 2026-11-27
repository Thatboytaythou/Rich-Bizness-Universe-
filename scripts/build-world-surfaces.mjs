import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const assets={'asphalt_02_diff':'accfd7160a9736a7bb90ea55a86cae585bf4126a','asphalt_02_nor':'4004e0a920b59f78b85a941ebddbc9d1581b1ced','brick_wall_001_diff':'3e4320ba1493faf6acc7106601a65f77716928df','concrete_wall_008_diff':'87c55b01dcf530d70215bdf2efee99ac341cefe1'};
const out='apps/web/public/world-surfaces';mkdirSync(out,{recursive:true});const manifest=[];
for(const [name,expected] of Object.entries(assets)){
 const bytes=Buffer.from(readFileSync('assets/world-surface-source/'+name+'.jpg.b64','utf8').trim(),'base64');
 const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 if(sha!==expected||bytes[0]!==255||bytes[1]!==216||bytes.length>1500000)throw Error('World texture integrity failure: '+name);
 writeFileSync(out+'/'+name+'.jpg',bytes);manifest.push({name,bytes:bytes.length,gitBlob:sha,license:'CC0-1.0',source:'https://polyhaven.com/a/'+name.replace(/_(diff|nor)$/,'')});
}
writeFileSync(out+'/manifest.json',JSON.stringify({release:'V28',assets:manifest},null,2));console.log('V28 photographic surface assets verified: '+manifest.length);
