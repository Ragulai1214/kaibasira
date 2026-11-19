import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {SkinJobs} from '../src/skin-jobs.js';
import {makeMuscleCells,makeSkin,subsetSkin,updateSkin,disposeSkin,unpackSkin} from '../src/models.js';
import {createResultScene} from '../src/result-scene.js';
import * as THREE from 'three';
import {GamePhysics,ready} from '../src/physics.js';
import {makeShell,packSkin} from '../src/models.js';
import {config,cutBonds} from '../src/rules.js';

test('cancelled and superseded skin jobs never apply, pending jobs coalesce',()=>{
 const sent=[],worker={postMessage:m=>sent.push(m),terminate(){}},jobs=new SkinJobs(worker),cells=makeMuscleCells(20,.3),applied=[];
 jobs.request('a',cells,()=>applied.push('old'));
 jobs.request('a',cells,()=>applied.push('new'));
 jobs.request('a',cells,()=>applied.push('latest'));
 assert.equal(sent.length,1);worker.onmessage({data:{id:sent[0].id,parts:[]}});
 assert.deepEqual(applied,[]);assert.equal(sent.length,2);
 worker.onmessage({data:{id:sent[1].id,parts:[]}});assert.deepEqual(applied,['latest']);
 jobs.request('b',cells,()=>applied.push('removed'));jobs.cancel('b');worker.onmessage({data:{id:sent[2].id,parts:[]}});assert.deepEqual(applied,['latest']);jobs.dispose();
});
test('unchanged surfaces do not upload vertices or colors; peeling only uploads color',()=>{
 const cells=makeMuscleCells(20,.3),skin=makeSkin(cells),g=skin.children[0].geometry;updateSkin(skin,'#e9cfb4');
 const pv=g.attributes.position.version,cv=g.attributes.color.version;updateSkin(skin,'#e9cfb4');assert.equal(g.attributes.position.version,pv);assert.equal(g.attributes.color.version,cv);
 cells[0].detachedFromShell=true;updateSkin(skin,'#e9cfb4');assert.equal(g.attributes.position.version,pv);assert.equal(g.attributes.color.version,cv+1);
 cells[0].lift=.1;updateSkin(skin,'#e9cfb4');assert.equal(g.attributes.position.version,pv+1);assert.equal(g.attributes.color.version,cv+1);disposeSkin(skin);
});
test('temporary cut surfaces exclude removed cells without turning intact cells into boxes',()=>{
 const cells=makeMuscleCells(20,.3),skin=makeSkin(cells),remaining=cells.slice(5),cut=subsetSkin(skin,remaining),ids=new Set(remaining.map(p=>p.id));
 assert.ok(cut.children.length);for(const mesh of cut.children){assert.equal(mesh.userData.cell,undefined);assert.ok(mesh.userData.weights.flat().every(n=>ids.has(n.p.id)));}disposeSkin(cut);disposeSkin(skin);
});
test('result props survive replacing and clearing the served muscle',()=>{
 const cells=makeMuscleCells(20,.3),skin=makeSkin(cells),view=createResultScene([]),plate=view.scene.getObjectByName('rectangular-sashimi-plate');
 view.setCluster(cells,skin);assert.equal(view.hero.children.length,1);view.clearFood();assert.equal(view.hero.children.length,0);assert.equal(view.scene.getObjectByName('rectangular-sashimi-plate'),plate);view.dispose();disposeSkin(skin);
});
test('worker creates transferable geometry that binds to the current cells',async()=>{
 const url=new URL('../src/skin-worker.js',import.meta.url).href;
 const worker=new Worker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:(data,transfer)=>parentPort.postMessage(data,transfer)};import(${JSON.stringify(url)}).then(()=>parentPort.on('message',data=>self.onmessage({data})));`,{eval:true});
 try{
  const cells=makeMuscleCells(20,.3).slice(1),data=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({id:1,cells:cells.map(p=>({...p,center:p.center.toArray(),half:p.half.toArray()}))});});
  assert.equal(data.error,undefined);const skin=unpackSkin(data.parts,cells);assert.ok(skin.children[0].geometry.attributes.position.count>0);assert.ok(skin.children[0].userData.weights.flat().every(n=>cells.includes(n.p)));updateSkin(skin,'#e9cfb4');disposeSkin(skin);
 }finally{await worker.terminate();}
});
test('physics applies finished skin to the current moving group and cancels removed groups',async()=>{
 await ready;const pending=new Map(),jobs={request(key,cells,apply){pending.set(key,{cells,apply});},cancel(key){pending.delete(key);}};
 const scene=new THREE.Scene(),g=new GamePhysics(makeMuscleCells(20,.3),makeShell().children[0].geometry,{...config},scene,jobs);
 cutBonds(g.cells,0);g.rebuild({x:1,z:0},new Set([0]));assert.equal(pending.size,1);
 const [group,job]=pending.entries().next().value,parent=group.skin;parent.position.set(2,3,4);
 const generated=makeSkin(job.cells.filter(p=>!p.damaged));job.apply(packSkin(generated));disposeSkin(generated);
 assert.equal(group.skin,parent);assert.deepEqual(parent.position.toArray(),[2,3,4]);assert.ok(parent.children.length);
 cutBonds(g.cells,1);g.rebuild({x:1,z:0},new Set([1]));assert.equal(pending.has(group),false);
 g.dispose();assert.equal(pending.size,0);assert.equal(scene.children.length,0);
});
