import * as THREE from 'three';
import {config as C,assess} from './rules.js';
import {makeShell,makeMuscleCells} from './models.js';
import {GamePhysics,ready,FLOOR_Y} from './physics.js';
import {addHiddenSpatulaOutline,surfaceStencil} from './spatula-outline.js';
import {createResultScene,resultSnapshot} from './result-scene.js';
import {GameAudio} from './game-audio.js';
import {resultComment} from './result-comment.js';

const $=id=>document.getElementById(id);
const renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true,stencil:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#214741');renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
// A slightly inclined overhead view makes vertical flight and shell curvature readable.
const camera=new THREE.OrthographicCamera(-8,8,5,-5,.1,80);camera.position.set(0,22,6);camera.lookAt(0,0,0);
scene.add(new THREE.HemisphereLight(0xfff6dc,0x37505b,1.5));
const light=new THREE.DirectionalLight(0xffffff,1.8);light.position.set(-4,10,-6);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-12,right:12,top:9,bottom:-9});light.shadow.normalBias=.018;scene.add(light);
function mesh(geo,color,metalness=0){return new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:metalness?.3:.65,metalness,...surfaceStencil()}));}
const shell=makeShell();scene.add(shell);
const table=mesh(new THREE.PlaneGeometry(50,50),'#426d64');table.rotation.x=-Math.PI/2;table.position.y=FLOOR_Y;table.receiveShadow=true;scene.add(table);
const spatula=new THREE.Group();scene.add(spatula);
const blade=mesh(new THREE.BoxGeometry(1.1,.07,.5),'#dce9e3',.85);spatula.add(blade);
const handle=mesh(new THREE.BoxGeometry(.23,.19,1.25),'#6b482b');handle.position.set(0,.1,.88);spatula.add(handle);
const band=mesh(new THREE.BoxGeometry(.28,.21,.15),'#c5c9bf',.8);band.position.set(0,.1,.5);spatula.add(band);
for(const part of spatula.children){part.castShadow=true;part.receiveShadow=true;}
addHiddenSpatulaOutline(spatula);
let physics=null,cells=[],status=null,running=false,finished=false,time=C.duration,last=performance.now(),accumulator=0;
let angle=0,force=0,rawForce=0,lastMove=0,movePointer=null,dialPointer=null,previous=null;
let resultView=null,celebration=null,roundDuration=C.duration;
const fanfare=new GameAudio();
document.addEventListener('visibilitychange',()=>{if(document.hidden)fanfare.stop();});
const pending=new THREE.Vector2(),keys=new Set(),step=1/120;
function resize(){const aspect=innerWidth/innerHeight,halfHeight=Math.max(4.8,5.3/aspect);renderer.setSize(innerWidth,innerHeight);camera.top=halfHeight;camera.bottom=-halfHeight;camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.updateProjectionMatrix();}
window.addEventListener('resize',()=>{resize();resultView?.resize(innerWidth,innerHeight);});resize();
function clearInput(){pending.set(0,0);force=rawForce=0;movePointer=dialPointer=null;previous=null;keys.clear();}
function hud(){status=assess(cells);$('time').textContent=Math.ceil(time);$('score').textContent=status.score;$('counts').textContent=`剥離 ${status.peeled} / ${cells.length} 本 · 最大の塊 ${status.score} 本`;}
function reset(){
 resultView?.dispose();resultView=null;celebration=null;fanfare.stop();roundDuration=C.duration;document.body.classList.remove('celebrating');$('result-screen').hidden=true;$('result-transition').style.opacity=0;
 physics?.dispose();cells=makeMuscleCells(C.count,C.size);physics=new GamePhysics(cells,shell.children[0].geometry,C,scene);time=C.duration;angle=0;finished=false;accumulator=0;clearInput();hud();physics.render();$('feedback').textContent='ヘラを貝柱に差し込もう';
}
function finish(reason){
 if(!running)return;running=false;finished=true;fanfare.music.stop();clearInput();hud();
 const snapshot=resultSnapshot(cells,roundDuration,time);physics.render();
 celebration={elapsed:0,shown:false,poses:physics.groups.filter(g=>g.skin).map(g=>({skin:g.skin,y:g.skin.position.y}))};
 resultView=createResultScene(snapshot.cluster);resultView.resize(innerWidth,innerHeight);
 document.body.classList.add('celebrating');$('debug').hidden=true;
 const reasons={'all-peeled':'全ての貝柱が剥がれました！','no-improvement':'どの塊も、これ以上点数を更新できません','timeout':'制限時間になりました'};
 $('result-score').textContent=snapshot.score;$('result-time').textContent=snapshot.seconds.toFixed(1);
 $('result-comment').textContent=resultComment(snapshot.score);
 $('result-reason').textContent=reasons[reason];$('result-detail').textContent=`最大の塊 ${snapshot.score} 本 · 剥離 ${status.peeled} 本 / 未剥離 ${status.remaining} 本`;
}
$('start').disabled=true;$('start').textContent='3D物理を準備中…';
$('start').onclick=()=>{fanfare.unlock();reset();running=true;$('overlay').hidden=true;last=performance.now();};
$('retry').onclick=()=>$('start').click();
$('sound').onclick=()=>{fanfare.enabled=!fanfare.enabled;$('sound').textContent=fanfare.enabled?'音：ON':'音：OFF';$('sound').setAttribute('aria-pressed',String(fanfare.enabled));if(fanfare.enabled)fanfare.unlock();else fanfare.stop();};
$('settings').onclick=()=>{$('debug').hidden=!$('debug').hidden;};$('restart').onclick=()=>{$('debug').hidden=true;$('start').click();};
const parameters=[['duration','制限時間',10,180,5],['count','内部直方体の本数',20,160,1],['size','内部直方体の幅',.2,.4,.01],['stiffness','バネ定数',10,100,1],['damping','減衰',2,20,.5],['sensitivity','スワイプ感度',.3,3,.1],['maxSpeed','最大移動速度',2,15,.5],['peel','剥離閾値',.05,.65,.05],['break','破損閾値',.35,.95,.05],['fragmentSpeed','破片の横方向速度',1,8,.5],['fragmentSpin','空中の回転速度',0,10,.5],['floatHeight','剥離部分の浮く高さ',.12,.35,.01],['peelLaunchSpeed','完全剥離時の跳ぶ勢い',2,9,.5]];
for(const [key,name,min,max,inc] of parameters){
 const label=document.createElement('label');label.textContent=name;const input=document.createElement('input');Object.assign(input,{type:'number',min,max,step:inc,value:C[key]});
 input.onchange=()=>{const value=Number(input.value);if(Number.isFinite(value))C[key]=Math.max(min,Math.min(max,value));if(key==='peel')C.peel=Math.min(C.peel,C.break-.05);if(key==='break')C.break=Math.max(C.break,C.peel+.05);input.value=C[key];$('force').querySelector('.track').style.background=`linear-gradient(to right,#738f96 0 ${C.peel*100}%,#d8d797 ${C.peel*100}% ${C.break*100}%,#ef8268 ${C.break*100}%)`;};label.append(input);$('parameters').append(label);
}
const colorLabel=document.createElement('label');colorLabel.textContent='剥離済みの色';const colorInput=document.createElement('input');colorInput.type='color';colorInput.value=C.peeledColor;colorInput.oninput=()=>{C.peeledColor=colorInput.value;};colorLabel.append(colorInput);$('parameters').append(colorLabel);
const dial=$('dial'),canvas=$('scene');
function rotate(e){const r=dial.getBoundingClientRect();angle=-Math.atan2(e.clientX-r.left-r.width/2,-(e.clientY-r.top-r.height/2));}
// Keep rotation and translation pointers independent throughout capture/cancellation.
 dial.addEventListener('pointerdown',e=>{if(!running||dialPointer!==null)return;e.preventDefault();dialPointer=e.pointerId;dial.setPointerCapture(e.pointerId);rotate(e);});
 dial.addEventListener('pointermove',e=>{if(e.pointerId===dialPointer&&running)rotate(e);});
