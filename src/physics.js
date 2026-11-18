import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import {components,cutBonds,classify,assess} from './rules.js';
import {makeSkin,updateSkin} from './models.js';
export const ready=RAPIER.init();
export const FLOOR_Y=-.15;
const vec=v=>new THREE.Vector3(v.x,v.y,v.z);

// Compare horizontal overlap, since the smallest 3D penetration is often the
// constant blade thickness and cannot tell whether a sideways retreat is helping.
function overlapArea(cell,shape,position,rotation){
 if(!cell.collider.contactShape(shape,position,rotation,0))return 0;
 const center=vec(cell.collider.translation()),q=cell.collider.rotation();
 const inverse=new THREE.Quaternion(q.x,q.y,q.z,q.w).invert(),half=shape.halfExtents;
 let polygon=[[-half.x,-half.z],[half.x,-half.z],[half.x,half.z],[-half.x,half.z]].map(([x,z])=>{
  const v=new THREE.Vector3(x,0,z).applyQuaternion(rotation).add(vec(position)).sub(center).applyQuaternion(inverse);return {x:v.x,z:v.z};
 });
 for(const [axis,sign,limit] of [['x',1,cell.half.x],['x',-1,cell.half.x],['z',1,cell.half.z],['z',-1,cell.half.z]]){
  const clipped=[];
  for(let i=0;i<polygon.length;i++){
   const a=polygon[i],b=polygon[(i+1)%polygon.length],da=sign*a[axis]-limit,db=sign*b[axis]-limit;
   if(da<=0)clipped.push(a);
   if((da<=0)!==(db<=0)){const t=da/(da-db);clipped.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}
  }polygon=clipped;
 }
 let area=0;for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];area+=a.x*b.z-b.x*a.z;}
 return Math.abs(area)*.5;
}

