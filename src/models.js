import * as THREE from 'three';
import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js';
import {connectGrid} from './rules.js';
import {surfaceStencil} from './spatula-outline.js';

// Straight dorsal edge, curved ventral edge, acute umbo: Atrina anatomy.
// https://www.uoichi.co.jp/assets/attachmentfile/attachmentfile-file-668.pdf
const contour=new THREE.Shape();
contour.moveTo(4.15,-1.95);contour.lineTo(-2.85,-2.08);
contour.bezierCurveTo(-3.1,-2.02,-3.95,-.8,-4.02,.75);
contour.bezierCurveTo(-4.15,2.25,-2.85,2.72,-1.3,2.38);
contour.bezierCurveTo(.75,1.97,2.75,-.35,4.15,-1.95);
export const shellBoundary=contour.getSpacedPoints(112).slice(0,-1);
export function boundaryInfo(point){
 let inside=false,distance=Infinity,closest=null;
 for(let i=0,j=shellBoundary.length-1;i<shellBoundary.length;j=i++){
  const a=shellBoundary[j],b=shellBoundary[i];
  if((a.y>point.z)!==(b.y>point.z)&&point.x<(b.x-a.x)*(point.z-a.y)/(b.y-a.y)+a.x)inside=!inside;
  const dx=b.x-a.x,dz=b.y-a.y,t=THREE.MathUtils.clamp(((point.x-a.x)*dx+(point.z-a.y)*dz)/(dx*dx+dz*dz),0,1);
  const x=a.x+t*dx,z=a.y+t*dz,d=Math.hypot(point.x-x,point.z-z);
  if(d<distance){distance=d;closest={x,z};}
 }return {inside,distance,closest};
}
export function shellHeight(x,z){return -.085+.26*Math.exp(-boundaryInfo({x,z}).distance*3.2);}
export function makeShell(){
 const group=new THREE.Group(),positions=[],colors=[],indices=[],segments=shellBoundary.length,rings=12;
 const dark=new THREE.Color('#252c1c'),pearl=new THREE.Color('#c3bea2'),teal=new THREE.Color('#307e74'),violet=new THREE.Color('#817385');
 for(let side=0;side<2;side++)for(let r=0;r<=rings;r++)for(let i=0;i<=segments;i++){
  const rho=r/rings,p=shellBoundary[i%segments],x=p.x*rho,z=p.y*rho;
  positions.push(x,shellHeight(x,z)-(side?.045:0),z);
  const c=pearl.clone().lerp(teal,(Math.sin(i*.12+rho*8)+1)*.19).lerp(violet,(Math.sin(i*.19-rho*9)+1)*.12);
  c.lerp(dark,side?.94:Math.max(0,(rho-.91)/.09)*.85);c.multiplyScalar(1+Math.sin(rho*160+i*.08)*.035);colors.push(c.r,c.g,c.b);
 }
 const stride=segments+1,layer=(rings+1)*stride;
 for(let side=0;side<2;side++)for(let r=0;r<rings;r++)for(let i=0;i<segments;i++){
  const a=side*layer+r*stride+i,b=a+1,c=a+stride,d=c+1;
  if(side)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);
 }
 for(let i=0;i<segments;i++){const a=rings*stride+i,b=a+1;indices.push(a,b,a+layer,b,b+layer,a+layer);}
 for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshPhysicalMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.36,metalness:.16,clearcoat:.75,...surfaceStencil()}));mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return group;
}
export function makeMuscleCells(count,size){
 const candidates=[],n=Math.ceil(Math.sqrt(count));
 for(let gx=-n;gx<=n;gx++)for(let gz=-n;gz<=n;gz++){
  const notch=2.8*Math.exp(-gx*gx/3)*Math.max(0,gz);
  candidates.push({gx,gz,rank:gx*gx+(gz/.83)**2+notch});
 }
 candidates.sort((a,b)=>a.rank-b.rank||a.gz-b.gz||a.gx-b.gx);
 // Keep the configurable count on the actual shell even at large size settings.
 const selected=candidates.slice(0,count);
 while(selected.some(p=>[[-.5,-.5],[-.5,.5],[.5,-.5],[.5,.5]].some(([dx,dz])=>{
  const point={x:(p.gx+dx)*size-1.3,z:(p.gz+dz)*size+.3},edge=boundaryInfo(point);return !edge.inside||edge.distance<.12;
 })))size*=.96;
 const base=Math.max(...selected.map(p=>shellHeight(p.gx*size-1.3,p.gz*size+.3)))+.035;
 const profile={count,cx:-1.3,cz:.3,rx:(Math.max(...selected.map(p=>Math.abs(p.gx)))+.5)*size,rz:(Math.max(...selected.map(p=>Math.abs(p.gz)))+.5)*size,base,height:1.05};
 const cells=selected.map((cell,id)=>{
  const x=cell.gx*size-1.3,z=cell.gz*size+.3,height=profile.height;
  const half=new THREE.Vector3(size/2,height/2,size/2),center=new THREE.Vector3(x,base+height/2,z);
  return {...cell,id,profile,center,half,detachedFromShell:false,damaged:false,lift:0,liftVelocity:0};
 });connectGrid(cells);return cells;
}
function smoothMin(a,b,k){const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;}
function boxDistance(x,y,z,p){
 const dx=Math.abs(x-p.center.x)-p.half.x,dy=Math.abs(y-p.center.y)-p.half.y,dz=Math.abs(z-p.center.z)-p.half.z;
 return Math.hypot(Math.max(dx,0),Math.max(dy,0),Math.max(dz,0))+Math.min(Math.max(dx,dy,dz),0);
}
function makeSmoothSkin(cells){
 // Render only a continuous outer surface; interior rectangular colliders stay invisible.
 const min=new THREE.Vector3(Infinity,Infinity,Infinity),max=new THREE.Vector3(-Infinity,-Infinity,-Infinity);
 for(const p of cells){min.min(p.center.clone().sub(p.half));max.max(p.center.clone().add(p.half));}
 if(cells.length===cells[0].profile.count){const p=cells[0].profile;min.set(p.cx-p.rx,p.base,p.cz-p.rz);max.set(p.cx+p.rx,p.base+p.height,p.cz+p.rz);}
 min.addScalar(-.22);max.addScalar(.22);const center=min.clone().add(max).multiplyScalar(.5),half=max.clone().sub(min).multiplyScalar(.5);
 const resolution=cells.length>20?36:cells.length>3?24:16;
 const material=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.3,clearcoat:.65,clearcoatRoughness:.22,...surfaceStencil(true)});
 const field=new MarchingCubes(resolution,material,false,true,18000);field.isolation=0;
 const reach=cells[0].half.x*3.5;
 const profile=cells[0].profile,whole=cells.length===profile.count;
 for(let z=0;z<resolution;z++)for(let x=0;x<resolution;x++){
  const px=center.x+(x/resolution*2-1)*half.x,pz=center.z+(z/resolution*2-1)*half.z;
  const nearby=cells.filter(p=>Math.abs(px-p.center.x)<reach&&Math.abs(pz-p.center.z)<reach);
  for(let y=0;y<resolution;y++){
   const py=center.y+(y/resolution*2-1)*half.y;
   const nx=(px-profile.cx)/profile.rx,nz=(pz-profile.cz)/profile.rz,a=Math.atan2(nz,nx);
   const notchAngle=Math.atan2(Math.sin(a-Math.PI/2+.18),Math.cos(a-Math.PI/2+.18));
   const radius=1-.23*Math.exp(-(notchAngle*notchAngle)/.065);
   const horizontal=(Math.hypot(nx,nz)-radius)*Math.min(profile.rx,profile.rz);
   const vertical=Math.abs(py-profile.base-profile.height/2)-profile.height/2;
   let distance=-smoothMin(-horizontal,-vertical,.11);
   if(!whole){let mask=1;for(const p of nearby)mask=smoothMin(mask,boxDistance(px,py,pz,p),.1);distance=Math.max(distance,mask);}
   field.field[x+y*resolution+z*resolution*resolution]=-distance;
  }
 }
 // Smooth the occupancy field, not each column separately, to remove the grid imprint.
 let source=field.field;
 for(let pass=0;pass<(whole?0:1);pass++)for(const stride of [1,resolution,resolution*resolution]){
  const target=source.slice();
  for(let z=2;z<resolution-2;z++)for(let y=2;y<resolution-2;y++)for(let x=2;x<resolution-2;x++){
   const i=x+y*resolution+z*resolution*resolution;
   target[i]=(source[i-stride*2]+4*source[i-stride]+6*source[i]+4*source[i+stride]+source[i+stride*2])/16;
  }source=target;
 }
 field.field.set(source);field.update();
 const count=field.geometry.drawRange.count,geometry=new THREE.BufferGeometry();
 const vertices=field.geometry.attributes.position.array.slice(0,count*3),normals=field.geometry.attributes.normal.array.slice(0,count*3);
 for(let i=0;i<vertices.length;i+=3){vertices[i]=vertices[i]*half.x+center.x;vertices[i+1]=vertices[i+1]*half.y+center.y;vertices[i+2]=vertices[i+2]*half.z+center.z;const v=new THREE.Vector3(normals[i]/half.x,normals[i+1]/half.y,normals[i+2]/half.z).normalize();normals.set(v.toArray(),i);}
 geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(count*3).fill(1),3));
 field.geometry.dispose();const skin=new THREE.Mesh(geometry,material);skin.castShadow=skin.receiveShadow=true;
 const weights=[];
 for(let i=0;i<count;i++){
  const x=vertices[i*3],z=vertices[i*3+2];const nearby=cells.filter(p=>Math.abs(x-p.center.x)<reach&&Math.abs(z-p.center.z)<reach);
  const near=(nearby.length?nearby:cells).map(p=>({p,d:(x-p.center.x)**2+(z-p.center.z)**2})).sort((a,b)=>a.d-b.d).slice(0,4);
  const total=near.reduce((s,n)=>s+1/(n.d+.015),0);weights.push(near.map(n=>({p:n.p,w:1/(n.d+.015)/total})));
 }
 skin.userData={base:vertices.slice(),weights};return skin;
}
function updateSmoothSkin(skin,peeledColor){
 const position=skin.geometry.attributes.position,color=skin.geometry.attributes.color,{base,weights}=skin.userData;
 const cream=new THREE.Color('#f3e5c4'),peeled=new THREE.Color(peeledColor),damage=new THREE.Color('#e3bd98');
 for(let i=0;i<weights.length;i++){
  let lift=0,r=0,g=0,b=0;for(const {p,w} of weights[i]){lift+=p.lift*w;const c=p.damaged?damage:p.detachedFromShell?peeled:cream;r+=c.r*w;g+=c.g*w;b+=c.b*w;}
  position.setY(i,base[i*3+1]+lift);color.setXYZ(i,r,g,b);
 }position.needsUpdate=color.needsUpdate=true;
}

export function makeSkin(cells){
 const visual=new THREE.Group(),intact=cells.filter(p=>!p.damaged);
 if(intact.length)visual.add(makeSmoothSkin(intact));
 for(const p of cells)if(p.damaged){
  const box=new THREE.Mesh(new THREE.BoxGeometry(p.half.x*2,p.half.y*2,p.half.z*2),new THREE.MeshStandardMaterial({color:p.damaged?'#e3bd98':'#c9a65f',roughness:.4,...surfaceStencil(true)}));
  box.userData.cell=p;box.position.copy(p.center);box.position.y+=p.lift;box.castShadow=box.receiveShadow=true;visual.add(box);
 }
 return visual;
}
export function updateSkin(visual,peeledColor){
 for(const mesh of visual.children){
  const p=mesh.userData.cell;
  if(p){mesh.position.copy(p.center);mesh.position.y+=p.lift;mesh.material.color.set(p.damaged?'#e3bd98':peeledColor);}
  else updateSmoothSkin(mesh,peeledColor);
 }
}
