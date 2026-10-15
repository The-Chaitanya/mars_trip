'use strict';
Object.assign(MarsExpedition.prototype,{
  upgradeRocket(){
    const T=this.T,root=this.rocketExterior;
    const hull=this.material('#d3d9d5',{metalness:.38,roughness:.43}),steel=this.material('#69716f',{metalness:.72,roughness:.3}),thermal=this.material('#292b2d',{metalness:.12,roughness:.86}),glass=this.material('#182e3c',{metalness:.65,roughness:.16});
    // Subtle panel roughness comes from a tiny reusable texture, not large downloads.
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='#aaaaaa';c.fillRect(0,0,128,128);for(let y=0;y<128;y+=16){c.fillStyle='#747474';c.fillRect(0,y,128,1);}const rough=new T.CanvasTexture(canvas);rough.wrapS=rough.wrapT=T.RepeatWrapping;rough.repeat.set(4,3);this.textures.push(rough);
    root.object3D.traverse(o=>{if(o.isMesh&&o.geometry.type==='CylinderGeometry'&&o.material.color?.getHexString()==='c7d2d5'){o.material=hull;hull.roughnessMap=rough;}});
    const tube=(r,h,mat,pos)=>this.mesh(root,new T.CylinderGeometry(r,r,h,32),mat,pos,true);
    // Realistic service details: interstage seals, axial raceways, ports and engine bells.
    for(const y of[3.3,5.1,8.2,10.9])tube(y<5?2.025:1.965,.035,steel,[0,y,0]);
    for(const sign of[-1,1])this.mesh(root,new T.BoxGeometry(.12,7.8,.10),steel,[sign*1.37,7.25,sign*1.37],true);
    for(const a of[-.7,.7]){const frame=this.mesh(root,new T.CylinderGeometry(.39,.39,.075,32),steel,[Math.sin(a)*1.91,10.15,Math.cos(a)*1.91],true);frame.object3D.rotation.set(Math.PI/2,0,-a);const window=this.mesh(root,new T.CylinderGeometry(.30,.30,.082,24),glass,[Math.sin(a)*1.94,10.15,Math.cos(a)*1.94]);window.object3D.rotation.copy(frame.object3D.rotation);}
    for(const x of[-1.04,1.04])this.mesh(root,new T.BoxGeometry(.12,2.65,.12),steel,[x,1.45,1.91],true);
    this.mesh(root,new T.BoxGeometry(2.15,.13,.12),steel,[0,2.77,1.91],true);
    this.label(root,'CREW ACCESS  /  01',[0,2.7,2.06],1.65,.17,{size:42,color:'#293c45'});
    this.label(root,'ARES\nEXPLORATION',[0,5.4,2.05],1.45,.72,{size:45,color:'#2d424c'});
    for(const x of[-1.15,1.15])for(const z of[-.7,.7]){
      const pts=[new T.Vector2(.13,.6),new T.Vector2(.15,.45),new T.Vector2(.23,.2),new T.Vector2(.36,0)];
      this.mesh(root,new T.LatheGeometry(pts,24),thermal,[x,.08,z],true);tube(.15,.24,steel,[x,.77,z]);
    }
    // Four swept fins replace the box-like silhouette; the doorway stays clear.
    for(const a of[Math.PI*.25,Math.PI*.75,Math.PI*1.25,Math.PI*1.75]){
      const shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(1.3,0);shape.lineTo(.35,2.8);shape.lineTo(0,2.8);shape.closePath();
      const fin=this.mesh(root,new T.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:false}),thermal,[Math.sin(a)*1.8,.12,Math.cos(a)*1.8],true);fin.object3D.rotation.y=Math.PI/2-a;
    }
    // Merge static opaque parts by material using the existing geometry batching routine.
    const oldFins=[];root.object3D.traverse(o=>{const p=o.geometry?.parameters;if(o.isMesh&&p?.width===.15&&p?.height===2.2&&p?.depth===3)oldFins.push(o);});oldFins.forEach(o=>o.parent.remove(o));
    this.mergeStationHardware(root);
    this.rocketTriangles=0;root.object3D.traverse(o=>{if(o.isMesh)this.rocketTriangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
    // Cabin trim, overhead lighting and readable instrument surfaces.
    const lamp=this.material('#a7d6ca',{emissive:'#a7d6ca',emissiveIntensity:.65,roughness:.7});
    for(const x of[-1.45,1.45])this.mesh(this.cabinRoot,new T.BoxGeometry(.06,.04,1.7),lamp,[x,2.9,-.25]);
    for(const x of[-.97,.97])this.mesh(this.cabinRoot,new T.BoxGeometry(.09,.18,.15),steel,[x,.91,-1.02]);
    this.label(this.cabinRoot,'ALTITUDE  /  FLIGHT STATUS',[0,.79,-1.09],2.15,.13,{size:36,color:'#8dadb8'});
  },
  buildFlightEffects(){
    const T=this.T;this.flightColors={day:new T.Color('#98bfd3'),space:new T.Color('#040915'),mars:new T.Color('#bb8d6c')};this.flightLastReadout='';this.flightScratch=new T.Vector3();
    // Two lightweight atmospheric shells, no volumetric ray marching or bloom.
    this.planetAtmospheres=[];
    for(const [planet,color]of[[this.earthPlanet,'#609ed6'],[this.marsPlanet,'#c88351']]){
      const geometry=planet.getObject3D('mesh').geometry.clone();const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.BackSide,uniforms:{tint:{value:new T.Color(color)}},vertexShader:'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'uniform vec3 tint;varying vec3 n;varying vec3 v;void main(){float rim=pow(1.0-abs(dot(normalize(n),normalize(v))),3.0);gl_FragColor=vec4(tint,rim*.42);}' });
      this.materials.push(material);this.geometries.push(geometry);const shell=new T.Mesh(geometry,material);shell.scale.setScalar(1.025);planet.object3D.add(shell);this.planetAtmospheres.push(shell);
    }
    // A small interior-to-exterior veil masks the ground/orbit representation handoff.
    this.launchCloud.getObject3D('mesh').geometry.dispose();const veilGeo=new T.SphereGeometry(4.5,24,16);this.geometries.push(veilGeo);this.launchCloud.getObject3D('mesh').geometry=veilGeo;this.launchCloud.getObject3D('mesh').renderOrder=5;this.launchCloud.getObject3D('mesh').material.fog=false;
    const sprite=document.createElement('canvas');sprite.width=sprite.height=32;const c=sprite.getContext('2d'),g=c.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'rgba(225,211,191,.65)');g.addColorStop(1,'rgba(225,211,191,0)');c.fillStyle=g;c.fillRect(0,0,32,32);const map=new T.CanvasTexture(sprite);map.colorSpace=T.SRGBColorSpace;this.textures.push(map);
    const geo=new T.BufferGeometry(),array=new Float32Array(48*3);geo.setAttribute('position',new T.BufferAttribute(array,3));const mat=new T.PointsMaterial({map,size:4,transparent:true,opacity:0,depthWrite:false,color:'#d1bea4',fog:false});this.geometries.push(geo);this.materials.push(mat);this.exhaustDust=new T.Points(geo,mat);this.exhaustDust.frustumCulled=false;this.scene.object3D.add(this.exhaustDust);this.exhaustDust.visible=false;
    this.listen(this.scene,'enter-vr',()=>{this.exhaustDust.geometry.setDrawRange(0,24);});this.listen(this.scene,'exit-vr',()=>{this.exhaustDust.geometry.setDrawRange(0,48);});
  },
  resetFlightPresentation(){
    this.earthPlanet.object3D.visible=true;this.marsPlanet.object3D.visible=false;this.earthPlanet.object3D.scale.setScalar(1);this.marsPlanet.object3D.scale.setScalar(1);this.starField.visible=false;this.starField.material.transparent=true;this.starField.material.opacity=0;this.launchCloud.getObject3D('mesh').material.opacity=0;this.exhaustDust.visible=false;this.flightLastReadout='';this.flightNarratedPhase=null;$('#land').object3D.position.y=0;this.sun.castShadow=true;
  },
  ensureRoverLoaded(){if(this.roverLoadRequested)return;this.roverLoadRequested=true;this.loadRover();},
  renderFlight(dt,time){
    const phase=this.journey.phase,u=this.journey.progress,pose=JourneyCore.flightPose(phase,u),ease=u*u*(3-2*u);
    if(phase==='cruise'&&u>.45)this.ensureRoverLoaded();
    if(phase==='boarding'){
      this.flightScratch.set(0,0,0);this.rig.object3D.position.copy(this.boardingStart).lerp(this.flightScratch,ease);
      this.cabinHatch.object3D.position.x=1.9*(1-ease);
    }else this.cabinHatch.object3D.position.x=phase==='touchdown'?1.9*ease:0;
    this.flightCaptionRoot.object3D.visible=this.inVR;
    const setPlanet=(entity,v)=>{entity.object3D.position.set(v[0],v[1],v[2]);entity.object3D.scale.setScalar(v[3]);};
    setPlanet(this.earthPlanet,pose.earth);setPlanet(this.marsPlanet,pose.mars);
    this.earthPlanet.object3D.visible=['orbit','cruise','entry'].includes(phase)||(phase==='launch'&&u>=.53);
    this.marsPlanet.object3D.visible=['cruise','entry'].includes(phase);
    this.earthRoot.object3D.visible=pose.ground==='earth';this.earthRoot.object3D.position.y=pose.ground==='earth'?pose.groundY:0;
    const ground=pose.ground==='mars',arriving=['entry','landing','touchdown'].includes(phase);
    this.marsRoots.forEach(o=>o.visible=ground);$('#stations').object3D.visible=false;$('#land').object3D.position.y=ground?pose.groundY:0;
    this.groundHaze.position.y=ground?pose.groundY:0;
    this.groundHaze.material.opacity=phase==='landing'?.24+ease*.25:phase==='touchdown'?.24+.25*(1-ease):.24;
    this.scene.object3D.fog=ground?this.marsFog:null;
    this.flightRoot.object3D.visible=true;this.starField.visible=pose.stars>.001;this.starField.material.opacity=pose.stars;
    this.scene.object3D.background.copy(arriving?this.flightColors.mars:this.flightColors.day).lerp(this.flightColors.space,pose.space);
    const veil=this.launchCloud.getObject3D('mesh').material;veil.color.copy(arriving?this.flightColors.mars:this.flightColors.day);veil.opacity=pose.veil;
    // Shadows are useful close to the pad and terrain, not during orbit.
    this.sun.castShadow=pose.ground!=='none';
    const dust=phase==='launch'?Math.sin(Math.PI*Math.min(1,u*2)):phase==='landing'?ease:phase==='touchdown'?1-ease:0;
    this.exhaustDust.visible=dust>.01;this.exhaustDust.material.opacity=dust*.28;
    if(this.exhaustDust.visible){const a=this.exhaustDust.geometry.attributes.position;for(let i=0;i<a.count;i++){const angle=i*2.39996+time*.0002,r=3+(i%8)*.8+Math.sin(time*.001+i)*.7;a.setXYZ(i,Math.cos(angle)*r,-.4+(i%4)*.25,Math.sin(angle)*r-2);}a.needsUpdate=true;}
    const title=phase==='boarding'?'BOARDING · HATCH CLOSING':phase==='countdown'?'HATCH SEALED · LAUNCH IN '+Math.max(1,Math.ceil(5-this.journey.elapsed)):phase==='launch'?(u<.5?'ASCENT · CLEARING THE LAUNCHPAD':'ASCENT · LEAVING THE ATMOSPHERE'):phase==='orbit'?'EARTH ORBIT · PREPARING TRANSFER':phase==='cruise'?'INTERPLANETARY TRANSFER · MONTHS COMPRESSED':phase==='entry'?'MARS ARRIVAL · ATMOSPHERIC ENTRY':phase==='landing'?(u<.65?'POWERED DESCENT · LANDING THRUSTERS':'LANDING ZONE ACQUIRED · FINAL DESCENT'):'TOUCHDOWN · ENGINES OFF';
    if(phase!==this.flightNarratedPhase){this.flightNarratedPhase=phase;this.say('flight_'+phase);}
    if(title!==this.flightLastReadout){this.flightLastReadout=title;$('#journey-status').textContent=title;this.flightReadout.change(title);this.flightCaption.change(title);}
    if(time-(this.progressUpdatedAt||0)>100){
      this.progressUpdatedAt=time;
      const total=JourneyCore.FLIGHT.reduce((n,p)=>n+p.duration,0),index=JourneyCore.FLIGHT.findIndex(p=>p.name===phase),elapsed=JourneyCore.FLIGHT.slice(0,index).reduce((n,p)=>n+p.duration,0)+this.journey.elapsed;
      $('#journey-progress').style.width=(elapsed/total*100)+'%';
    }
  }
});
