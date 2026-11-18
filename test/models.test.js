import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeMuscleCells,makeShell,makeSkin,updateSkin,boundaryInfo} from '../src/models.js';
import {components,cutBonds} from '../src/rules.js';
test('muscle uses exact count of rectangular cells with one connected grid',()=>{
 for(const count of [20,100,160]){const cells=makeMuscleCells(count,.31);assert.equal(cells.length,count);assert.equal(components(cells).length,1);for(const p of cells){assert.ok(p.half.x<=.155);assert.equal(p.half.z,p.half.x);assert.ok(p.half.y>0);assert.ok(boundaryInfo({x:p.center.x,z:p.center.z}).inside);}}
});
test('thin shell has a straight dorsal edge and curved asymmetric outline',()=>{const shell=makeShell(),g=shell.children[0].geometry;g.computeBoundingBox();assert.ok(g.boundingBox.max.y-g.boundingBox.min.y<.4);assert.equal(boundaryInfo({x:0,z:0}).inside,true);assert.equal(boundaryInfo({x:4,z:2}).inside,false);});
test('intact oval cylinder is a single surface with flat top and equal-height internal columns',()=>{
 const cells=makeMuscleCells(100,.31),visual=makeSkin(cells),skin=visual.children[0];
 assert.equal(visual.children.length,1);assert.equal(skin.geometry.type,'BufferGeometry');assert.ok(skin.geometry.attributes.position.count>1000);assert.ok([...skin.geometry.attributes.normal.array].every(Number.isFinite));
 assert.ok(cells.every(p=>Math.abs(p.half.y-.525)<1e-8));
 const pos=skin.geometry.attributes.position,norm=skin.geometry.attributes.normal,profile=cells[0].profile;
 const top=[];for(let i=0;i<pos.count;i++)if(norm.getY(i)>.995)top.push(pos.getY(i));
 assert.ok(top.length>100);assert.ok(Math.max(...top)-Math.min(...top)<.04);
 skin.geometry.dispose();skin.material.dispose();
});
test('peeling changes color but preserves the original continuous shape',()=>{
 const cells=makeMuscleCells(20,.31),visual=makeSkin(cells),skin=visual.children[0];updateSkin(visual,'#c9a65f');
 const positions=skin.geometry.attributes.position.array.slice(),colors=skin.geometry.attributes.color.array.slice();
 cells[0].detachedFromShell=true;updateSkin(visual,'#c9a65f');
 assert.equal(visual.children.length,1);assert.equal(skin.geometry.type,'BufferGeometry');assert.deepEqual(skin.geometry.attributes.position.array,positions);assert.notDeepEqual(skin.geometry.attributes.color.array,colors);
 skin.geometry.dispose();skin.material.dispose();
});
test('fully peeled intact group retains one smooth surface, not boxes',()=>{
 const cells=makeMuscleCells(20,.31);for(const p of cells)p.detachedFromShell=true;const visual=makeSkin(cells);assert.equal(visual.children.length,1);assert.equal(visual.children[0].geometry.type,'BufferGeometry');visual.children[0].geometry.dispose();visual.children[0].material.dispose();
});
test('only torn columns become boxes, including columns that were previously peeled',()=>{
 const cells=makeMuscleCells(20,.31);cells[0].detachedFromShell=true;cells[1].detachedFromShell=true;cutBonds(cells,0);const visual=makeSkin(cells),boxes=visual.children.filter(m=>m.geometry.type==='BoxGeometry');
 assert.equal(boxes.length,1);assert.equal(boxes[0].userData.cell.id,0);assert.equal(boxes[0].geometry.parameters.height,cells[0].half.y*2);assert.equal(visual.children.length,2);
 for(const mesh of visual.children){mesh.geometry.dispose();mesh.material.dispose();}
});
