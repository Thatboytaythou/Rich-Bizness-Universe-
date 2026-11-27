// Static mobile exterior LOD from the hash-pinned GLB; preserve transforms and materials.
// Deliberate removals: hidden suspension/engine detail and then secondary trim, not random triangles.
const hidden=/(?:Lower_Control_Arm|Upper_Control_Arm|Toe_Link|Damper(?:_Cap)?|Coil_Spring_|Brake_Line|Subframe|Engine_Bay_|Engine_Intake_|Engine_Turbo_|Radiator_Fin_|Front_Radiator_Core)/i;
const fine=/(?:Sidewall_Bead|Brake_Hat|Brake_Disc|Tire_Block_|Hub_Cap|Roof_Trim_|Shoulder_Line|Lower_Sculpt_Line|Intake_Strake_|Dash_Vent_|Wheel_Spoke_|Shoulder_Belt|Digital_Gauge_|Door_Accent_|Diffuser_Fin_|Front_Grille_Bar_)/i;
const cockpit=/(?:Center_Tunnel|Center_Display|Dashboard_Accent|Seat_Bolster_|Headrest|Shift_Selector|Door_Panel_|Rear_View_Mirror|Steering_Wheel|^Wheel_Hub)/i;
export function compactMobileVehicle(bytes,json){
 if(json.images?.length||json.skins?.length||json.buffers?.length!==1)throw Error('Mobile exterior requires self-contained untextured static geometry');
 const j=structuredClone(json),binStart=20+bytes.readUInt32LE(12)+8;
 if(bytes.readUInt32LE(binStart-4)!==0x004e4942)throw Error('Invalid GLB binary chunk');
 const bin=bytes.subarray(binStart),name=n=>String(n.name??j.meshes[n.mesh]?.name??'');
 const counts=()=>{let triangles=0,primitives=0;for(const n of j.nodes??[]){if(n.mesh===undefined)continue;for(const p of j.meshes[n.mesh].primitives){triangles+=j.accessors[p.indices??p.attributes.POSITION].count/3;primitives++;}}return {triangles,primitives};};
 const removed=[];
 for(const pattern of [hidden,fine,cockpit]){for(const n of j.nodes??[]){if(n.mesh!==undefined&&pattern.test(name(n))){removed.push(name(n));delete n.mesh;}}if(counts().triangles<=85000)break;}
 // Secondary exterior accessories may be dropped in priority order, but never primary body, glazing, wheels or lights.
 const essential=/^(?:BODY_Shell_Hero|CABIN_Roof_Shell|Front_Windshield|Rear_Windshield|Panoramic_Roof_Glass|[LR]_Glass_|(?:Front|Rear)_(?:Left|Right)_(?:Tire(?:\.|$)|Rim_Base)|Headlight_(?:Housing|Main)|Tail_Light_(?:Housing|Bar)|Hood_Center_Panel|Front_Grille_Deep|Active_Wing_Blade|Rear_Diffuser|Front_Splitter|Aero_Undertray)/i;
 const nodeTriangles=n=>j.meshes[n.mesh].primitives.reduce((sum,p)=>sum+j.accessors[p.indices??p.attributes.POSITION].count/3,0);
 const lowerPriority=n=>/(?:Fender_Lip|Brake_Caliper|Seat_|Wheel_Hub|Mirror_Stalk|Hood_Vent_|Wing_Endplate_|Wing_Post_|Exhaust_Inner_|Headlight_LED_|Tail_Light_Accent_)/i.test(name(n))?0:1;
 if(counts().triangles>85000){let total=counts().triangles;const extras=j.nodes.filter(n=>n.mesh!==undefined&&!essential.test(name(n))).sort((a,b)=>lowerPriority(a)-lowerPriority(b)||nodeTriangles(b)-nodeTriangles(a));for(const n of extras){if(total<=85000)break;total-=nodeTriangles(n);removed.push(name(n));delete n.mesh;}}
 const metrics=counts();if(!metrics.triangles||metrics.triangles>85000)throw Error('Mobile exterior still exceeds budget: '+metrics.triangles);
 const names=j.nodes.filter(n=>n.mesh!==undefined).map(name);
 for(const key of ['BODY_Shell_Hero','CABIN_Roof_Shell','Front_Windshield','Rear_Windshield','Front_Left_Tire','Front_Right_Tire','Rear_Left_Tire','Rear_Right_Tire','Front_Left_Rim_Base','Front_Right_Rim_Base','Rear_Left_Rim_Base','Rear_Right_Rim_Base'])if(!names.some(n=>n===key||n.startsWith(key+'.')))throw Error('Mobile exterior missing '+key);
 // Prune unused meshes, accessors and binary views. Keep node hierarchy and material indices stable.
 delete j.animations;
 const remap=(array,used)=>{const map=new Map(),items=[];for(const index of [...used].sort((a,b)=>a-b)){if(!array[index])throw Error('Invalid source index');map.set(index,items.length);items.push(array[index]);}return {map,items};};
 const meshes=remap(j.meshes,new Set(j.nodes.filter(n=>n.mesh!==undefined).map(n=>n.mesh)));for(const n of j.nodes)if(n.mesh!==undefined)n.mesh=meshes.map.get(n.mesh);j.meshes=meshes.items;
 const needed=new Set();for(const mesh of j.meshes)for(const p of mesh.primitives){if(p.extensions||p.targets?.length)throw Error('Unexpected mobile mesh extension');if(p.indices!==undefined)needed.add(p.indices);for(const a of Object.values(p.attributes))needed.add(a);}
 const accessors=remap(j.accessors,needed);for(const mesh of j.meshes)for(const p of mesh.primitives){if(p.indices!==undefined)p.indices=accessors.map.get(p.indices);for(const k of Object.keys(p.attributes))p.attributes[k]=accessors.map.get(p.attributes[k]);}j.accessors=accessors.items;
 if(j.accessors.some(a=>a.sparse||a.bufferView===undefined))throw Error('Unexpected sparse mobile accessor');
 const views=remap(j.bufferViews,new Set(j.accessors.map(a=>a.bufferView)));for(const a of j.accessors)a.bufferView=views.map.get(a.bufferView);j.bufferViews=views.items;
 const chunks=[];let offset=0;for(const view of j.bufferViews){if(view.buffer!==0||view.extensions)throw Error('Unexpected mobile buffer view');const start=view.byteOffset??0;const slice=bin.subarray(start,start+view.byteLength);if(slice.length!==view.byteLength)throw Error('Truncated buffer view');view.byteOffset=offset;chunks.push(slice);offset+=slice.length;const padding=(4-offset%4)%4;if(padding){chunks.push(Buffer.alloc(padding));offset+=padding;}}
 const packed=Buffer.concat(chunks);j.buffers=[{byteLength:packed.length}];
 const raw=Buffer.from(JSON.stringify(j));const padded=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,0x20)]);const head=Buffer.alloc(20),bh=Buffer.alloc(8);head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(20+padded.length+8+packed.length,8);head.writeUInt32LE(padded.length,12);head.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(packed.length,0);bh.writeUInt32LE(0x004e4942,4);
 return {bytes:Buffer.concat([head,padded,bh,packed]),...metrics,removed:removed.length};
}
