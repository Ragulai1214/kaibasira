import * as THREE from 'three';

// Ordinary surfaces clear the stencil; muscle surfaces write 1 at visible pixels.
export const surfaceStencil = (muscle=false) => ({
 stencilWrite:true,
 stencilRef:muscle?1:0,
 stencilFunc:THREE.AlwaysStencilFunc,
 stencilFail:THREE.KeepStencilOp,
 stencilZFail:THREE.KeepStencilOp,
 stencilZPass:THREE.ReplaceStencilOp,
});

export function addHiddenSpatulaOutline(spatula){
 const material=new THREE.LineDashedMaterial({
  color:'#163f4c',dashSize:.09,gapSize:.055,transparent:true,opacity:.95,
  depthTest:true,depthWrite:false,depthFunc:THREE.GreaterDepth,toneMapped:false,
  stencilWrite:true,stencilRef:1,stencilFunc:THREE.EqualStencilFunc,
  stencilFail:THREE.KeepStencilOp,stencilZFail:THREE.KeepStencilOp,stencilZPass:THREE.KeepStencilOp,
 });
 // Draw the top perimeter of each part, slightly above its own surface. GreaterDepth
 // reveals ONLY portions behind the muscle, never the visible tool or the shell.
 for(const [width,length,z,y] of [[1.1,.5,0,.038],[.23,1.25,.88,.198],[.28,.15,.5,.208]]){
  const points=[[-width/2,-length/2],[width/2,-length/2],[width/2,length/2],[-width/2,length/2],[-width/2,-length/2]].map(([x,dz])=>new THREE.Vector3(x,y,z+dz));
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),material);
  line.computeLineDistances();line.renderOrder=1000;spatula.add(line);
 }
}
