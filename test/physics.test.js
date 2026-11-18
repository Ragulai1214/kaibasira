import {test} from 'node:test';
import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import {GamePhysics,ready,FLOOR_Y} from '../src/physics.js';
import {makeShell,makeMuscleCells} from '../src/models.js';
import {config,cutBonds} from '../src/rules.js';
await ready;
function game(){const shell=makeShell(),cells=makeMuscleCells(20,.31);return new GamePhysics(cells,shell.children[0].geometry,{...config});}
test('height-aware cuboid contact lets blade pass below raised muscle',()=>{
 const g=game(),p=g.cells[0],center=p.collider.translation();
 assert.ok(p.collider.contactShape(g.bladeShape,{x:center.x,y:center.y-p.half.y+.02,z:center.z},{x:0,y:0,z:0,w:1},0));
 assert.equal(p.collider.contactShape(g.bladeShape,{x:center.x,y:center.y-p.half.y-.2,z:center.z},{x:0,y:0,z:0,w:1},0),null);g.dispose();
});
test('complete peeling releases one compound body that translates and rotates freely',()=>{
 const g=game();for(const p of g.cells)p.detachedFromShell=true;g.rebuild({x:1,z:0});assert.equal(g.groups.length,1);assert.equal(g.groups[0].anchored,false);
 const body=g.groups[0].body,start=body.translation(),rotation=body.rotation();for(let i=0;i<90;i++)g.step(1/120);
 assert.ok(body.translation().y>start.y+.5);assert.notDeepEqual(body.rotation(),rotation);assert.ok(body.translation().x>start.x);g.dispose();
});
test('severed column gets independent collider/body; neighbours retain their bonds',()=>{
 const g=game(),p=g.cells[0],other=g.cells.find(q=>q.id!==p.id),neighbours=[...other.links].filter(id=>id!==p.id);cutBonds(g.cells,p.id);g.rebuild({x:1,z:0},new Set([p.id]));
 assert.equal(p.group.members.length,1);assert.equal(p.group.anchored,false);for(const id of neighbours)assert.ok(other.links.has(id));assert.notEqual(p.collider.parent().handle,other.collider.parent().handle);g.dispose();
});
test('free bodies land on real floor and remain numerically stable',()=>{
 const g=game();for(const p of g.cells)p.detachedFromShell=true;g.rebuild({x:1,z:0});const body=g.groups[0].body;body.setTranslation({x:7,y:1,z:0},true);body.setLinvel({x:0,y:0,z:0},true);body.setAngvel({x:0,y:0,z:0},true);
 for(let i=0;i<600;i++)g.step(1/120);
 for(const p of g.cells){assert.ok(Number.isFinite(p.collider.translation().y));assert.ok(p.collider.translation().y>FLOOR_Y-.03);}
 assert.ok(Math.abs(body.linvel().y)<.5);g.dispose();
});
test('blade and handle have solid 3D colliders; shell is a concave mesh collider',()=>{const g=game();assert.equal(g.blade.isSensor(),false);assert.equal(g.handle.isSensor(),false);assert.equal(g.shellCollider.shape.type,R.ShapeType.TriMesh);g.dispose();});
test('blade and handle ignore shell at every input strength, including crossing the rim',()=>{
 for(const strength of [.5,1]){
  const g=game();assert.equal(g.blade.collisionGroups()&2,0);assert.equal(g.handle.collisionGroups()&2,0);assert.equal(g.shellCollider.collisionGroups()&4,0);
  for(let i=0;i<60;i++){const result=g.interact({x:3-i*.03,z:-2.05},0,strength,strength,1/120);assert.equal(result.blocked,false);g.step(1/120);}
  assert.ok(Math.abs(g.tool.translation().x-1.23)<.001);assert.ok(Math.hypot(g.shell.translation().x,g.shell.translation().z)<.001);g.dispose();
 }
});
test('a separated fragment collides with the solid spatula blade',()=>{
 const g=game(),p=g.cells[0];cutBonds(g.cells,p.id);g.rebuild({x:0,z:0},new Set([p.id]));const tool=g.tool.translation();
 p.group.body.setTranslation({x:tool.x-p.center.x,y:tool.y+.035+p.half.y-p.center.y+.1,z:tool.z-p.center.z},true);p.group.body.setLinvel({x:0,y:0,z:0},true);p.group.body.setAngvel({x:0,y:0,z:0},true);
 let hit=false;for(let i=0;i<90;i++){g.step(1/120);g.world.contactPairsWith(p.collider,other=>{if(other.handle===g.blade.handle)hit=true;});}assert.ok(hit);g.dispose();
});
test('a fragment collides with the remaining attached body',()=>{
 const g=game(),p=g.cells[0],q=g.cells[5];cutBonds(g.cells,p.id);g.rebuild({x:0,z:0},new Set([p.id]));const target=q.collider.translation();
 p.group.body.setTranslation({x:target.x-p.center.x,y:target.y+q.half.y+p.half.y-p.center.y+.15,z:target.z-p.center.z},true);p.group.body.setLinvel({x:0,y:0,z:0},true);p.group.body.setAngvel({x:0,y:0,z:0},true);
 let hit=false;for(let i=0;i<90;i++){g.step(1/120);g.world.contactPairsWith(p.collider,other=>{if(other.parent()?.handle===q.group.body.handle)hit=true;});}assert.ok(hit);g.dispose();
});
test('a falling fragment contacts the curved shell rather than an invisible boundary',()=>{
 const g=game(),p=g.cells[0];cutBonds(g.cells,p.id);g.rebuild({x:0,z:0},new Set([p.id]));p.group.body.setTranslation({x:.8-p.center.x,y:1.4-p.center.y,z:-1.3-p.center.z},true);p.group.body.setLinvel({x:0,y:0,z:0},true);p.group.body.setAngvel({x:0,y:0,z:0},true);
 let hit=false;for(let i=0;i<180;i++){g.step(1/120);g.world.contactPairsWith(p.collider,other=>{if(other.handle===g.shellCollider.handle)hit=true;});}assert.ok(hit);g.dispose();
});
test('fresh game restores all bonds, zero score and anchored state',()=>{const first=game();cutBonds(first.cells,0);first.dispose();const fresh=game();assert.equal(fresh.groups.length,1);assert.ok(fresh.groups[0].anchored);assert.equal(fresh.cells.filter(p=>p.detachedFromShell).length,0);assert.ok(fresh.cells[0].links.size>0);fresh.dispose();});
test('tip-first stroke passes through the previously stuck path after peeling',()=>{
 const g=new GamePhysics(makeMuscleCells(100,.31),makeShell().children[0].geometry,{...config});g.tool.setTranslation({x:2.8,y:g.toolHeight(),z:.3},true);
 let blocked=0;for(let i=0;i<240;i++){const at=g.tool.translation();blocked+=Number(g.interact({x:at.x-.03,z:at.z},Math.PI/2,.5,.5,1/120).blocked);g.step(1/120);}
 assert.equal(blocked,0);assert.ok(g.tool.translation().x<-4);assert.ok(g.cells.filter(p=>p.detachedFromShell).length>30);g.dispose();
});
test('handle overlap with peeled material no longer pins translation',()=>{
 const g=game();for(const p of g.cells)if(p.id!==19){p.detachedFromShell=true;p.lift=.2;}
 for(let i=0;i<30;i++)g.step(1/120);const p=g.cells[0];g.tool.setTranslation({x:p.center.x,y:g.toolHeight(),z:p.center.z-.88},true);
 const start=g.tool.translation();const result=g.interact({x:start.x+.03,z:start.z},0,.1,.1,1/120);g.step(1/120);
 assert.equal(result.blocked,false);assert.ok(g.tool.translation().x>start.x+.02);g.dispose();
});
test('embedded handle can withdraw from an unpeeled column without peeling it',()=>{
 const g=game(),p=g.cells[0];for(const q of g.cells)if(q!==p){q.detachedFromShell=true;q.lift=.2;}
 for(let i=0;i<30;i++)g.step(1/120);g.tool.setTranslation({x:p.center.x,y:g.toolHeight(),z:p.center.z-.88},true);const start=g.tool.translation().x;
 for(let i=0;i<60;i++){const at=g.tool.translation();const result=g.interact({x:at.x+.03,z:at.z},0,.1,.1,1/120);assert.equal(result.blocked,false);g.step(1/120);}
 assert.ok(g.tool.translation().x>start+1.7);assert.equal(p.detachedFromShell,false);g.dispose();
});
test('weak blade can retreat from existing overlap without breaking or peeling',()=>{
 const g=game(),p=g.cells[0];for(const q of g.cells)if(q!==p){q.detachedFromShell=true;q.lift=.2;}
 for(let i=0;i<30;i++)g.step(1/120);g.tool.setTranslation({x:p.center.x,y:g.toolHeight(),z:p.center.z},true);const start=g.tool.translation().x;
 for(let i=0;i<60;i++){const at=g.tool.translation();assert.equal(g.interact({x:at.x+.03,z:at.z},0,.1,.1,1/120).blocked,false);g.step(1/120);}
 assert.ok(g.tool.translation().x>start+1.7);assert.equal(p.detachedFromShell,false);assert.equal(p.damaged,false);g.dispose();
});
test('new handle penetration into unpeeled material is still blocked with correct feedback',()=>{
 const g=game(),p=g.cells[0];for(const q of g.cells)if(q!==p){q.detachedFromShell=true;q.lift=.2;}
 for(let i=0;i<30;i++)g.step(1/120);g.tool.setTranslation({x:p.center.x+.29,y:g.toolHeight(),z:p.center.z-.88},true);const at=g.tool.translation();
 const result=g.interact({x:at.x-.06,z:at.z},0,.5,.5,1/120);g.step(1/120);assert.equal(result.blocked,true);assert.match(g.feedback,/柄が未剥離/);assert.ok(Math.abs(g.tool.translation().x-at.x)<1e-6);assert.equal(p.detachedFromShell,false);g.dispose();
});

test('spatula clears the real shell mesh at the rim in every heading',()=>{
 const g=game();let raised=false;
 for(const [x,z] of [[-2,-2],[-3.9,.7],[1.2,-2],[0,1.8],[-1.3,.3]])for(let i=0;i<8;i++){
  const angle=i*Math.PI/4,q={x:0,y:Math.sin(angle/2),z:0,w:Math.cos(angle/2)},y=g.toolHeight(x,z,angle);
  raised ||= y>g.toolHeight()+.01;
  assert.equal(g.shellCollider.contactShape(g.bladeShape,{x,y,z},q,0),null);
  assert.equal(g.shellCollider.contactShape(g.handleShape,{x:x+Math.sin(angle)*.88,y:y+.1,z:z+Math.cos(angle)*.88},q,0),null);
 }
 assert.ok(raised);g.dispose();
});
