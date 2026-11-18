import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {KotoBgm,KOTO_SCORE,LOOP_BEATS,BPM} from '../src/koto-bgm.js';

test('every composed koto note has a bundled sample and falls inside the loop',()=>{
 for(const n of KOTO_SCORE){assert.ok(n.beat>=0&&n.beat<LOOP_BEATS);assert.ok(existsSync(new URL(`../public/audio/koto/${n.note}.mp3`,import.meta.url)));}
 assert.equal(new Set(KOTO_SCORE.map(n=>n.note)).size,9);
});
test('music schedules across loop boundary and stops on mute or hidden game',()=>{
 const scheduled=[],sources=[],param={setValueAtTime(){},linearRampToValueAtTime(){}};
 const node=()=>({connect(){},disconnect(){},gain:param,delayTime:{value:0}});
 const ctx={state:'running',currentTime:0,destination:{},createGain:node,createDelay:node,createBufferSource(){const s={...node(),start(t){scheduled.push(t);},stop(){s.stopped=true;}};sources.push(s);return s;}};
 const audio={enabled:true,context:ctx},music=new KotoBgm(audio);music.loading=Promise.resolve();for(const n of KOTO_SCORE)music.buffers.set(n.note,{duration:2});
 music.update(true);assert.ok(scheduled.length>0);
 for(let t=.05;t<LOOP_BEATS*60/BPM+.5;t+=.05){ctx.currentTime=t;music.update(true);}
 assert.ok(music.cycle>=1);assert.ok(scheduled.every((t,i)=>!i||t>=scheduled[i-1]));
 audio.enabled=false;music.update(true);assert.equal(music.bus,null);assert.ok(sources.every(s=>s.stopped));
 const count=scheduled.length;music.update(true);assert.equal(scheduled.length,count);
 audio.enabled=true;music.update(true);assert.ok(music.bus);music.update(false);assert.equal(music.bus,null);
});
