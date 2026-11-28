// Original supplied scene: responsive WebP derivatives, no paid image service.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(resolve(process.env.RB_BROWSER_PREFIX??'.','package.json'));
const sharp=require('sharp');
const source='images/0E886281-8F03-4288-B3CA-C45369B7B58E.png';
const dest='apps/web/public/images/brand';
await mkdir(dest,{recursive:true});
const original=await sharp(source).metadata();
assert.ok(original.width>=1000&&original.height>=650,'Unexpected source artwork');
const variants=[];
for(const [name,width,start,budget] of [['mobile',1080,81,300000],['hd',1920,83,650000],['4k',3840,88,1600000]]){
 let result;
 for(let quality=start;quality>=55;quality-=5){
  result=await sharp(source).resize({width,kernel:'lanczos3'}).sharpen({sigma:0.65,m1:0.6,m2:0.9}).webp({quality,effort:5}).toBuffer({resolveWithObject:true});
  if(result.data.length<=budget)break;
 }
 assert.ok(result.data.length<=budget,'Artwork transfer budget exceeded: '+name);
 const file='rb-universe-'+name+'.webp';
 await writeFile(dest+'/'+file,result.data);
 variants.push({file,width:result.info.width,height:result.info.height,bytes:result.data.length,budget});
}
await writeFile(dest+'/rb-universe-art.json',JSON.stringify({source:source.split('/').pop(),original:{width:original.width,height:original.height},variants}));
console.log('Cinematic universe art: '+JSON.stringify(variants));
