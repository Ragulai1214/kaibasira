// Only one active job, and one pending request per live visual. Removed groups cancel.
export class SkinJobs {
 constructor(worker){this.worker=worker;this.pending=new Map();this.active=null;this.serial=0;this.failed=false;
  worker.onmessage=({data})=>{const job=this.active;this.active=null;if(job&&!job.cancelled&&data.id===job.id&&!data.error)job.apply(data.parts);this.pump();};
  worker.onerror=()=>{this.failed=true;this.pending.clear();this.active=null;worker.terminate();};
 }
 request(key,cells,apply){if(this.failed)return;if(this.active?.key===key)this.active.cancelled=true;this.pending.set(key,{key,id:++this.serial,cells:cells.filter(p=>!p.damaged).map(p=>({id:p.id,profile:p.profile,center:p.center.toArray(),half:p.half.toArray(),lift:0,damaged:false,detachedFromShell:p.detachedFromShell})),apply});this.pump();}
 cancel(key){this.pending.delete(key);if(this.active?.key===key)this.active.cancelled=true;}
 pump(){if(this.failed||this.active||!this.pending.size)return;const [key,job]=this.pending.entries().next().value;this.pending.delete(key);this.active=job;this.worker.postMessage({id:job.id,cells:job.cells});}
 dispose(){this.pending.clear();this.active=null;this.failed=true;this.worker.terminate();}
}
