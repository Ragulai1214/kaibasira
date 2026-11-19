import * as THREE from 'three';
import {components} from './rules.js';
import {makeSkin,updateSkin,subsetSkin,unpackSkin,disposeSkin} from './models.js';

function rectangularSashimiPlate(){
 // Rounded rectangular rings form a closed, shallow ceramic dish, including its underside.
 const rings=[[0,.13],[.76,.13],[.91,.20],[1,.32],[1.005,.26],[.94,.06],[0,.06]],positions=[],uvs=[],indices=[],segments=128;
 for(const [scale,y] of rings)for(let i=0;i<segments;i++){
  const a=i/segments*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
  const x=3*scale*Math.sign(c)*Math.abs(c)**.16,z=2*scale*Math.sign(s)*Math.abs(s)**.16;
  positions.push(x,y,z);uvs.push(x/6+.5,z/4+.5);
 }
 for(let r=0;r<rings.length-1;r++)for(let i=0;i<segments;i++){const a=r*segments+i,b=r*segments+(i+1)%segments,c=a+segments,d=b+segments;indices.push(a,c,b,b,c,d);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const size=256,data=new Uint8Array(size*size*4),dark=new THREE.Color('#123153'),pale=new THREE.Color('#718aa8'),color=new THREE.Color();
 let seed=319;for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  seed=(seed*1664525+1013904223)>>>0;const grain=seed/4294967296;
  const radius=Math.hypot((x-size/2)/size,(z-size/2)/size),swirl=Math.sin(radius*65+Math.sin(x*.035)*1.5);
  const blend=THREE.MathUtils.clamp(.38+.2*swirl+.16*Math.sin(x*.043+z*.029)+(grain-.5)*.48,0,1);
  color.copy(dark).lerp(pale,blend).convertLinearToSRGB();const offset=(z*size+x)*4;data[offset]=color.r*255;data[offset+1]=color.g*255;data[offset+2]=color.b*255;data[offset+3]=255;
 }
 const glaze=new THREE.DataTexture(data,size,size);glaze.colorSpace=THREE.SRGBColorSpace;glaze.magFilter=THREE.LinearFilter;glaze.minFilter=THREE.LinearMipmapLinearFilter;glaze.generateMipmaps=true;glaze.needsUpdate=true;
 const plate=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:glaze,roughness:.3,metalness:.05,side:THREE.DoubleSide}));plate.name='rectangular-sashimi-plate';plate.castShadow=plate.receiveShadow=true;return plate;
}

export function resultSnapshot(cells,duration,remaining){
 const cluster=components(cells,p=>p.detachedFromShell).sort((a,b)=>b.length-a.length)[0]??[];
 return {cluster,score:cluster.length,seconds:Math.round(Math.max(0,Math.min(duration,duration-remaining))*100)/100};
}

function makeShiso(){
 const leaf=new THREE.Group();leaf.name='upright-shiso';
 const point=(t,u)=>new THREE.Vector3(u*.64*Math.sin(Math.PI*t)**.75*(1+.10*Math.cos(t*Math.PI*32)),t*1.55,-t*.65+.18*Math.sin(Math.PI*t)*(1-u*u));
 const positions=[],colors=[],indices=[],rows=64,cols=12;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const t=j/rows,u=i/cols*2-1,p=point(t,u);positions.push(p.x,p.y,p.z);
  const color=new THREE.Color('#367521').lerp(new THREE.Color('#689236'),.3*(1-Math.abs(u))+.08*Math.sin(j*2+i));colors.push(color.r,color.g,color.b);
 }
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const surface=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.7}));surface.castShadow=surface.receiveShadow=true;leaf.add(surface);
 const veinMaterial=new THREE.MeshStandardMaterial({color:'#8aa650',roughness:.8});
 const vein=(points,radius)=>{for(const p of points)p.z+=.012;const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),16,radius,4,false),veinMaterial);leaf.add(mesh);};
 vein(Array.from({length:9},(_,i)=>point(i/8,0)),.012);
 for(const t of [.18,.3,.42,.54,.66,.78])for(const side of [-1,1]){
  vein([point(t,0),point(t+.06,side*.42),point(Math.min(.98,t+.13),side*.93)],.006);
 }
 return leaf;
}

function makeWasabi(){
 const profile=[[0,0],[.25,0],[.34,.07],[.3,.2],[.23,.34],[.16,.45],[.11,.55],[0,.64]].map(([r,y])=>new THREE.Vector2(r,y));
 const geometry=new THREE.LatheGeometry(profile,48),p=geometry.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x),ripple=1+.09*Math.sin(a*11+y*22)+.04*Math.sin(a*19-y*31);
  p.setXYZ(i,x*ripple+.07*(y/.64)**2,y,z*ripple);
 }
 geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#9da64b',roughness:.92}));mesh.name='wasabi-mound';mesh.castShadow=mesh.receiveShadow=true;return mesh;
}

