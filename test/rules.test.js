import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classify,connectGrid,cutBonds,components,assess} from '../src/rules.js';
function board(rows){const cells=[];for(const [gz,row] of rows.entries())for(const [gx,ch] of [...row].entries())if(ch!==' ')cells.push({id:cells.length,gx,gz,detachedFromShell:ch==='Q',damaged:false});connectGrid(cells);return cells;}
test('threshold boundaries preserve weak / peel / break bands',()=>{assert.equal(classify(.299),'blocked');assert.equal(classify(.3),'peel');assert.equal(classify(.7),'peel');assert.equal(classify(.701),'break');});
test('score is largest peeled component count, never total or percent',()=>{const s=assess(board(['QQQ  QQ Q']));assert.equal(s.score,3);assert.equal(s.peeled,6);});
test('first user example continues while attached cells can enlarge peeled group',()=>{const s=assess(board(['OO','QQQQ','QQQQQ']));assert.equal(s.score,9);assert.equal(s.reason,null);assert.equal(s.potential,11);});
test('second user example ends when detached remainder cannot beat largest',()=>{const s=assess(board(['OO','','QQQQQ','QQQQQQ']));assert.equal(s.score,11);assert.equal(s.reason,'no-improvement');});
test('another smaller group can grow past current leader, so continue',()=>{const s=assess(board(['QQQ   QOOO']));assert.equal(s.score,3);assert.equal(s.reason,null);});
test('ties without any higher attainable score finish',()=>assert.equal(assess(board(['QQQ  OOO'])).reason,'no-improvement'));
test('all peeled ends immediately, even with several separate groups',()=>assert.equal(assess(board(['QQ Q'])).reason,'all-peeled'));
test('unpeeled bridge joins future potential, not current peeled score',()=>{const s=assess(board(['QQOQQ']));assert.equal(s.score,2);assert.equal(s.potential,5);assert.equal(s.reason,null);});
test('cutting bridge splits groups permanently and recalculates current score',()=>{const cells=board(['QQQQQ']);cutBonds(cells,2);assert.equal(assess(cells).score,2);assert.equal(components(cells).length,3);assert.equal(cells[1].links.has(2),false);assert.equal(cells[3].links.has(2),false);});
test('breaking an attached column peels it, but does not give it the whole-group score',()=>{const cells=board(['QOQ']);cutBonds(cells,1);assert.equal(assess(cells).score,1);assert.equal(assess(cells).reason,'all-peeled');});
