import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Box3} from 'three';
import {makeMuscleCells} from '../src/models.js';
import {cutBonds} from '../src/rules.js';
import {resultSnapshot,createResultScene} from '../src/result-scene.js';
test('result uses largest peeled cluster and freezes elapsed seconds',()=>{
 const cells=makeMuscleCells(20,.31);for(const p of cells)p.detachedFromShell=true;cutBonds(cells,cells[0].id);
 const result=resultSnapshot(cells,60,42.37);assert.equal(result.score,19);assert.equal(result.seconds,17.6);
 assert.equal(resultSnapshot(cells,60,0).seconds,60);
});
test('served muscle lands on the plate and stays still after landing',()=>{
 const cells=makeMuscleCells(100,.31);for(const p of cells)p.detachedFromShell=true;
 const view=createResultScene(cells);
 view.update(0);assert.ok(view.hero.position.y>1);
 view.update(1.25);const position=view.hero.position.clone(),rotation=view.hero.quaternion.clone();
 assert.ok(Math.abs(new Box3().setFromObject(view.hero).min.y-.15)<1e-6);
 for(const t of [2,5,20,100]){view.update(t);assert.ok(view.hero.position.equals(position));assert.ok(view.hero.quaternion.equals(rotation));}
 view.dispose();
});
test('empty result does not invent sashimi; plated scene resizes and disposes',()=>{
 const cells=makeMuscleCells(20,.31);assert.equal(resultSnapshot(cells,60,60).score,0);
 for(const cluster of [[],cells]){const view=createResultScene(cluster);assert.equal(view.hero.children.length,cluster.length?1:0);view.resize(800,400);assert.equal(view.camera.aspect,2);view.update(3);assert.ok(Number.isFinite(view.hero.position.y));view.dispose();}
});