export function createResultScene(cluster){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#19363c');
 const camera=new THREE.PerspectiveCamera(39,1,.1,80);camera.position.set(0,8.5,12.5);camera.lookAt(0,.25,0);
 scene.add(new THREE.HemisphereLight('#fff0d1','#344956',2));
 const light=new THREE.DirectionalLight('#fff4de',3);light.position.set(-4,9,5);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-8,right:8,top:7,bottom:-7});light.shadow.normalBias=.025;scene.add(light);
 const add=(geometry,color,parent=scene,roughness=.45)=>{const object=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness}));object.castShadow=object.receiveShadow=true;parent.add(object);return object;};
 const table=add(new THREE.BoxGeometry(40,.2,30),'#254a4d');table.position.y=-.17;
 const mat=add(new THREE.BoxGeometry(9.4,.055,5.9),'#a49372');mat.position.set(0,-.035,.15);
 for(let i=0;i<50;i++){const slat=add(new THREE.BoxGeometry(.035,.018,5.8),i%2?'#bca889':'#8e7d60');slat.position.set(-4.6+i*.187,0,.15);}
 function dish(radius,color,x,z,stretch=1){
  const profile=[[0,.04],[radius*.65,.04],[radius*.96,.18],[radius,.24],[radius*.985,.29],[radius*.88,.22],[radius*.66,.13],[0,.13]].map(([r,y])=>new THREE.Vector2(r,y));
  const group=new THREE.Group();group.position.set(x,.02,z);group.scale.x=stretch;scene.add(group);
  const plate=add(new THREE.LatheGeometry(profile,80),color,group,.23);plate.material.side=THREE.DoubleSide;
  const rim=add(new THREE.TorusGeometry(radius*.986,.018,6,96),'#d1b477',group,.3);rim.rotation.x=Math.PI/2;rim.position.y=.276;
  return group;
 }
 const sashimiPlate=rectangularSashimiPlate();sashimiPlate.position.set(-1.25,.02,0);scene.add(sashimiPlate);
 const soyDish=dish(.95,'#193f58',3.05,1.15);
 const soy=add(new THREE.CylinderGeometry(.76,.76,.018,64),'#28120b',soyDish,.17);soy.position.y=.174;
 const soyHighlight=add(new THREE.TorusGeometry(.72,.009,4,64,Math.PI*.38),'#80532a',soyDish,.3);soyHighlight.rotation.x=Math.PI/2;soyHighlight.position.y=.186;

 // Thin curved white strands form a 3D mound of shredded daikon behind the sashimi.
 const radish=new THREE.Group();radish.position.set(-2.65,.18,-1.05);radish.scale.set(1,1.06,1);scene.add(radish);
 // Roots sit underneath the daikon; curved serrated leaves rise behind it.
 // Each main leaf is about 1.6 units wide: half the full-size plated muscle.
 for(const [x,tilt,scale] of [[-2.95,.28,1.2],[-2.45,-.25,1.3]]){
  const leaf=makeShiso();leaf.position.set(x,.17,-.95);leaf.rotation.z=tilt;leaf.scale.setScalar(scale);scene.add(leaf);
 }
 const wasabi=makeWasabi();wasabi.position.set(-3.25,.18,.7);wasabi.scale.setScalar(1.3);scene.add(wasabi);
 let seed=2753;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const white=new THREE.MeshStandardMaterial({color:'#fff9e6',roughness:.55});
 for(let i=0;i<128;i++){
  const angle=random()*Math.PI*2,radius=.15+random()*.9,cx=Math.cos(angle)*radius,cz=Math.sin(angle)*radius*.55,height=.3+random()*.6;
  const points=[new THREE.Vector3(cx-.5,.015,cz-.18),new THREE.Vector3(cx-.22,height*.85,cz+.1),new THREE.Vector3(cx+.15,height,cz-.08),new THREE.Vector3(cx+.55,.03,cz+.25)];
  const strand=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),12,.018+random()*.012,4,false),white);strand.castShadow=strand.receiveShadow=true;radish.add(strand);
 }

 const servingHeight=.02+.13; // Plate placement + the flat inner surface height.
 const hero=new THREE.Group();hero.position.set(-.95,servingHeight,.45);scene.add(hero);
 let foodJobs=null;
 const clearFood=()=>{foodJobs?.cancel(hero);for(const food of [...hero.children]){hero.remove(food);disposeSkin(food);}};
 const mountFood=food=>{
  updateSkin(food,'#f0dfbd');
  const bounds=new THREE.Box3().setFromObject(food);if(bounds.isEmpty()){disposeSkin(food);return;}
  const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const scale=Math.min(1,3.2/Math.max(size.x,size.z));food.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);food.scale.setScalar(scale);hero.add(food);
 };
 const setCluster=(cluster,source=null,jobs=null)=>{
  clearFood();foodJobs=jobs;if(!cluster.length)return;
  const copies=cluster.map(p=>({...p,center:p.center.clone(),half:p.half.clone(),lift:0}));
  mountFood(source?subsetSkin(source,copies):makeSkin(copies));
  if(source&&jobs&&copies.some(p=>!p.damaged))jobs.request(hero,copies,parts=>{
   const food=unpackSkin(parts,copies);const boxes=makeSkin(copies.filter(p=>p.damaged));for(const box of [...boxes.children])food.add(box);
   clearFood();mountFood(food);
  });
 };
 setCluster(cluster);
 // Actual chopsticks and a small ceramic rest complete the serving arrangement.
 const rest=add(new THREE.BoxGeometry(.65,.14,.25),'#dce5e1');rest.position.set(1.05,.09,2.55);
 for(const z of [2.42,2.64]){const stick=add(new THREE.CylinderGeometry(.035,.055,5.8,8),'#503520');stick.rotation.z=Math.PI/2;stick.position.set(-.6,.2,z);}

 const confetti=new THREE.InstancedMesh(new THREE.PlaneGeometry(.09,.16),new THREE.MeshBasicMaterial({side:THREE.DoubleSide,transparent:true,opacity:1}),110);
 confetti.frustumCulled=false;scene.add(confetti);const particles=[],dummy=new THREE.Object3D(),palette=['#f3c85d','#ee8d86','#79c7ba','#fbf3cf'];
 for(let i=0;i<110;i++){particles.push({x:(random()-.5)*10,z:(random()-.5)*6,y:5+random()*4,vx:(random()-.5)*1.5,spin:random()*6});confetti.setColorAt(i,new THREE.Color(palette[i%palette.length]));}
 const resize=(width,height)=>{camera.aspect=width/height;camera.position.set(0,camera.aspect<1?13:8.5,camera.aspect<1?19:12.5);camera.lookAt(0,.25,0);camera.updateProjectionMatrix();};
 const update=time=>{
  const t=Math.max(0,time),landing=Math.min(1,t/1.25),ease=1-(1-landing)**3;
  hero.position.y=servingHeight+(1-ease)*1.65;hero.rotation.y=(1-ease)*-.35;
  confetti.visible=t<5;confetti.material.opacity=Math.min(1,Math.max(0,5-t));
  for(let i=0;i<particles.length;i++){const p=particles[i];dummy.position.set(p.x+p.vx*t,p.y-t*1.5-t*t*.3,p.z+Math.sin(t+p.spin)*.3);dummy.rotation.set(p.spin+t*2,p.spin+t*.7,t+p.spin);dummy.updateMatrix();confetti.setMatrixAt(i,dummy.matrix);}confetti.instanceMatrix.needsUpdate=true;
 };
 update(0);
 const dispose=()=>{clearFood();const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});for(const g of geometries)g.dispose();for(const m of materials){m.map?.dispose();m.dispose();}light.shadow.dispose();confetti.dispose();};
 return {scene,camera,hero,resize,update,dispose,setCluster,clearFood};
}

export class Fanfare {
 constructor(){this.context=null;this.enabled=true;this.nodes=[];}
 unlock(){
  if(!this.enabled)return;
  try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;this.context??=new Audio();this.context.resume().catch(()=>{});}catch{/* Audio is optional; visuals must still finish. */}
 }
 stop(){for(const node of this.nodes){try{node.stop();}catch{}}this.nodes=[];}
 play(){
  if(!this.enabled||this.context?.state!=='running')return;this.stop();
  const ctx=this.context,start=ctx.currentTime+.03;
  for(const [frequency,offset,duration] of [[523.25,0,.12],[659.25,.15,.12],[783.99,.3,.12],[523.25,.48,.85],[659.25,.48,.85],[783.99,.48,.85],[1046.5,.48,.95]]){
   const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type='triangle';oscillator.frequency.value=frequency;
   gain.gain.setValueAtTime(0,start+offset);gain.gain.linearRampToValueAtTime(.055,start+offset+.025);gain.gain.exponentialRampToValueAtTime(.001,start+offset+duration);
   oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(start+offset);oscillator.stop(start+offset+duration+.03);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};this.nodes.push(oscillator);
  }
 }
}
