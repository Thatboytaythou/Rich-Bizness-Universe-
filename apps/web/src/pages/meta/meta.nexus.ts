import * as THREE from 'three';
export function mountNexus(host:HTMLElement):()=>void {
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return ()=>{};
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,powerPreference:'low-power'});}catch{return ()=>{};}
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(48,1,.1,100);
  camera.position.set(0,9,23);camera.lookAt(0,3,0);
  const canvas=renderer.domElement;canvas.setAttribute('aria-hidden','true');host.append(canvas);
  const gold=new THREE.MeshStandardMaterial({color:0xc6a04b,metalness:.8,roughness:.27}),stone=new THREE.MeshStandardMaterial({color:0x132c24,metalness:.55,roughness:.32}),glow=new THREE.MeshBasicMaterial({color:0x76ffad});
  const geometries:THREE.BufferGeometry[]=[];
  const mesh=(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number)=>{geometries.push(g);const o=new THREE.Mesh(g,m);o.position.set(x,y,z);scene.add(o);return o;};
  mesh(new THREE.CylinderGeometry(10,10.5,.55,48),stone,0,-.3,0);
  for(let i=0;i<12;i++){const a=i*Math.PI/6,x=Math.cos(a)*8,z=Math.sin(a)*8,h=2.8+(i%4)*1.3;mesh(new THREE.CylinderGeometry(.55,.9,h,6),stone,x,h/2,z);mesh(new THREE.CylinderGeometry(.65,.65,.13,6),gold,x,h,z);mesh(new THREE.CylinderGeometry(.13,.13,h*.8,6),glow,x,h*.5,z+.66);}
  const rings=[3.2,3.7,4.2].map((r,i)=>mesh(new THREE.TorusGeometry(r,.055+i*.015,8,64),i===1?glow:gold,0,4,0));
  mesh(new THREE.IcosahedronGeometry(1.35,1),gold,0,4,0);
  scene.add(new THREE.HemisphereLight(0xd6ffe9,0x172010,2));
  const light=new THREE.PointLight(0x65ff99,65,28);light.position.set(0,5,3);scene.add(light);
  let frame=0,visible=true,dead=false,last=0,scale=1,slow=0;
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)*scale);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
  const ro=new ResizeObserver(resize);ro.observe(host);resize();
  const io=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??false;});io.observe(host);
  const tick=(t:number)=>{if(dead)return;frame=requestAnimationFrame(tick);if(!visible||document.hidden){last=0;return;}const dt=last?t-last:16;last=t;if(dt>45)slow++;else slow=Math.max(0,slow-1);if(slow>25&&scale>.65){scale=Math.max(.65,scale-.15);slow=0;resize();}rings.forEach((r,i)=>{r.rotation.y=t*.00022*(i+1);r.rotation.x=.18+i*.22;});renderer.render(scene,camera);};
  frame=requestAnimationFrame(tick);
  return ()=>{dead=true;cancelAnimationFrame(frame);ro.disconnect();io.disconnect();geometries.forEach(g=>g.dispose());[gold,stone,glow].forEach(m=>m.dispose());renderer.dispose();canvas.remove();};
}
