// Original 16-bar melody, D / Eb / G / A / Bb, played with sampled koto notes.
export const BPM=84;
export const LOOP_BEATS=64;
const phrases=[
 [[0,'D4'],[1,'G4'],[2,'A4'],[3,'G4']],
 [[0,'Eb4'],[1.5,'D4'],[2.5,'A3']],
 [[0,'D4'],[1,'G4'],[2,'Bb4'],[3,'A4']],
 [[0,'G4'],[2,'D4']],
 [[0,'G4'],[1,'A4'],[2,'D5'],[3,'Bb4']],
 [[0,'A4'],[1.5,'G4'],[2.5,'Eb4']],
 [[0,'D4'],[1,'Eb4'],[2,'G4'],[3,'A4']],
 [[0,'G4'],[2,'D4']],
 [[0,'D5'],[1,'Eb5'],[2,'D5'],[3,'A4']],
 [[0,'Bb4'],[1.5,'A4'],[2.5,'G4']],
 [[0,'A4'],[1,'G4'],[2,'Eb4'],[3,'D4']],
 [[0,'G4'],[2,'A3']],
 [[0,'D4'],[1,'G4'],[2,'A4'],[2.75,'Bb4'],[3.5,'A4']],
 [[0,'G4'],[1.5,'Eb4'],[2.5,'D4']],
 [[0,'A3'],[1,'D4'],[2,'G4'],[3,'Eb4']],
 [[0,'D4']],
];
export const KOTO_SCORE=phrases.flatMap((phrase,bar)=>[
 ...phrase.map(([beat,note],i)=>({beat:bar*4+beat,note,gain:i===0?.25:.20})),
 {beat:bar*4+.04,note:bar%4===1?'A3':'D3',gain:.16},
 {beat:bar*4+2.04,note:bar%4===3?'D3':'A3',gain:.12},
]).sort((a,b)=>a.beat-b.beat);

export class KotoBgm {
 constructor(audio){this.audio=audio;this.buffers=new Map();this.loading=null;this.failed=false;this.nodes=new Set();this.bus=null;this.next=0;this.cycle=0;}
 async load(){
  const ctx=this.audio.context;
  try{
   const base=import.meta.env?.BASE_URL??'/';
   await Promise.all([...new Set(KOTO_SCORE.map(n=>n.note))].map(async note=>{
    const response=await fetch(`${base}audio/koto/${note}.mp3`);if(!response.ok)throw new Error(`Koto sample ${response.status}`);
    this.buffers.set(note,await ctx.decodeAudioData(await response.arrayBuffer()));
   }));
  }catch(error){this.failed=true;console.warn('琴BGMの読み込みに失敗しました。効果音のみで続行します。',error);}
 }
 update(active){
  const ctx=this.audio.context;
  if(!active||!this.audio.enabled||ctx?.state!=='running'){this.stop();return;}
  if(this.failed)return;
  if(!this.loading){this.loading=this.load();return;}
  if(this.buffers.size!==9)return;
  if(!this.bus){
   this.bus=ctx.createGain();this.bus.gain.setValueAtTime(0,ctx.currentTime);this.bus.gain.linearRampToValueAtTime(.65,ctx.currentTime+.4);this.bus.connect(ctx.destination);
   this.delay=ctx.createDelay(.5);this.delay.delayTime.value=.19;this.wet=ctx.createGain();this.wet.gain.value=.13;this.bus.connect(this.delay);this.delay.connect(this.wet);this.wet.connect(ctx.destination);
   this.origin=ctx.currentTime+.06;this.next=0;this.cycle=0;
  }
  // The animation frame is only a scheduler; AudioContext determines note timing.
  const seconds=60/BPM;
  if(this.origin+(this.cycle*LOOP_BEATS+KOTO_SCORE[this.next].beat)*seconds<ctx.currentTime-.3){this.stop();return;}
  while(true){
   const note=KOTO_SCORE[this.next],when=this.origin+(this.cycle*LOOP_BEATS+note.beat)*seconds;
   if(when>ctx.currentTime+.18)break;
   const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=this.buffers.get(note.note);
   const duration=Math.min(source.buffer.duration,2.7);gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(note.gain,when+.005);gain.gain.setValueAtTime(note.gain,when+Math.max(.01,duration-.12));gain.gain.linearRampToValueAtTime(0,when+duration);
   source.connect(gain);gain.connect(this.bus);this.nodes.add(source);source.onended=()=>{source.disconnect();gain.disconnect();this.nodes.delete(source);};source.start(when);source.stop(when+duration);
   this.next++;if(this.next===KOTO_SCORE.length){this.next=0;this.cycle++;}
  }
 }
 stop(){
  if(!this.bus)return;
  for(const source of this.nodes){try{source.stop();}catch{}source.disconnect();}this.nodes.clear();
  this.bus.disconnect();this.delay.disconnect();this.wet.disconnect();this.bus=null;
 }
}
