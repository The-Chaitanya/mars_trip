'use strict';
Object.assign(MarsExpedition.prototype,{
  buildExploration(){
    const T=this.T;this.zones=new MarsCore.FieldZones();this.destination=0;this.keys=new Set();this.stick={x:0,y:0};this.scan=null;this.roverSpeed=0;this.roverHeading=Math.PI;this.roverPoint=0;this.roverSurveyDone=false;this.roverPosition={x:20,z:1};
    this.positionVector=new T.Vector3();this.directionVector=new T.Vector3();this.zoneRings=[];
    const land=$('#land');
    const makeRing=(x,z,r,color,width=.08)=>{
      const geometry=new T.RingGeometry(r-width,r,96);const material=new T.MeshBasicMaterial({color,transparent:true,opacity:.75,side:T.DoubleSide,depthWrite:false});this.materials.push(material);
      const ring=this.mesh(land,geometry,material,[x,.03,z]);ring.object3D.rotation.x=-Math.PI/2;return ring;
    };
    this.fieldRing=makeRing(MarsCore.FIELD.x,MarsCore.FIELD.z,MarsCore.FIELD.radius,'#e6ab67',.22);
    // Follow the terrain rather than burying the outer boundary under dunes.
    const p=this.fieldRing.getObject3D('mesh').geometry.attributes.position;
    for(let i=0;i<p.count;i++)p.setZ(i,-this.terrainHeight(p.getX(i),MarsCore.FIELD.z-p.getY(i))-.05);p.needsUpdate=true;
    for(const z of MarsCore.ZONES){
      const start=makeRing(z.x,z.z+.6,1.35,'#e8bd66',.12),boundary=makeRing(z.x,z.z-1,6.5,'#e8bd66',.05);
      const bp=boundary.getObject3D('mesh').geometry.attributes.position;for(let j=0;j<bp.count;j++)bp.setZ(j,-this.terrainHeight(z.x+bp.getX(j),z.z-1-bp.getY(j))-.02);bp.needsUpdate=true;boundary.object3D.visible=false;
      const label=this.label(land,z.name.toUpperCase()+'\nSTEP INTO THE CIRCLE',[z.x,.85,z.z+1],2.4,.5,{background:'#24271e',size:40});
      const beacon=this.mesh(land,new T.CylinderGeometry(1.34,1.34,.7,48,1,true),new T.MeshBasicMaterial({color:'#ffc878',transparent:true,opacity:.08,side:T.DoubleSide,depthWrite:false}),[z.x,.36,z.z+.6]);this.materials.push(beacon.getObject3D('mesh').material);
      this.zoneRings.push({id:z.id,start,boundary,label,beacon});
    }
    const roverZone=this.entity(land,[20,0,5]);this.label(roverZone,'04 / ROVER SURVEY',[0,2.75,-4],3,.4,{size:46});
    this.roverReadout=this.label(roverZone,'Enter the circle to take control',[0,2.18,-4],3,.45,{background:'#20291e',size:38});
    this.button(roverZone,'Release rover controls',[3,1.2,-1],'rover-exit',1.8,null,true);
    this.roverCourse=[{x:24,z:0},{x:20,z:-5},{x:16,z:0}];
    this.roverWaypoints=this.roverCourse.map((p,i)=>{const ring=makeRing(p.x,p.z,1.5,'#90cddd',.10);ring.object3D.position.y=this.terrainHeight(p.x,p.z)+.06;const label=this.label(land,String(i+1),[p.x,this.terrainHeight(p.x,p.z)+.8,p.z],.5,.5,{background:'#1d3034'});return{ring,label};});
    this.roverDriveRing=makeRing(20,0,10,'#90cddd',.1);const rp=this.roverDriveRing.getObject3D('mesh').geometry.attributes.position;
    for(let i=0;i<rp.count;i++)rp.setZ(i,-this.terrainHeight(20+rp.getX(i),-rp.getY(i))-.04);rp.needsUpdate=true;
    // Dust remains subtle near the student; distant fog provides the larger depth cue.
    const dustGeo=new T.BufferGeometry(),dust=[];for(let i=0;i<180;i++)dust.push(Math.sin(i*127.1)*42, .3+(i%17)*.20, -12+Math.cos(i*311.7)*40);
    dustGeo.setAttribute('position',new T.Float32BufferAttribute(dust,3));const dustMat=new T.PointsMaterial({color:'#d3af89',size:.055,transparent:true,opacity:.22,depthWrite:false});this.geometries.push(dustGeo);this.materials.push(dustMat);this.dust=new T.Points(dustGeo,dustMat);land.object3D.add(this.dust);
    this.buildTubeFallback();this.loadTestTubes();
    this.roverPlaceholder.object3D.position.set(20,this.terrainHeight(20,1),1);this.roverPlaceholder.object3D.rotation.y=Math.PI;
  },
  sampleGeometry(index){
    const T=this.T,g=this.stoneGeometry(4),p=g.attributes.position,colors=[];
    for(let i=0;i<p.count;i++){
      let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
      if(index===1){y*=.6;x*=1.18;const layer=Math.sin(y*48);x*=1+layer*.035;z*=1+layer*.035;}
      if(index===2){x*=.83;y*=1.16;}
      p.setXYZ(i,x,y,z);
      const n=this.noise(x*19+index*9,y*17+z*13);let c;
      if(index===0)c=new T.Color().setRGB(.48+n*.23,.46+n*.20,.43+n*.18);
      else if(index===1){const band=.68+.22*Math.sin(y*45);c=new T.Color().setRGB(band,band*.86,band*.66);}
      else c=new T.Color().setRGB(.72+n*.23,.45+n*.16,.27+n*.12);
      colors.push(c.r,c.g,c.b);
    }g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
  },
  buildTubeFallback(){
    const T=this.T;this.tubeFallback=[];
    for(const x of[-.78,.78]){
      const g=this.entity(this.groups[2],[x,0,-3.8]);this.tubeFallback.push(g);
      const points=[new T.Vector2(0,0),new T.Vector2(.12,.015),new T.Vector2(.23,.08),new T.Vector2(.29,.18),new T.Vector2(.30,.30),new T.Vector2(.30,3.5),new T.Vector2(.28,3.5),new T.Vector2(.28,.31),new T.Vector2(.27,.19),new T.Vector2(.21,.10),new T.Vector2(.1,.04),new T.Vector2(0,.035)];
      const glass=new T.MeshStandardMaterial({color:'#badbd8',metalness:.05,roughness:.14,transparent:true,opacity:.16,side:T.DoubleSide,depthWrite:false});this.materials.push(glass);const shell=this.mesh(g,new T.LatheGeometry(points,40),glass);shell.object3D.visible=false;
      const rim=this.mesh(g,new T.TorusGeometry(.29,.022,8,40),this.material('#a6c7c4',{metalness:.55,roughness:.25}),[0,3.5,0]);rim.object3D.rotation.x=Math.PI/2;
      for(let n=1;n<=6;n++){this.mesh(g,new T.BoxGeometry(n%2?.08:.13,.008,.006),this.material('#c3d9cf'),[.08,n*.5,.302]);}
    }
  },
  loadTestTubes(){
    const T=this.T;
    [-.78,.78].forEach((x,i)=>{
      const entity=this.entity(this.groups[2],[x,0,-3.8]);entity.object3D.visible=false;
      this.listen(entity,'model-loaded',event=>{
        const model=event.detail.model,liquid=[];
        model.traverse(o=>{if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.some(m=>m.name==='mat3'))liquid.push(o);});
        liquid.forEach(o=>o.parent.remove(o));
        const box=new T.Box3().setFromObject(model),size=box.getSize(new T.Vector3());
        model.scale.set(.6/size.x,3.5/size.y,.6/size.z);model.position.y=-box.min.y*model.scale.y;
        model.traverse(o=>{if(!o.isMesh)return;const glass=new T.MeshStandardMaterial({color:'#b5d5d2',transparent:true,opacity:.14,roughness:.16,metalness:.08,side:T.DoubleSide,depthWrite:false});o.material=glass;o.castShadow=false;this.materials.push(glass);this.geometries.push(o.geometry);});
        // Keep the fallback's graduation marks and rim; replace only its glass shell.
        this.tubeFallback[i].children[0].object3D.visible=false;entity.object3D.visible=true;
      });
      this.listen(entity,'model-error',()=>this.notice('The glass model could not load. Gravity still works; reload to restore the glass.'));
      entity.setAttribute('gltf-model','url(assets/test-tube.glb)');
    });
  },
  bindExploration(){
    const moveCodes=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft'];
    this.listen(window,'keydown',e=>{if($('dialog[open]')||e.target.matches('input,textarea,select'))return;if(moveCodes.includes(e.code)){e.preventDefault();this.keys.add(e.code);if(!this.audio.context)this.audio.unlock();}if(e.code==='KeyE'&&!e.repeat&&this.zones.active===4)this.stopMission();});
    this.listen(window,'keyup',e=>this.keys.delete(e.code));
    const clear=()=>{this.keys.clear();this.stick={x:0,y:0};this.roverSpeed=0;};
    this.listen(window,'blur',clear);this.listen(document,'visibilitychange',()=>{if(document.hidden)clear();});
    this.listen($('#left-hand'),'thumbstickmoved',e=>{this.stick={x:e.detail.x,y:e.detail.y};});
    this.listen(this.scene,'exit-vr',clear);
    document.querySelectorAll('[data-move]').forEach(button=>{
      this.listen(button,'pointerdown',e=>{e.preventDefault();if(!this.audio.context)this.audio.unlock();button.setPointerCapture(e.pointerId);this.keys.add(button.dataset.move);});
      for(const event of['pointerup','pointercancel','lostpointercapture'])this.listen(button,event,()=>this.keys.delete(button.dataset.move));
    });
    this.listen($('#leave-mission'),'click',()=>this.stopMission());
    this.listen($('#rover-tab'),'click',()=>this.visit(4));
    this.listen($('#missions-toggle'),'click',()=>{const hidden=document.body.classList.contains('free-explore')?!document.body.classList.contains('mission-open'):document.body.classList.contains('mission-hidden');document.body.classList.toggle('mission-open',hidden);document.body.classList.toggle('mission-hidden',!hidden);$('#missions-toggle').setAttribute('aria-expanded',String(hidden));});
    this.listen($('#guide-toggle'),'click',()=>{const open=document.body.classList.toggle('guide-open');$('#guide-toggle').setAttribute('aria-expanded',String(open));});
    this.listen($('#station-tour'),'click',()=>{this.stopMission(false);this.destination=0;this.teleportTo(-25,16);this.refresh();this.narrateText('ARES science outpost. Explore the airlock, solar wings, life-support equipment and communications mast.');});
  },
  walkHeight(x,z){
    // The terrain uses a 192-cell plane; interpolate the same triangle underfoot.
    const step=360/192,u=(x+180)/step,v=(z+180)/step,ix=Math.floor(u),iz=Math.floor(v),fx=u-ix,fz=v-iz;
    const x0=ix*step-180,z0=iz*step-180;
    const a=this.terrainHeight(x0,z0),b=this.terrainHeight(x0+step,z0),c=this.terrainHeight(x0,z0+step),d=this.terrainHeight(x0+step,z0+step);
    return fx+fz<=1?a+(b-a)*fx+(c-a)*fz:d+(c-d)*(1-fx)+(b-d)*(1-fz);
  },
  playerPosition(){this.head.object3D.getWorldPosition(this.positionVector);return this.positionVector;},
  teleportTo(x,z){
    const pos=this.playerPosition();this.rig.object3D.position.x+=x-pos.x;this.rig.object3D.position.z+=z-pos.z;this.rig.object3D.position.y=this.walkHeight(x,z)+.035;this.recenter();this.keys.clear();this.stick={x:0,y:0};
  },
  startMission(id){
    document.body.classList.remove('mission-hidden');$('#missions-toggle').setAttribute('aria-expanded','true');this.destination=id;this.state.visit(id>=4?0:id);this.quizLockedUntil=0;this.scan=null;this.updateBalls(null);this.positionVRPanel();this.refresh();
    if(id===4){this.roverSpeed=0;this.roverPoint=0;this.narrateText('Rover control active. W and S or the left stick move the rover. A and D steer. Drive through numbered survey markers in order. Press E or Release controls to walk again.');}
    else if(id===5){this.audio.stop();this.startDustLesson();}
    else this.say(['welcome','rocks','gravity','quiz'][id]);
    this.notice('Mission started: '+MarsCore.ZONES.find(z=>z.id===id).name+'. Stay inside the marked area.');
  },
  stopMission(show=true){
    const id=this.zones.stop();if(id===null)return;
    if(id===1&&!this.state.done[0])this.state.samples.clear();
    if(id===3&&!this.state.done[2])this.state.question=0;
    this.state.visit(0);this.scan=null;this.quizLockedUntil=0;this.roverSpeed=0;if(this.dustParticles)this.setDustMode('settle');this.keys.clear();this.stick={x:0,y:0};this.audio.stop();this.updateBalls(null);
    // Manual release disarms the circle until the student steps off it.
    this.disarmedZone=id;this.refresh();
    this.setCaption('Mission stopped. Completed missions are kept. Step out of the start circle, then enter it again when ready.');
    if(show)this.notice('Mission stopped — you can explore freely.');
  },
  insideActiveZone(){
    const zone=MarsCore.ZONES.find(z=>z.id===this.zones.active);if(!zone)return false;
    const pos=this.playerPosition();if(Math.hypot(pos.x-zone.x,pos.z-zone.z+1)>6.5){this.stopMission();return false;}return true;
  },
  startSampleScan(key){
    if(!this.insideActiveZone())return;
    if(this.zones.active!==1||!MarsCore.SAMPLE_KEYS.includes(key)||this.scan)return;
    const i=MarsCore.SAMPLE_KEYS.indexOf(key),pos=this.playerPosition(),rock=this.rockEls[i];rock.object3D.getWorldPosition(this.directionVector);
    if(pos.distanceTo(this.directionVector)>3.2){this.notice('Walk closer to the specimen to scan it.');return;}
    if(this.state.samples.has(key)){this.say(key);return;}
    this.scan={key,index:i,elapsed:0};this.audio.stop();this.narrateText('Scanning. Hold still.');
  },
  refreshExploration(){
    const id=this.zones.active;document.body.classList.toggle('rover-active',id===4);document.body.classList.toggle('free-explore',id===null);
    $('#leave-mission').hidden=id===null;$('#missions-toggle').setAttribute('aria-expanded',String(id===null?document.body.classList.contains('mission-open'):!document.body.classList.contains('mission-hidden')));
    $('#zone-state').textContent=id===null?'FREE EXPLORATION':'MISSION ACTIVE · STAY IN THE MARKED AREA';
    $('#move-label').textContent=id===4?'DRIVE / STEER':'WALK';
    this.zoneRings.forEach(r=>{const active=r.id===id;r.boundary.object3D.visible=active;r.start.getObject3D('mesh').material.color.set(active?'#87cbb6':'#e8bd66');r.label.change(MarsCore.ZONES.find(z=>z.id===r.id).name.toUpperCase()+'\n'+(active?'MISSION ACTIVE':'STEP INTO THE CIRCLE'));});
    this.roverWaypoints.forEach((p,i)=>{p.ring.object3D.visible=p.label.object3D.visible=id===4&&i>=this.roverPoint;p.ring.getObject3D('mesh').material.color.set(i===this.roverPoint?'#b1efdc':'#65858c');});
    if(id===null){
      $('#location').textContent='Explore Mars';$('#location-note').textContent='Walk into a glowing circle to start a mission.';$('#mission-label').textContent='FREE EXPLORATION';$('#task-title').textContent='Choose your next mission.';$('#task-description').textContent='WASD / arrow keys to walk. Drag to look. Travel takes you outside a mission circle; step inside to begin.';
      $('#task-actions').replaceChildren();for(const z of MarsCore.ZONES){const b=document.createElement('button');b.textContent='Travel to '+z.name;b.dataset.action='visit:'+z.id;$('#task-actions').appendChild(b);}
    }
    if(id===1)$('#task-description').textContent='Approach a specimen and select it to scan. Compare dark volcanic pores, sediment layers and rusty iron-rich surfaces. Stay nearby until the scan finishes.';
    if(id===5){$('#location').textContent='Earth vs Mars dust lab';$('#task-title').textContent='Why is dust a Mars mission hazard?';$('#task-description').textContent='Compare Earth and Mars wind at the same speed. Then start a Mars dust storm, clean the panel and clear the sky. Watch solar output recover in two stages.';$('#task-actions').replaceChildren();for(const [name,mode] of this.dustButtons){const b=document.createElement('button');b.textContent=name;b.dataset.action='dust:'+mode;$('#task-actions').appendChild(b);}}
    if(id===4){$('#location').textContent='Rover survey';$('#mission-label').textContent='ROVER CONTROL';$('#task-title').textContent=this.roverSurveyDone?'Survey complete.':'Drive the survey route.';$('#task-description').textContent='W/S: forward and reverse. A/D: steer. On Quest, use the left stick. Pass markers 1–3 inside the blue perimeter. E releases control.';$('#task-actions').replaceChildren();const b=document.createElement('button');b.textContent='Release rover controls';b.dataset.action='rover-exit';$('#task-actions').appendChild(b);}
  },
  tickExploration(dt,time){
    if($('dialog[open]')){this.keys.clear();this.roverSpeed=0;return;}
    let forward=(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0)-(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0)-(Math.abs(this.stick.y)>.16?this.stick.y:0);
    let right=(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0)+(Math.abs(this.stick.x)>.16?this.stick.x:0);
    if(this.vrMenuOpen){this.keys.clear();this.stick={x:0,y:0};this.roverSpeed=0;forward=right=0;}
    if(this.zones.active===4)this.driveRover(forward,right,dt);
    else if(forward||right){
      this.head.object3D.getWorldDirection(this.directionVector);let fx=-this.directionVector.x,fz=-this.directionVector.z;const len=Math.hypot(fx,fz)||1;fx/=len;fz/=len;const norm=Math.max(1,Math.hypot(forward,right)),speed=this.keys.has('ShiftLeft')?3.5:2.2;
      this.rig.object3D.position.x+=(fx*forward-fz*right)/norm*speed*dt;this.rig.object3D.position.z+=(fz*forward+fx*right)/norm*speed*dt;
    }
    const pos=this.playerPosition(),bounded=MarsCore.clampCircle(pos.x,pos.z,MarsCore.FIELD,.45);
    this.rig.object3D.position.x+=bounded.x-pos.x;this.rig.object3D.position.z+=bounded.z-pos.z;
    this.rig.object3D.position.y=this.walkHeight(bounded.x,bounded.z)+.035;
    // Solid station hardware cannot be walked through. Specimen interaction remains within reach.
    for(const c of[{x:-18,z:-35,r:1.1},{x:-25,z:10,r:3.1},{x:-29.5,z:9.7,r:2.0},{x:-20.5,z:9.7,r:2.0},{x:-13.2,z:-15.8,r:.65},{x:-12,z:-15.8,r:.65},{x:-10.8,z:-15.8,r:.65},{x:11.22,z:-16.8,r:.65},{x:12.78,z:-16.8,r:.65}]){
      const p=this.playerPosition(),dx=p.x-c.x,dz=p.z-c.z,d=Math.hypot(dx,dz);if(d<c.r){this.rig.object3D.position.x+=(d?dx/d:1)*(c.r-d);this.rig.object3D.position.z+=(d?dz/d:0)*(c.r-d);}
    }
    const current=this.playerPosition();
    if(this.disarmedZone){const z=MarsCore.ZONES.find(z=>z.id===this.disarmedZone);if(Math.hypot(current.x-z.x,current.z-z.z-.6)>1.5)this.disarmedZone=null;}
    if(!this.disarmedZone){const event=this.zones.update(current.x,current.z);if(event?.type==='start')this.startMission(event.id);if(event?.type==='stop'){this.zones.active=event.id;this.stopMission();}}
    if(this.scan){
      const scan=this.scan;this.rockEls[scan.index].object3D.getWorldPosition(this.directionVector);
      if(this.zones.active!==1||current.distanceTo(this.directionVector)>3.2){this.scan=null;this.refresh();this.notice('Scan cancelled. Stay close to the rock.');}
      else{scan.elapsed+=dt;$('#feedback').textContent='Scanning surface… '+Math.min(100,Math.floor(scan.elapsed/1.8*100))+'%';this.sampleLabels[scan.index].change('SCANNING '+Math.min(100,Math.floor(scan.elapsed/1.8*100))+'%');if(scan.elapsed>=1.8){this.state.collect(scan.key);this.scan=null;this.refresh();this.say(scan.key);}}
    }
    this.dust.position.x=Math.sin(time*.00004)*2;this.sky.material.uniforms.cloudTime.value=time/1000;
    this.zoneRings.forEach(r=>r.beacon.getObject3D('mesh').material.opacity=.045+Math.sin(time*.002)*.025);
    this.sun.position.set(current.x-24,35,current.z-18);this.sun.target.position.set(current.x,0,current.z-3);this.sun.target.updateMatrixWorld();
    $('#field-position').textContent=Math.round(current.x)+' E / '+Math.round(-current.z)+' N'+(bounded.clamped?' · FIELD BOUNDARY':'');
  },
  driveRover(forward,steer,dt){
    if(!this.nasaRover){this.roverSpeed=0;this.roverReadout.change('ROVER LOADING · PLEASE WAIT');return;}
    const target=Math.max(-1,Math.min(1,forward))*2.4;this.roverSpeed+=(target-this.roverSpeed)*Math.min(1,dt*4);
    this.roverHeading-=Math.max(-1,Math.min(1,steer))*dt*1.1*(Math.abs(this.roverSpeed)>.08?Math.sign(this.roverSpeed):0);
    const next=MarsCore.clampCircle(this.roverPosition.x+Math.sin(this.roverHeading)*this.roverSpeed*dt,this.roverPosition.z+Math.cos(this.roverHeading)*this.roverSpeed*dt,{x:20,z:0,radius:10},2.3);
    const player=this.playerPosition();if(Math.hypot(next.x-player.x,next.z-player.z)<2.5){next.x=this.roverPosition.x;next.z=this.roverPosition.z;next.clamped=true;}
    this.roverPosition={x:next.x,z:next.z};if(next.clamped)this.roverSpeed=0;
    for(const entity of[this.roverEntity,this.roverPlaceholder])if(entity){entity.object3D.position.set(next.x,this.terrainHeight(next.x,next.z)+.03,next.z);entity.object3D.rotation.y=this.roverHeading;}
    this.spinRoverWheels(this.roverSpeed*dt);for(const pivot of this.roverSteering||[])pivot.rotation.y+=(Math.max(-1,Math.min(1,steer))*(pivot.name.endsWith('front')?-.38:.38)-pivot.rotation.y)*Math.min(1,dt*8);
    const waypoint=this.roverCourse[this.roverPoint];
    if(waypoint&&Math.hypot(next.x-waypoint.x,next.z-waypoint.z)<1.6){this.roverPoint++;if(this.roverPoint===3){this.roverSurveyDone=true;this.notice('Rover survey complete. All three markers recorded.');}this.refresh();}
    this.roverReadout.change((this.roverPoint===3?'SURVEY COMPLETE':'SURVEY '+this.roverPoint+' / 3')+'  ·  '+Math.abs(this.roverSpeed).toFixed(1)+' m/s'+(next.clamped?'\nCOURSE BOUNDARY — REVERSE TO RETURN':''));
  }
});
