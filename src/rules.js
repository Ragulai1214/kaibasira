export const config = {duration:60,count:100,size:.3,stiffness:45,damping:8,sensitivity:1.3,maxSpeed:10,peel:.6,break:.8,fragmentSpeed:6,fragmentSpin:8,floatHeight:.2,peelLaunchSpeed:7,peeledColor:'#e9cfb4'};
export function classify(force,c=config){return force>c.break?'break':force>=c.peel?'peel':'blocked';}
// Material bonds are never recreated by physical contact.
export function connectGrid(items){
 const grid=new Map(items.map(p=>[`${p.gx},${p.gz}`,p]));
 for(const p of items){p.links=new Set();for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const q=grid.get(`${p.gx+dx},${p.gz+dz}`);if(q)p.links.add(q.id);}}
}
export function cutBonds(items,id){
 const byId=new Map(items.map(p=>[p.id,p])),p=byId.get(id);
 for(const other of p.links)byId.get(other)?.links.delete(id);
 p.links.clear();p.damaged=true;p.detachedFromShell=true;
}
export function components(items,predicate=()=>true){
 const byId=new Map(items.filter(predicate).map(p=>[p.id,p])),seen=new Set(),groups=[];
 for(const p of byId.values()){
  if(seen.has(p.id))continue;const group=[],stack=[p];seen.add(p.id);
  while(stack.length){const current=stack.pop();group.push(current);for(const id of current.links){if(byId.has(id)&&!seen.has(id)){seen.add(id);stack.push(byId.get(id));}}}
  groups.push(group);
 }return groups;
}
export function assess(items){
 const peeled=components(items,p=>p.detachedFromShell),all=components(items);
 const score=Math.max(0,...peeled.map(g=>g.length)),remaining=items.filter(p=>!p.detachedFromShell).length;
 const canImprove=all.some(g=>g.length>score&&g.some(p=>!p.detachedFromShell));
 return {score,peeled:items.length-remaining,remaining,damaged:items.filter(p=>p.damaged).length,potential:Math.max(0,...all.map(g=>g.length)),reason:remaining===0?'all-peeled':!canImprove?'no-improvement':null};
}
