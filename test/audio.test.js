import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameAudio} from '../src/game-audio.js';
test('interaction sounds respect mute, suspended audio, rate limits and break priority',()=>{
 const audio=new GameAudio(),voices=[];audio.context={state:'running',currentTime:1};audio.voice=(...args)=>voices.push(args);
 audio.interaction({scraping:true});assert.equal(voices.length,1);
 for(let i=0;i<100;i++)audio.interaction({scraping:true});assert.equal(voices.length,1);
 audio.context.currentTime+=.11;audio.interaction({scraping:true});assert.equal(voices.length,2);
 voices.length=0;audio.interaction({scraping:true,peeled:20,broken:10});assert.equal(voices.length,2);assert.equal(voices[0][0],900);
 voices.length=0;audio.interaction({released:1});assert.equal(voices.length,2);assert.equal(voices[0][0],310);
 voices.length=0;audio.enabled=false;audio.context.currentTime+=1;audio.interaction({peeled:1,broken:1,released:1});assert.equal(voices.length,0);
 audio.enabled=true;audio.context.state='suspended';audio.interaction({peeled:1});assert.equal(voices.length,0);
 audio.context.state='running';audio.interaction({peeled:1});assert.equal(voices.length,2);assert.equal(voices[0][0],420);
});
