import {Fanfare} from './result-scene.js';
import {KotoBgm} from './koto-bgm.js';

export class GameAudio extends Fanfare {
 constructor(){super();this.lastSound={};this.noise=null;this.music=new KotoBgm(this);}
 stop(){super.stop();this.lastSound={};this.music.stop();}
 voice(frequency,endFrequency,duration,volume,type='sine',noise=false){
  const ctx=this.context,t=ctx.currentTime,gain=ctx.createGain();
  let source,filter;
  if(noise){
   if(!this.noise){this.noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.5),ctx.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}
   source=ctx.createBufferSource();source.buffer=this.noise;filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.setValueAtTime(frequency,t);filter.frequency.exponentialRampToValueAtTime(endFrequency,t+duration);filter.Q.value=.8;source.connect(filter);filter.connect(gain);
  }else{source=ctx.createOscillator();source.type=type;source.frequency.setValueAtTime(frequency,t);source.frequency.exponentialRampToValueAtTime(endFrequency,t+duration);source.connect(gain);}
  gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+.008);gain.gain.exponentialRampToValueAtTime(.001,t+duration);gain.connect(ctx.destination);
  this.nodes.push(source);source.onended=()=>{source.disconnect();filter?.disconnect();gain.disconnect();const i=this.nodes.indexOf(source);if(i>=0)this.nodes.splice(i,1);};source.start(t);source.stop(t+duration+.015);
 }
 effect(name,interval,play){const ctx=this.context;if(!this.enabled||ctx?.state!=='running')return;if(ctx.currentTime-(this.lastSound[name]??-Infinity)<interval)return;this.lastSound[name]=ctx.currentTime;play();}
 interaction({scraping=false,peeled=0,broken=0,released=0}={}){
  // Short grains stop naturally when input stops; no endlessly running scrape loop.
  if(broken)this.effect('break',.09,()=>{this.voice(900,120,.14,.14,'sine',true);this.voice(230,65,.19,.09,'triangle');});
  else if(peeled)this.effect('peel',.065,()=>{this.voice(420,780,.085,.045);this.voice(1300,650,.07,.04,'sine',true);});
  else if(scraping)this.effect('scrape',.10,()=>this.voice(1050,650,.085,.04,'sine',true));
  if(released)this.effect('release',.18,()=>{this.voice(310,940,.23,.085);this.voice(620,1250,.27,.035,'triangle');});
 }
}
