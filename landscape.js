'use strict';
Object.assign(MarsExpedition.prototype,{
  prepareHillMaterial(geometry){
    const T=this.T,p=geometry.attributes.position,n=geometry.attributes.normal,mask=[],variation=[];
    for(let i=0;i<p.count;i++){
      const height=Math.max(0,Math.min(1,(p.getY(i)-.45)/3.0));
      const slope=Math.max(0,Math.min(1,(1-n.getY(i))/.22));
      const x=p.getX(i),z=p.getZ(i),broad=this.noise(x*.025+31,z*.025-17),patch=this.noise(x*.095-9,z*.095+23);
      // Irregular dust pockets interrupt rock coverage instead of covering every hill equally.
      mask.push(Math.max(height,slope)*(.45+.5*patch));
      variation.push(broad,patch,this.noise(x*.043+73,z*.043+51));
    }
    geometry.setAttribute('hillBlend',new T.Float32BufferAttribute(mask,1));
    geometry.setAttribute('terrainVariation',new T.Float32BufferAttribute(variation,3));
    this.hillUniforms={hillMap:{value:this.groundMaterial.map},hillNormal:{value:this.groundMaterial.normalMap}};
    this.groundMaterial.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,this.hillUniforms);
      shader.vertexShader='attribute float hillBlend; attribute vec3 terrainVariation; varying float vHillBlend; varying vec2 vHillUv; varying vec3 vTerrainVariation;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHillBlend=hillBlend;vHillUv=vec2(position.x,-position.z)*.21;vTerrainVariation=terrainVariation;');
      shader.fragmentShader=`uniform sampler2D hillMap; uniform sampler2D hillNormal;
        varying float vHillBlend; varying vec2 vHillUv; varying vec3 vTerrainVariation;
        // One sample per surface, with different orientations and non-periodic vertex warping.
        // Keep variation without the previous eight texture reads per terrain pixel.
        const mat2 terrainRotationA=mat2(.8,.6,-.6,.8);
        const mat2 terrainRotationB=mat2(.6,-.8,.8,.6);
        vec2 terrainUvA(vec2 uv){return terrainRotationA*(uv+(vTerrainVariation.xz-.5)*2.4);}
        vec2 terrainUvB(vec2 uv){return terrainRotationB*(uv*1.618+(vTerrainVariation.zx-.5)*1.7)+vec2(19.37,7.13);}
        vec4 terrainNormal(sampler2D tex,vec2 uv){
          vec3 a=texture2D(tex,terrainUvA(uv)).xyz*2.0-1.0;
          a.xy=(a.xy*terrainRotationA)*mix(.48,.25,vHillBlend);
          return vec4(a*.5+.5,1.0);
        }
        \n`+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
        vec4 groundTexel=texture2D(map,terrainUvA(vHillUv*1.12));
        vec4 hillTexel=texture2D(hillMap,terrainUvB(vHillUv*.77));
        vec4 surfaceTexel=mix(groundTexel,hillTexel,smoothstep(0.0,1.0,vHillBlend));
        float dust=smoothstep(.3,.8,vTerrainVariation.z)*(1.0-vHillBlend*.6);
        surfaceTexel.rgb=mix(surfaceTexel.rgb,vec3(.48,.32,.22),dust*.24);
        vec3 broadTint=mix(vec3(.77,.72,.68),vec3(1.10,1.04,.93),vTerrainVariation.x);
        diffuseColor*=vec4(surfaceTexel.rgb*broadTint, surfaceTexel.a);
        #endif`);
      const chunk=this.T.ShaderChunk.normal_fragment_maps;
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',chunk.replace('texture2D( normalMap, vNormalMapUv )','terrainNormal(normalMap,vHillUv*1.12)'));
    };
    this.groundMaterial.customProgramCacheKey=()=> 'mars-varied-terrain-lite-v3';
  },
  async loadHillAssets(){
    const T=this.T,loader=new T.TextureLoader();
    try{
      const [map,normal]=await Promise.all(['hill-color.jpg','hill-normal.jpg'].map(f=>loader.loadAsync('assets/'+f)));map.colorSpace=T.SRGBColorSpace;
      for(const t of[map,normal]){t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(4,this.scene.renderer.capabilities.getMaxAnisotropy());this.textures.push(t);}
      this.hillUniforms.hillMap.value=map;this.hillUniforms.hillNormal.value=normal;
    }catch(error){console.warn('Hill texture fallback',error);}
  },
  detailStation(base){
    const T=this.T;
    const hull=this.material('#b8afa0',{metalness:.3,roughness:.6}),trim=this.material('#575b58',{metalness:.65,roughness:.4}),dark=this.material('#242b2c',{metalness:.35,roughness:.72}),windowMat=this.material('#314d58',{metalness:.72,roughness:.16}),solar=this.material('#172c41',{metalness:.5,roughness:.28});
    const cube=(size,mat,pos)=>this.mesh(base,new T.BoxGeometry(...size),mat,pos,true);
    // Pressurised entry vestibule, framed hatch, steps and equipment housings.
    cube([1.7,2.3,1.35],hull,[0,1.2,1.85]);cube([1.18,1.92,.10],trim,[0,1.17,2.55]);cube([.93,1.67,.12],dark,[0,1.17,2.62]);
    const port=this.mesh(base,new T.CylinderGeometry(.24,.24,.04,24),windowMat,[0,1.63,2.70]);port.object3D.rotation.x=Math.PI/2;
    cube([.08,.33,.09],hull,[.30,.93,2.73]);this.label(base,'AIRLOCK 01',[0,2.11,2.72],1.0,.17,{size:42,color:'#e7d5ad'});
    for(let i=0;i<3;i++)cube([1.6,.10,.42],trim,[0,.10+i*.10,3.6-i*.4]);
    for(const x of[-.88,.88]){cube([.04,.8,1.0],trim,[x,.7,3.1]);cube([.06,.8,.06],trim,[x,.4,3.5]);}
    for(const x of[-1.6,1.6]){cube([.82,.66,.12],trim,[x,2.01,1.35]);cube([.65,.48,.13],windowMat,[x,2.01,1.43]);}
    for(const x of[-2.5,2.5]){cube([.10,2.2,1.7],trim,[x,1.45,0]);cube([.9,.65,1.0],dark,[x,.5,-1.7]);}
    this.label(base,'ARES  /  SCIENCE OUTPOST',[-.1,3.25,.68],3,.23,{size:40,color:'#ded6c7'});
    for(let i=0;i<6;i++)cube([.68,.035,.04],trim,[2.5,.31+i*.065,-2.22]);
    // Solar wings use thin cell dividers and inclined support frames.
    for(const x of[-4.5,4.5]){
      const wing=this.entity(base,[x,1,-.3]);wing.object3D.rotation.z=x<0?-.18:.18;
      this.mesh(wing,new T.BoxGeometry(2.8,.10,3.4),trim,[0,0,0],true);this.mesh(wing,new T.BoxGeometry(2.64,.02,3.24),solar,[0,.065,0]);
      for(let i=-2;i<=2;i++)this.mesh(wing,new T.BoxGeometry(.016,.012,3.2),hull,[i*.51,.084,0]);
      for(let i=-2;i<=2;i++)this.mesh(wing,new T.BoxGeometry(2.62,.012,.016),hull,[0,.084,i*.6]);
      cube([.12,1,.12],trim,[x,.45,-.3]);
    }
    const mast=this.mesh(base,new T.CylinderGeometry(.04,.05,3.5,10),trim,[2.8,2.7,-1.2],true);
    const dish=this.mesh(base,new T.SphereGeometry(.65,24,12,0,Math.PI*2,0,Math.PI*.40),hull,[2.8,4.28,-1.2],true);dish.object3D.rotation.z=-.5;
    for(const x of[-3.1,-3.6]){this.mesh(base,new T.CylinderGeometry(.22,.22,1.2,16),hull,[x,.65,2],true);this.mesh(base,new T.TorusGeometry(.225,.025,6,16),trim,[x,.85,2]);}
    // Merge static opaque hardware per material to limit Quest rendering submissions.
    this.mergeStationHardware(base);
  },
  mergeStationHardware(root){
    const T=this.T,groups=new Map();root.object3D.updateWorldMatrix(true,true);const inverse=root.object3D.matrixWorld.clone().invert();
    root.object3D.traverse(mesh=>{if(!mesh.isMesh||Array.isArray(mesh.material)||mesh.material.transparent||mesh.material.map)return;const key=mesh.material;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);});
    for(const [material,meshes] of groups){if(meshes.length<2)continue;
      const arrays={position:[],normal:[],uv:[]};
      for(const mesh of meshes){const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();g.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));for(const k of Object.keys(arrays))arrays[k].push(...g.attributes[k].array);g.dispose();}
      const geometry=new T.BufferGeometry();for(const [k,v]of Object.entries(arrays))geometry.setAttribute(k,new T.Float32BufferAttribute(v,k==='uv'?2:3));geometry.computeBoundingSphere();this.geometries.push(geometry);
      const merged=new T.Mesh(geometry,material);merged.castShadow=merged.receiveShadow=true;root.object3D.add(merged);meshes.forEach(m=>m.parent.remove(m));
    }
  }
});
