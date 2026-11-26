import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root='apps/web/src/features/avatar/';
const source=readFileSync(root+'avatar.characters.page.ts','utf8'),css=readFileSync(root+'avatar.characters.css','utf8'),html=readFileSync('apps/web/avatar-characters.html','utf8');
const markup=source.slice(source.indexOf('root.innerHTML='),source.indexOf('  const $=<T extends HTMLElement>'));
const ids=[...markup.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'Duplicate Studio element ID');
for(const key of ['appearance','collections','motion','business']){assert.equal([...markup.matchAll(new RegExp('data-workspace="'+key+'"','g'))].length,1);assert.equal([...markup.matchAll(new RegExp('data-workspace-panel="'+key+'"','g'))].length,1);}
for(const id of ['acEliteView','saveCharacter','acFitStatus','acWorkspace','acCreator','acDesignPublish','acTwinReference','acClaim','acRecordStart','acStill','acShot','acProposedPrice','nameInput','auraInput','randomize','acSaveTop','acSaveEnter'])assert.ok(ids.includes(id),'Missing control '+id);
assert.match(css,/\.ac-layout\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
assert.match(css,/@media\(min-width:1100px\) and \(hover:hover\) and \(pointer:fine\)/);
assert.match(css,/@media\(any-pointer:coarse\)\{\s*body\[data-page="avatar-characters"\] \.ac-shell \.ac-layout\{grid-template-columns:minmax\(0,1fr\)/);
assert.match(html,/width=device-width,initial-scale=1,viewport-fit=cover/);
assert.ok(!html.includes('user-scalable=no'));
console.log('Avatar Studio: four workspaces, unique control IDs, mobile-first layout and viewport verified');
