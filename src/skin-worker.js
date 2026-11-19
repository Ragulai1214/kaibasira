import * as THREE from 'three';
import {makeSkin,packSkin} from './models.js';
self.onmessage=({data})=>{
 try{
  const cells=data.cells.map(p=>({...p,center:new THREE.Vector3(...p.center),half:new THREE.Vector3(...p.half)}));
  const skin=makeSkin(cells),parts=packSkin(skin);
  const transfer=parts.flatMap(p=>[p.positions.buffer,p.normals.buffer,p.ids.buffer,p.weights.buffer]);
  self.postMessage({id:data.id,parts},transfer);
  skin.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
 }catch(error){self.postMessage({id:data.id,error:String(error)});}
};