export class GamePhysics {
 constructor(cells,shellGeometry,config,scene=null){
  this.cells=cells;this.config=config;this.scene=scene;this.groups=[];this.feedback='ヘラを貝柱に差し込もう';
  this.world=new RAPIER.World({x:0,y:-7,z:0});this.world.timestep=1/120;
  this.world.numSolverIterations=6;
  this.world.createCollider(RAPIER.ColliderDesc.cuboid(25,.15,25).setTranslation(0,FLOOR_Y-.15,0).setFriction(.7).setRestitution(.22));
  // The shell supports flying pieces but is intentionally ignored by the spatula.
  const shellDesc=RAPIER.RigidBodyDesc.fixed().setTranslation(0,-.02,0);
  this.shell=this.world.createRigidBody(shellDesc);
  this.shellCollider=this.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(shellGeometry.attributes.position.array),new Uint32Array(shellGeometry.index.array)).setCollisionGroups((2<<16)|(1|16)).setFriction(.6).setRestitution(.18),this.shell);
  // Cache the actual shell surface, so clearance also matches its polygonal rim.
  const vertices=shellGeometry.attributes.position,index=shellGeometry.index;
  this.shellTriangles=[];
  for(let i=0;i<index.count;i+=3){const triangle=[];for(let j=0;j<3;j++){const n=index.getX(i+j);triangle.push({x:vertices.getX(n),y:vertices.getY(n),z:vertices.getZ(n)});}this.shellTriangles.push(triangle);}
  this.tool=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(2.8,.25,1.5));
  this.bladeShape=new RAPIER.Cuboid(.55,.035,.25);
  this.handleShape=new RAPIER.Cuboid(.115,.095,.625);
  this.blade=this.world.createCollider(RAPIER.ColliderDesc.cuboid(.55,.035,.25).setCollisionGroups((4<<16)|(1|8|16)).setFriction(.35).setRestitution(.25),this.tool);
  this.handle=this.world.createCollider(RAPIER.ColliderDesc.cuboid(.115,.095,.625).setTranslation(0,.1,.88).setCollisionGroups((4<<16)|(1|8|16)).setFriction(.5),this.tool);
  this.tool.setTranslation({x:2.8,y:this.toolHeight(2.8,1.5,0),z:1.5},true);
  this.sway={x:0,z:0,vx:0,vz:0};this.rebuild();this.world.propagateModifiedBodyPositionsToColliders();
 }
 dispose(){for(const g of this.groups)this.removeSkin(g);this.world.free();}
 removeSkin(g){if(g.skin){this.scene.remove(g.skin);g.skin.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});}}
 rebuild(direction={x:0,z:0},struck=new Set()){
  const previous=this.groups,existing=new Map(previous.map(g=>[g.key,g])),next=[];
  for(const members of components(this.cells)){
   const key=members.map(p=>p.id).sort((a,b)=>a-b).join(','),anchor=members.some(p=>!p.detachedFromShell);
   let group=existing.get(key);
   // Peeling only changes color/lift. Preserve the original surface until bonds break.
   if(group){existing.delete(key);if(group.anchored&&!anchor)this.releaseGroup(group,direction);next.push(group);continue;}
   const old=members[0].group,position=old?old.body.translation():this.shell.translation(),rotation=old?old.body.rotation():this.shell.rotation();
   const desc=(anchor?RAPIER.RigidBodyDesc.kinematicPositionBased():RAPIER.RigidBodyDesc.dynamic()).setTranslation(position.x,position.y,position.z).setRotation(rotation).setLinearDamping(.25).setAngularDamping(.35).setCcdEnabled(true);
   const body=this.world.createRigidBody(desc);group={key,members,body,anchored:anchor,skin:this.scene?makeSkin(members):null};
   if(group.skin)this.scene.add(group.skin);
   for(const p of members){p.group=group;p.collider=this.world.createCollider(RAPIER.ColliderDesc.cuboid(p.half.x,p.half.y,p.half.z).setTranslation(p.center.x,p.center.y+p.lift,p.center.z).setCollisionGroups(anchor?(8<<16)|(4|16):(16<<16)|31).setMass(.035).setFriction(.55).setRestitution(.32),body);}
   if(!anchor){
    if(old&&!old.anchored){body.setLinvel(old.body.linvel(),true);body.setAngvel(old.body.angvel(),true);}
    if(!old||old.anchored||members.some(p=>struck.has(p.id)))this.launch(group,direction,members.some(p=>p.damaged));
   }
   next.push(group);
  }
  for(const old of existing.values()){this.removeSkin(old);this.world.removeRigidBody(old.body);}
  this.groups=next;this.world.propagateModifiedBodyPositionsToColliders();
 }
 launch(group,direction,damaged=false){
  const len=Math.hypot(direction.x,direction.z)||1,speed=damaged?this.config.fragmentSpeed:2.2;
  group.body.setLinvel({x:direction.x/len*speed,y:this.config.peelLaunchSpeed*(damaged?.7:1),z:direction.z/len*speed},true);
  const spin=this.config.fragmentSpin*(damaged?1:.5);
  group.body.setAngvel({x:.55*spin,y:.37*spin,z:-.64*spin},true);
 }
 releaseGroup(group,direction){group.anchored=false;group.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);for(const p of group.members)p.collider.setCollisionGroups((16<<16)|31);this.launch(group,direction);}
 toolHeight(x,z,angle=0){
  const shell=this.shell.translation();let height=this.cells[0].profile.base+shell.y+.035;
  if(x===undefined||z===undefined)return height;
  const cache=this.heightCache;if(cache&&cache.x===x&&cache.z===z&&cache.angle===angle&&cache.shellY===shell.y)return cache.height;
  const cos=Math.cos(angle),sin=Math.sin(angle);
  // Clip shell triangles to each part's footprint; linear face heights reach their
  // maximum at a clipped vertex. This catches narrow rims between sample points.
  for(const [minX,maxX,minZ,maxZ,bottom] of [[-.55,.55,-.25,.25,-.035],[-.115,.115,.255,1.505,.005]]){
   for(const triangle of this.shellTriangles){
    if(triangle.every(p=>p.y+shell.y-bottom+.004<=height))continue;
    let polygon=triangle.map(p=>{const dx=p.x+shell.x-x,dz=p.z+shell.z-z;return {x:cos*dx-sin*dz,y:p.y+shell.y,z:sin*dx+cos*dz};});
    if(polygon.every(p=>p.x<minX)||polygon.every(p=>p.x>maxX)||polygon.every(p=>p.z<minZ)||polygon.every(p=>p.z>maxZ))continue;
    for(const [axis,sign,limit] of [['x',1,maxX],['x',-1,-minX],['z',1,maxZ],['z',-1,-minZ]]){
     const clipped=[];for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length],da=sign*a[axis]-limit,db=sign*b[axis]-limit;
      if(da<=0)clipped.push(a);
      if((da<=0)!==(db<=0)){const t=da/(da-db);clipped.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});}
     }polygon=clipped;
    }
    for(const p of polygon)height=Math.max(height,p.y-bottom+.004);
   }
  }
  this.heightCache={x,z,angle,shellY:shell.y,height};return height;
 }
 interact(target,angle,force,rawForce,dt){
  const current=this.tool.translation(),dx=target.x-current.x,dz=target.z-current.z,moving=Math.hypot(dx,dz)>.00001;
  const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle);
  const position={x:target.x,y:this.toolHeight(target.x,target.z,angle),z:target.z};
  const handlePosition=new THREE.Vector3(0,.1,.88).applyQuaternion(rotation).add(vec(position));
  const currentRotation=this.tool.rotation();
  const currentHandle=new THREE.Vector3(0,.1,.88).applyQuaternion(currentRotation).add(vec(current));
  let blocked=false,changed=false;const struck=new Set(),audio={scraping:false,peeled:0,broken:0,released:0};
  const anchoredBefore=new Set(this.groups.filter(g=>g.anchored).flatMap(g=>g.members.map(p=>p.id)));
  // Exact oriented cuboid contacts, with height, rather than a 2D proximity radius.
  for(const p of this.cells){
   const hit=p.collider.contactShape(this.bladeShape,position,rotation,.003);p.collisionState=!!hit;
   if(!hit||!moving)continue;
   if(p.group.anchored&&!p.detachedFromShell)audio.scraping=true;
   const action=classify(force*(p.detachedFromShell?.8:1),this.config);
   if(action==='break'&&p.links.size){cutBonds(this.cells,p.id);struck.add(p.id);audio.broken++;changed=true;this.feedback='あっ！結合がちぎれた！';}
   else if(action==='peel'&&!p.detachedFromShell){p.detachedFromShell=true;p.liftVelocity+=this.config.peelLaunchSpeed*.16;audio.peeled++;changed=true;this.feedback='するっと剥離！大きな塊を残そう';}
   this.sway.vx+=dx*.4;this.sway.vz+=dz*.4;
  }
  // Peeled columns must not pin the handle. Only prevent NEW/deeper overlap with
  // still-attached material; allow retreat and tangential escape from existing contact.
  let handleBefore=0,handleAfter=0,bladeBefore=0,bladeAfter=0;
  for(const p of this.cells)if(p.group.anchored&&!p.detachedFromShell){
   handleBefore+=overlapArea(p,this.handleShape,currentHandle,currentRotation);
   handleAfter+=overlapArea(p,this.handleShape,handlePosition,rotation);
   bladeBefore+=overlapArea(p,this.bladeShape,current,currentRotation);
   bladeAfter+=overlapArea(p,this.bladeShape,position,rotation);
  }
  const handleBlocked=handleAfter>handleBefore+1e-7,bladeBlocked=bladeAfter>bladeBefore+1e-7;
  blocked=handleBlocked||bladeBlocked;
  if(handleBlocked)this.feedback='柄が未剥離の部分に接触。引くか向きを変えよう';
  else if(bladeBlocked)this.feedback='押し返された…もう少し速く';
  if(changed){this.rebuild({x:dx,z:dz},struck);audio.released=this.groups.filter(g=>!g.anchored&&g.members.some(p=>anchoredBefore.has(p.id))&&!g.members.some(p=>struck.has(p.id))).length;}
  this.tool.setNextKinematicTranslation(blocked?current:position);this.tool.setNextKinematicRotation(blocked?currentRotation:rotation);
  return {blocked,changed,audio,status:changed?assess(this.cells):null};
 }
 step(dt){
  const c=this.config,s=this.sway,attached=this.cells.filter(p=>!p.detachedFromShell).length/this.cells.length;
  s.vx+=(-c.stiffness*(.3+.7*attached)*s.x-c.damping*s.vx)*dt;s.vz+=(-c.stiffness*(.3+.7*attached)*s.z-c.damping*s.vz)*dt;
  s.x=THREE.MathUtils.clamp(s.x+s.vx*dt,-.12,.12);s.z=THREE.MathUtils.clamp(s.z+s.vz*dt,-.12,.12);
  const shellPos=this.shell.translation(),shellRot=this.shell.rotation();
  for(const group of this.groups){
   if(group.anchored){
    group.body.setNextKinematicTranslation({x:shellPos.x+s.x,y:shellPos.y,z:shellPos.z+s.z});group.body.setNextKinematicRotation(shellRot);
    for(const p of group.members){
     const target=p.detachedFromShell?c.floatHeight:0;p.liftVelocity+=((target-p.lift)*65-p.liftVelocity*10)*dt;p.lift=THREE.MathUtils.clamp(p.lift+p.liftVelocity*dt,0,.5);
     p.collider.setTranslationWrtParent({x:p.center.x,y:p.center.y+p.lift,z:p.center.z});
    }
   }
  }
  this.world.timestep=dt;this.world.step();
  // Bound excessive launch speeds without constraining free rotation or forcing a hover height.
  for(const group of this.groups)if(!group.anchored){const v=vec(group.body.linvel());if(v.length()>14)group.body.setLinvel(v.clampLength(0,14),true);}
 }
 render(){for(const group of this.groups)if(group.skin){group.skin.position.copy(group.body.translation());group.skin.quaternion.copy(group.body.rotation());updateSkin(group.skin,this.config.peeledColor);}}
}