canvas.addEventListener('pointerdown',e=>{if(!running||movePointer!==null)return;movePointer=e.pointerId;canvas.setPointerCapture(e.pointerId);previous={x:e.clientX,y:e.clientY,t:e.timeStamp};pending.set(0,0);rawForce=force=0;});
canvas.addEventListener('pointermove',e=>{if(!running||e.pointerId!==movePointer||!previous)return;const dx=e.clientX-previous.x,dy=e.clientY-previous.y,dt=Math.max((e.timeStamp-previous.t)/1000,.004),scale=(camera.top-camera.bottom)/innerHeight;pending.x+=dx*scale;pending.y+=dy*scale;pending.clampLength(0,1.5);rawForce=Math.min(1,Math.hypot(dx,dy)*scale/dt/12*C.sensitivity);lastMove=performance.now();previous={x:e.clientX,y:e.clientY,t:e.timeStamp};});
function release(e){if(e.pointerId===movePointer){movePointer=null;previous=null;pending.set(0,0);rawForce=force=0;}if(e.pointerId===dialPointer)dialPointer=null;}
for(const el of [dial,canvas])for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,release);
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement)return;if(['ArrowLeft','ArrowRight','a','d','A','D'].includes(e.key)){e.preventDefault();keys.add(e.key.toLowerCase());}});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{clearInput();last=performance.now();accumulator=0;});
function simulate(dt){
 if(running){
  if(keys.has('a')||keys.has('arrowleft'))angle+=dt*2.5;if(keys.has('d')||keys.has('arrowright'))angle-=dt*2.5;
  if(performance.now()-lastMove>70)rawForce=0;force+=(rawForce-force)*(1-Math.exp(-dt*22));
  const delta=pending.clone().clampLength(0,C.maxSpeed*dt);pending.sub(delta);const current=physics.tool.translation();
  const result=physics.interact({x:THREE.MathUtils.clamp(current.x+delta.x,camera.left+.6,camera.right-.6),z:THREE.MathUtils.clamp(current.z+delta.y,-4,4)},angle,force,rawForce,dt);
  if(result.blocked)pending.set(0,0);$('feedback').textContent=physics.feedback;
  fanfare.interaction(result.audio);
  if(result.changed){hud();if(result.status.reason)finish(result.status.reason);}
 }
 if(running)physics.step(dt);
}
function frame(now){
 const elapsed=(now-last)/1000;last=now;
 fanfare.music.update(running&&!document.hidden);
 if(physics&&!document.hidden){
  if(running){time=Math.max(0,time-elapsed);if(time<=0)finish('timeout');}
  if(running){accumulator+=Math.min(elapsed,.1);while(accumulator>=step&&running){simulate(step);accumulator-=step;}}
  shell.position.copy(physics.shell.translation());shell.quaternion.copy(physics.shell.rotation());spatula.position.copy(physics.tool.translation());spatula.quaternion.copy(physics.tool.rotation());if(!finished)physics.render();
  if(celebration){
   celebration.elapsed+=Math.min(elapsed,.1);const t=celebration.elapsed;
   for(const pose of celebration.poses)pose.skin.position.y=pose.y+1.8*(1-(1-Math.min(t,1))**3);
   $('result-transition').style.opacity=String(t<1?Math.max(0,(t-.65)/.35):Math.max(0,1-(t-1)/.4));
   if(t>=1&&!celebration.shown){celebration.shown=true;$('result-screen').hidden=false;fanfare.play();$('retry').focus({preventScroll:true});}
   if(celebration.shown)resultView.update(t-1);
  }
  $('time').textContent=Math.ceil(time);$('dial-arrow').style.transform=`rotate(${-angle*180/Math.PI}deg)`;$('needle').style.left=`${force*100}%`;
 }
 if(celebration?.shown)renderer.render(resultView.scene,resultView.camera);else renderer.render(scene,camera);requestAnimationFrame(frame);
}
ready.then(()=>{reset();renderer.render(scene,camera);$('start').disabled=false;$('start').textContent='実験をはじめる →';document.body.classList.remove('booting');$('boot-screen').hidden=true;}).catch(error=>{$('boot-message').textContent='3Dの準備に失敗しました。再読み込みしてください。';$('boot-reload').hidden=false;console.error(error);});
requestAnimationFrame(frame);
