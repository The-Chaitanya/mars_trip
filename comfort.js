'use strict';
Object.assign(MarsExpedition.prototype,{
  buildComfort(){
    const T=this.T;this.vrMenuOpen=false;this.vrCaptionsOpen=false;this.welcomeStarted=false;
    this.vrPanel.object3D.scale.setScalar(.55);this.vrCaptionRoot.object3D.scale.setScalar(.34);
    this.button(this.vrPanel,'Dust chamber',[1.9,-.68,0],'visit:5',1.65,null,true);
    const begin=()=>{if(this.welcomeStarted||!this.ready||(this.journey&&this.journey.phase!=='mars'))return;this.welcomeStarted=true;$('#arrival').hidden=true;this.say('welcome');};
    this.listen(window,'pointerdown',begin,{once:true});this.listen(window,'keydown',begin,{once:true});
    this.listen($('#left-hand'),'xbuttondown',()=>this.setVRMenu(!this.vrMenuOpen));
    this.listen($('#left-hand'),'ybuttondown',()=>this.setVRCaptions(!this.vrCaptionsOpen));
    this.listen($('#right-hand'),'abuttondown',()=>{if(this.journey&&this.journey.phase!=='mars'){if(this.journey.phase==='tutorial')this.journeyAction('next');return;}begin();this.say(this.lastVoice,true);});
    this.listen($('#right-hand'),'bbuttondown',()=>{this.stopMission();this.setVRMenu(false);});
    this.listen(this.scene,'enter-vr',()=>{begin();this.setVRMenu(false);this.setVRCaptions(false);});
    this.listen(this.scene,'exit-vr',()=>{this.vrMenuOpen=false;this.vrCaptionsOpen=false;});
    this.listen($('#dust-travel'),'click',()=>this.visit(5));
    // Soft ground-haze particles make nearby atmosphere visible without opaque walls.
    const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(225,185,143,.5)');gradient.addColorStop(.45,'rgba(225,185,143,.18)');gradient.addColorStop(1,'rgba(225,185,143,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;this.textures.push(texture);const geo=new T.BufferGeometry(),positions=[];
    for(let i=0;i<70;i++){const x=Math.sin(i*18.7)*43,z=-12+Math.cos(i*12.3)*43;positions.push(x,this.terrainHeight(x,z)+1.1+(i%4)*.35,z);}
    geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));const mat=new T.PointsMaterial({map:texture,size:9,transparent:true,opacity:.27,depthWrite:false,color:'#d7b18e',sizeAttenuation:true});this.materials.push(mat);this.geometries.push(geo);this.groundHaze=new T.Points(geo,mat);this.scene.object3D.add(this.groundHaze);
    const root=this.entity($('#land'),[-18,0,-35]);this.dustRoot=root;
    this.mesh(root,new T.CylinderGeometry(.9,1, .25,32),this.material('#454d4b',{metalness:.5}),[0,.125,0],true);
    this.mesh(root,new T.CylinderGeometry(.86,.86,1.65,40,1,true),new T.MeshStandardMaterial({color:'#c5ded5',transparent:true,opacity:.09,depthWrite:false,side:T.DoubleSide,roughness:.12}),[0,1.05,0]);this.materials.push(root.children[1].getObject3D('mesh').material);
    this.mesh(root,new T.CylinderGeometry(.9,.9,.1,32),this.material('#52615b',{metalness:.55}),[0,1.92,0],true);
    const particles=new T.BufferGeometry(),points=[];for(let i=0;i<220;i++){const a=i*2.39996,r=.73*Math.sqrt((i+.5)/220);points.push(Math.cos(a)*r,.3+(i%7)*.015,Math.sin(a)*r);}particles.setAttribute('position',new T.Float32BufferAttribute(points,3));this.geometries.push(particles);
    const pm=new T.PointsMaterial({color:'#ecb66d',size:.028});this.materials.push(pm);this.dustParticles=new T.Points(particles,pm);root.object3D.add(this.dustParticles);this.dustMode='settle';this.dustTime=0;
    this.label(root,'05 / WHY MARS DUST MATTERS',[0,2.45,0],3.3,.35,{size:44});
    this.dustReadout=this.label(root,'',[ -2.15,1.65,.4],2.4,.85,{background:'#22302b',size:38});
    this.dustLesson=this.label(root,'',[-2.15,.75,.4],2.4,.8,{background:'#22302b',size:36});
    this.dustButtons=[['1 · Earth wind','earth'],['2 · Mars wind','mars'],['3 · Mars dust storm','storm'],['4 · Clean panel','clean'],['5 · Clear sky','clear'],['Stop wind','settle']];
    this.dustButtons.forEach(([name,mode],i)=>this.button(root,name,[2.15,2.15-i*.38,.4],'dust:'+mode,1.9,null,false));
    const panel=this.mesh(root,new T.BoxGeometry(1.25,.08,.65),this.material('#173c65',{metalness:.35}),[0,.48,1.2]);
    this.dustSolarPanel=panel;
    for(let i=0;i<5;i++)this.mesh(root,new T.BoxGeometry(.014,.012,.65),this.material('#8bb6c8'),[-.5+i*.25,.528,1.2]);
    const coating=this.material('#b48a61',{transparent:true,opacity:0,depthWrite:false});
    this.dustCoating=this.mesh(root,new T.BoxGeometry(1.26,.015,.66),coating,[0,.55,1.2]);
    this.dustPower=this.label(root,'',[0,.95,1.25],1.9,.35,{background:'#122c3b',size:36});
    this.label(root,'Airflow tracers / illustrative model',[0,2.12,0],3,.23,{size:34});
    this.dustLab=new DustScience.Lab();this.updateDustLesson('intro');
  },
  setVRMenu(open){
    this.vrMenuOpen=!!open&&this.inVR&&(!this.journey||this.journey.phase==='mars');this.vrPanel.object3D.visible=this.vrMenuOpen;this.wristMap.object3D.visible=this.vrMenuOpen;
    if(this.vrMenuOpen){this.keys.clear();this.stick={x:0,y:0};this.roverSpeed=0;this.positionVRPanel();}
    this.refreshTargets();
  },
  setVRCaptions(open){this.vrCaptionsOpen=!!open&&this.inVR&&(!this.journey||this.journey.phase==='mars');this.vrCaptionRoot.object3D.visible=this.vrCaptionsOpen;if(this.vrCaptionsOpen)this.positionVRPanel();},
  positionVRPanel(){
    if(!this.vrPanel||!this.head)return;
    if(this.vrMenuOpen)this.followViewer(this.vrPanel,0,-.05,-2.15);
    if(this.vrCaptionsOpen)this.followViewer(this.vrCaptionRoot,0,-.48,-1.6);
  },
  followViewer(entity,x,y,z){
    if(!entity||!this.head)return;
    // Read the tracked head pose every frame, including pitch, roll and room-scale motion.
    const T=this.T;
    this.viewerPoseScratch ||= {p:new T.Vector3(),q:new T.Quaternion(),offset:new T.Vector3()};
    const {p,q,offset}=this.viewerPoseScratch;
    this.head.object3D.getWorldPosition(p);this.head.object3D.getWorldQuaternion(q);
    offset.x=x;offset.y=y;offset.z=z;
    entity.object3D.position.copy(offset.applyQuaternion(q).add(p));
    entity.object3D.quaternion.copy(q);
  },
  tickViewerText(){
    if(!this.inVR)return;
    this.positionVRPanel();
    if(this.journey?.phase==='choice')this.followViewer(this.choiceRoot,0,-.1,-2.8);
    if(this.journey?.phase==='tutorial')this.followViewer(this.tutorialRoot,0,-.1,-2.5);
    if(this.journey?.flying)this.followViewer(this.flightCaptionRoot,0,-.42,-1.8);
  },
  startDustLesson(){this.dustLab=new DustScience.Lab();this.dustMode='settle';this.updateDustLesson('intro');},
  setDustMode(mode){
    if(!['earth','mars','storm','clean','clear','low','high','settle'].includes(mode))return;
    if(mode!=='settle'&&(this.zones.active!==5||!this.insideActiveZone()))return;
    // Keep legacy stop behavior available to boundary cancellation and older saves.
    if(!this.dustLab){this.dustMode=mode;return;}
    const action=mode==='low'?'earth':mode==='high'?'storm':mode;
    if(!this.dustLab.act(action))return;
    this.dustMode=this.dustLab.running?(this.dustLab.haze?'high':'low'):'settle';
    this.updateDustLesson(action);
  },
  updateDustLesson(action){
    const lab=this.dustLab;
    const notes={intro:'Try Earth wind, then Mars wind. Same speed: which pushes harder?',earth:'Earth has denser air, so the wind pushes harder. Now try Mars at the same twenty metres per second.',mars:'At this wind speed, Mars has one sixtieth of the wind pressure in our example. Its thin air exerts much less force.',storm:'Dust blocks sunlight and coats the panel. Try cleaning only the panel.',clean:lab.haze?'Panel clean, sky still dusty. Power is still limited. Now clear the sky.':'A clean panel helps, but airborne dust can still block sunlight.',clear:lab.coating?'Sky clear, panel still dusty. Clean the panel too.':'Light restored! Dust in the sky and on panels are two separate problems.',settle:'Wind stopped. Dust already in the sky or on a panel does not disappear instantly.'};
    const message=lab.complete?'Lesson complete: weak wind pressure can still accompany a serious solar-power hazard.':notes[action];
    this.dustReadout.change(lab.planet.toUpperCase()+' · '+(lab.running?'20':'0')+' m/s\nWind pressure: '+lab.pressure+' Pa\nExample air density: '+(lab.planet==='earth'?'1.2':'0.02')+' kg/m³');
    this.dustLesson.change(message);this.dustPower.change('SOLAR OUTPUT · '+lab.power+'%\nIllustrative / clean baseline = 100%');
    this.dustCoating.getObject3D('mesh').material.opacity=lab.coating?.8:0;
    this.dustSolarPanel.getObject3D('mesh').material.color.set('#173c65').multiplyScalar(.3+.7*lab.power/100);
    this.dustParticles.material.color.set(lab.planet==='earth'?'#a6dce5':'#ecb66d');
    if(this.zones.active===5){$('#task-description').textContent=message+' Solar output: '+lab.power+'% (illustrative).';this.narrateText(message);}
  },
  tickComfort(dt,time){
    this.groundHaze.position.x=Math.sin(time*.00008)*1.8;this.groundHaze.material.opacity=.24+Math.sin(time*.00014)*.04;
    const pos=this.playerPosition();this.zoneRings.forEach(r=>{const z=MarsCore.ZONES.find(z=>z.id===r.id);r.label.object3D.visible=Math.hypot(pos.x-z.x,pos.z-z.z)<8;});
    if(this.zones.active!==5)this.dustMode='settle';const p=this.dustParticles.geometry.attributes.position;this.dustTime+=dt;
    for(let i=0;i<p.count;i++){const strength=this.dustMode==='high'?1.25:this.dustMode==='low'?.45:0,target=strength?.3+Math.abs(Math.sin(this.dustTime*(strength+ .3)+i*.61))*strength:.3+(i%7)*.015;const y=p.getY(i)+(target-p.getY(i))*Math.min(1,dt*(strength?3:1.8));const angle=i*2.39996+this.dustTime*strength,r=.73*Math.sqrt((i+.5)/p.count);p.setXYZ(i,Math.cos(angle)*r,y,Math.sin(angle)*r);}p.needsUpdate=true;
  }
});
