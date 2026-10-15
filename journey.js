'use strict';
Object.assign(MarsExpedition.prototype,{
  buildJourney(){
    const T=this.T;this.journey=new JourneyCore.Journey();this.tutorialSeen=new Set();this.marsFog=this.scene.object3D.fog;
    this.earthRoot=this.entity(this.scene);this.flightRoot=this.entity(this.scene);this.flightRoot.object3D.visible=false;this.cabinRoot=this.entity(this.scene);this.cabinRoot.object3D.visible=false;
    this.marsRoots=[$('#land').object3D,$('#stations').object3D,this.sky,this.groundHaze];
    const metal=this.material('#c7d2d5',{metalness:.55,roughness:.38}),dark=this.material('#26343e',{metalness:.45,roughness:.5}),orange=this.material('#dc7939',{metalness:.25,roughness:.55}),blue=this.material('#137b9e',{metalness:.35,roughness:.3});
    // Earth launch pad with a walk-in lower cabin and an open front doorway.
    this.mesh(this.earthRoot,new T.PlaneGeometry(320,320),this.material('#426858'),[0,-.08,0]).object3D.rotation.x=-Math.PI/2;
    this.mesh(this.earthRoot,new T.CylinderGeometry(11,11,.12,64),this.material('#657779'),[0,0,0],true);
    this.mesh(this.earthRoot,new T.RingGeometry(7.8,8,64),orange,[0,.07,0]).object3D.rotation.x=-Math.PI/2;
    for(const x of[-1.6,1.6])this.mesh(this.earthRoot,new T.BoxGeometry(.12,.02,15),orange,[x,.08,9]);
    this.rocketExterior=this.entity(this.earthRoot);
    this.mesh(this.rocketExterior,new T.CylinderGeometry(2,2.2,3,48,1,true,.50,Math.PI*2-1),metal,[0,1.55,0],true);
    this.mesh(this.rocketExterior,new T.CylinderGeometry(1.85,2,9,48),metal,[0,7.55,0],true);
    const nose=[];for(let i=0;i<=20;i++){const u=i/20;nose.push(new T.Vector2(1.85*Math.cos(u*Math.PI/2),4*u));}this.mesh(this.rocketExterior,new T.LatheGeometry(nose,48),metal,[0,12.05,0],true);
    for(const y of[3.1,6.6,11.7])this.mesh(this.rocketExterior,new T.CylinderGeometry(2.015,2.015,.16,48),dark,[0,y,0],true);
    for(const x of[-2.3,2.3])this.mesh(this.rocketExterior,new T.BoxGeometry(.15,2.2,3),orange,[x,1.15,-.35],true);
    this.mesh(this.rocketExterior,new T.BoxGeometry(1.65,.05,4.5),dark,[0,.08,2]);
    this.label(this.rocketExterior,'ARES 01',[0,7.4,2.02],1.8,.4,{color:'#20343c',size:50});
    this.label(this.earthRoot,'BOARD THE ROCKET',[0,2.5,3],2.5,.35,{background:'#193441',size:40});
    const boardRing=this.mesh(this.earthRoot,new T.RingGeometry(.7,.82,48),new T.MeshBasicMaterial({color:'#78e9d4',side:T.DoubleSide}),[0,.11,1.3]);boardRing.object3D.rotation.x=-Math.PI/2;this.materials.push(boardRing.getObject3D('mesh').material);
    // The gantry and tanks provide scale while keeping the boarding route clear.
    for(const x of[-5.5,-7])this.mesh(this.earthRoot,new T.BoxGeometry(.35,15,.35),dark,[x,7.5,-1],true);
    for(let y=1;y<15;y+=2)this.mesh(this.earthRoot,new T.BoxGeometry(2,.12,1.3),metal,[-6.25,y,-1],true);
    this.mesh(this.earthRoot,new T.BoxGeometry(4,.18,1.3),dark,[-4,10,-1],true);
    for(const x of[7,9])this.mesh(this.earthRoot,new T.CylinderGeometry(.7,.7,3,24),metal,[x,1.5,-6],true);
    // Cabin stays stable around the viewer throughout the short flight.
    this.mesh(this.cabinRoot,new T.CylinderGeometry(2.1,2.1,.12,48),dark,[0,-.08,0]);
    this.mesh(this.cabinRoot,new T.CylinderGeometry(2.1,2.1,3.5,48,1,true,4.1,Math.PI*2-1.92),dark,[0,1.65,0]);
    for(const x of[-1.65,1.65])this.mesh(this.cabinRoot,new T.BoxGeometry(.16,3.3,.16),metal,[x,1.55,-1.5]);
    this.mesh(this.cabinRoot,new T.BoxGeometry(3.4,.16,.2),metal,[0,3.1,-1.5]);
    this.mesh(this.cabinRoot,new T.BoxGeometry(2.9,.5,.65),dark,[0,.8,-1.45]);
    this.flightReadout=this.label(this.cabinRoot,'READY FOR LAUNCH',[0,1.04,-1.09],2.5,.30,{background:'#092630',color:'#93ebdd',size:42});
    this.flightCaptionRoot=this.entity(this.scene);this.flightCaptionRoot.object3D.visible=false;this.flightCaption=this.label(this.flightCaptionRoot,'',[0,0,0],1.35,.20,{background:'#092630',color:'#d7f5ef',size:40});
    this.cabinHatch=this.mesh(this.cabinRoot,new T.BoxGeometry(1.7,2.8,.10),metal,[1.9,1.4,1.9]);
    this.button(this.cabinRoot,'Toggle sound',[-1.3,1.65,-1.5],'effects',.75,null,false);
    this.button(this.cabinRoot,'Skip flight',[1.3,1.65,-1.5],'journey:skip',.75,null,false);
    this.choiceRoot=this.entity(this.scene,[0,1.7,7]);this.label(this.choiceRoot,'EARTH → MARS',[0,.85,0],3,.40,{background:'#152b36',size:48});
    this.choiceLabel=this.label(this.choiceRoot,'Choose how to begin',[0,.4,0],3,.38,{background:'#152b36',size:38});
    this.choiceButtons=[this.button(this.choiceRoot,'Quick tutorial',[0,-.1,0],'journey:tutorial',2.7),this.button(this.choiceRoot,'Walk to the rocket',[0,-.62,0],'journey:launch',2.7),this.button(this.choiceRoot,'Skip to Mars',[0,-1.14,0],'journey:skip',2.7)];
    this.tutorialRoot=this.entity(this.scene,[0,1.6,8]);this.tutorialRoot.object3D.visible=false;
    this.tutorialLabel=this.label(this.tutorialRoot,'',[0,.45,0],2.6,.75,{background:'#152b36',size:38});this.button(this.tutorialRoot,'Next step',[0,-.22,0],'journey:next',2.0);this.button(this.tutorialRoot,'Skip tutorial',[0,-.72,0],'journey:launch',2.0);
    this.earthPlanet=this.mesh(this.flightRoot,new T.SphereGeometry(12,48,32),this.material('#3775a9',{roughness:1}),[-12,-10,-38]);
    this.marsPlanet=this.mesh(this.flightRoot,new T.SphereGeometry(9,48,32),this.material('#b96938',{roughness:1}),[14,5,-90]);
    const stars=new T.BufferGeometry(),coords=[];for(let i=0;i<700;i++){const a=i*2.39996,y=1-2*(i+.5)/700,r=Math.sqrt(1-y*y);coords.push(Math.cos(a)*r*220,y*220,Math.sin(a)*r*220);}stars.setAttribute('position',new T.Float32BufferAttribute(coords,3));const sm=new T.PointsMaterial({color:'#e0e8f3',size:.55,fog:false});this.geometries.push(stars);this.materials.push(sm);this.starField=new T.Points(stars,sm);this.flightRoot.object3D.add(this.starField);
    this.launchCloud=this.mesh(this.flightRoot,new T.SphereGeometry(70,24,16),new T.MeshBasicMaterial({color:'#c5e1e9',side:T.BackSide,transparent:true,opacity:0,depthWrite:false}),[0,0,0]);this.materials.push(this.launchCloud.getObject3D('mesh').material);
    this.upgradeRocket();this.buildFlightEffects();this.buildControllerModels();this.loadPlanetMaps();this.launchRecording=new Audio('audio/nasa-atlas-launch.mp3');this.launchRecording.preload='auto';this.launchRecording.volume=.55;this.launchRecording.loop=true;this.launchRecording.addEventListener('error',()=>{this.launchRecordingFailed=true;});this.cleanups.push(()=>{this.launchRecording.pause();this.launchRecording.removeAttribute('src');this.launchRecording.load();});this.bindJourney();this.showEarth();
  },
  async loadPlanetMaps(){const T=this.T;for(const [name,entity]of[['earth',this.earthPlanet],['mars',this.marsPlanet]]){try{const texture=await new T.TextureLoader().loadAsync('assets/'+name+'-surface.jpg');texture.colorSpace=T.SRGBColorSpace;this.textures.push(texture);entity.getObject3D('mesh').material.map=texture;entity.getObject3D('mesh').material.color.set('#ffffff');entity.getObject3D('mesh').material.needsUpdate=true;}catch(error){console.warn('Planet texture fallback',name,error);}}},
  buildControllerModels(){
    const T=this.T;this.controllerModels=[];
    for(const [id,letters]of[['left-hand',['X','Y']],['right-hand',['A','B']]]){
      const hand=$('#'+id),root=this.entity(hand,[0,0,0]);this.controllerModels.push(root);
      const shell=this.material('#d8dedc',{roughness:.5}),rubber=this.material('#273336',{roughness:.8}),buttonMat=this.material('#65c7b1',{roughness:.4});
      this.mesh(root,new T.CylinderGeometry(.026,.021,.115,16),shell,[0,-.015,.06]).object3D.rotation.x=-.28;
      const face=this.mesh(root,new T.SphereGeometry(1,20,12),shell,[0,.033,0]);face.object3D.scale.set(.047,.021,.068);
      const ring=this.mesh(root,new T.TorusGeometry(.067,.005,6,32),shell,[0,.026,-.015]);ring.object3D.rotation.x=Math.PI/2;
      const stick=this.mesh(root,new T.CylinderGeometry(.012,.01,.014,16),rubber,[-.018,.062,-.022]);
      this.listen(hand,'thumbstickmoved',e=>{stick.object3D.rotation.z=-e.detail.x*.28;stick.object3D.rotation.x=e.detail.y*.28;});
      letters.forEach((letter,i)=>{const button=this.mesh(root,new T.CylinderGeometry(.009,.009,.005,16),buttonMat,[.02,.059,.008-i*.024]);const label=this.label(root,letter,[.02,.063,.008-i*.024],.013,.013,{size:60,color:'#102923'});label.object3D.rotation.x=-Math.PI/2;this.listen(hand,letter.toLowerCase()+'buttondown',()=>button.object3D.position.y=.056);this.listen(hand,letter.toLowerCase()+'buttonup',()=>button.object3D.position.y=.059);});
      const trigger=this.mesh(root,new T.BoxGeometry(.025,.027,.012),rubber,[0,.005,-.06]);this.listen(hand,'triggerchanged',e=>trigger.object3D.rotation.x=-(e.detail.value||0)*.3);
      root.controllerPresent=!!hand.components['tracked-controls']?.controller;this.listen(hand,'controllerconnected',()=>{root.controllerPresent=true;root.object3D.visible=this.inVR;});this.listen(hand,'controllerdisconnected',()=>{root.controllerPresent=false;root.object3D.visible=false;});root.object3D.visible=false;
    }
  },
  bindJourney(){
    this.listen($('#journey-options'),'click',e=>{const b=e.target.closest('[data-journey]');if(b)this.journeyAction(b.dataset.journey);});
    this.listen(window,'blur',()=>{this.launchRecording.pause();this.flightSound?.gain.gain.setValueAtTime(0,this.audio.context.currentTime);});this.listen(document,'visibilitychange',()=>{if(document.hidden)this.launchRecording.pause();if(document.hidden&&this.flightSound)this.flightSound.gain.gain.setValueAtTime(0,this.audio.context.currentTime);});
    this.listen($('#journey-skip'),'click',()=>this.journeyAction('skip'));this.listen($('#journey-board'),'click',()=>this.boardRocket(true));
    this.listen($('#journey-sound'),'click',()=>{this.effectsToggle();$('#journey-sound').textContent=this.soundscape.enabled?'Sound on':'Sound off';if(!this.soundscape.enabled)this.launchRecording.pause();});
    this.listen($('#tutorial-next'),'click',()=>this.journeyAction('next'));this.listen($('#tutorial-replay'),'click',()=>this.restartTutorial());
    this.listen(this.scene,'enter-vr',()=>{this.controllerModels.forEach(e=>e.object3D.visible=e.controllerPresent);this.updateJourneyUI();if(this.journey.phase==='mars')return;this.setVRMenu(false);this.setVRCaptions(false);this.refreshTargets();});
    this.listen(this.scene,'exit-vr',()=>{this.controllerModels.forEach(e=>e.object3D.visible=false);this.updateJourneyUI();});
    this.listen($('#right-hand'),'bbuttondown',()=>{if(this.journey.phase!=='mars')this.journeyAction('skip');});
    this.listen(window,'keydown',e=>{if(e.code==='Enter'&&this.journey.phase==='earth')this.boardRocket(true);});
  },
  showEarth(){
    this.resetFlightPresentation();this.journeyFinished=false;this.autoBoard=false;this.launchRecording.pause();this.launchRecording.currentTime=0;this.launchAudioPhase=null;this.flightCaptionRoot.object3D.visible=false;this.launchCloud.getObject3D('mesh').material.color.set('#c5e1e9');this.launchCloud.getObject3D('mesh').material.opacity=0;this.cabinHatch.object3D.position.x=1.9;$('#journey-hud').hidden=false;this.marsRoots.forEach(o=>o.visible=false);this.rocketExterior.object3D.visible=true;this.earthRoot.object3D.position.y=0;this.earthRoot.object3D.visible=true;this.flightRoot.object3D.visible=false;this.cabinRoot.object3D.visible=false;
    this.scene.object3D.background=new this.T.Color('#8bbbd3');this.scene.object3D.fog=new this.T.Fog('#a7cbd9',45,150);this.scene.object3D.environment=null;
    this.placeJourneyPlayer(0,12);this.sun.position.set(-18,30,12);this.sun.target.position.set(0,3,0);this.sun.target.updateMatrixWorld();
    this.setVRMenu(false);this.setVRCaptions(false);$('#arrival').hidden=true;document.body.classList.add('preflight');this.updateJourneyUI();this.refreshTargets();
  },
  placeJourneyPlayer(x,z){const p=this.playerPosition();this.rig.object3D.position.x+=x-p.x;this.rig.object3D.position.z+=z-p.z;this.rig.object3D.position.y=0;this.recenter();this.keys.clear();this.stick={x:0,y:0};},
  journeyAction(action){
    if(action==='skip'){this.journey.skip();this.finishJourney();return;}
    if(action==='next'){if(this.journey.nextLesson())this.updateJourneyUI();return;}
    if(this.journey.choose(action)){this.audio.unlock();this.audio.stop();this.updateJourneyUI();}
  },
  updateJourneyUI(){
    const phase=this.journey.phase;this.choiceRoot.object3D.visible=this.inVR&&phase==='choice';this.tutorialRoot.object3D.visible=this.inVR&&phase==='tutorial';
    $('#journey-options').hidden=phase!=='choice';$('#tutorial-panel').hidden=phase!=='tutorial';$('#journey-board').hidden=phase!=='earth';
    const lessons=[['Look around','Turn your head in VR. On a screen, drag the view. Your controllers are now visible.'],['Move and turn','Left stick: walk. Right stick: snap turn. Desktop: WASD or arrows. Touch: use the movement pad.'],['Point and select','Aim the controller ray and press its trigger. Try Next step below. Desktop: click; mobile: tap.'],['Keep the view clear','On Mars: X opens menu/map, Y captions, A replays Nova, B stops a mission. Press Next to board your rocket.']];
    if(phase==='tutorial'){const [title,text]=lessons[this.journey.lesson];$('#tutorial-title').textContent=(this.journey.lesson+1)+' / 4 · '+title;$('#tutorial-copy').textContent=text;this.tutorialLabel.change((this.journey.lesson+1)+' / 4 · '+title+'\n'+text);this.positionTutorial();this.narrateText(text);}
    if(phase==='earth'){$('#journey-status').textContent='Walk along the marked path and enter the rocket doorway.';this.tutorialRoot.object3D.visible=false;}
    else if(phase==='choice')$('#journey-status').textContent='Your expedition begins on Earth.';
    this.refreshTargets();
  },
  positionTutorial(){const p=this.playerPosition(),d=new this.T.Vector3();this.head.object3D.getWorldDirection(d);d.y=0;d.normalize();this.tutorialRoot.object3D.position.copy(p).addScaledVector(d,-2.8);this.tutorialRoot.object3D.position.y=p.y-.15;this.tutorialRoot.object3D.rotation.y=Math.atan2(d.x,d.z);this.tutorialRoot.object3D.scale.setScalar(.75);},
  restartTutorial(){this.stopMission(false);this.journey=new JourneyCore.Journey();this.journey.choose('tutorial');this.showEarth();},
  boardRocket(accessible=false){
    if(this.journey.phase!=='earth')return;
    if(accessible){this.autoBoard=true;$('#journey-status').textContent='Following the boarding path. Look around as you enter the cabin.';return;}
    const current=this.playerPosition();if(!this.journey.board(current.x,current.z))return;
    this.resetFlightPresentation();this.autoBoard=false;this.boardingStart=this.rig.object3D.position.clone();this.audio.unlock();this.earthRoot.object3D.visible=true;this.rocketExterior.object3D.visible=false;this.cabinRoot.object3D.visible=true;this.flightCaptionRoot.object3D.visible=this.inVR;this.flightRoot.object3D.visible=true;this.choiceRoot.object3D.visible=false;this.updateJourneyUI();
    this.scene.object3D.background=new this.T.Color('#98bfd3');this.scene.object3D.fog=null;this.setVRMenu(false);this.setVRCaptions(false);this.refreshTargets();
  },
  tickJourney(dt,time){
    if(!this.journey||this.journey.phase==='mars')return false;
    this.soundscape.silence();this.updateFlightSound();if($('dialog[open]')||!this.soundscape.focused)return true;
    if(this.journey.phase==='earth'||this.journey.phase==='tutorial'){
      if(this.autoBoard&&this.journey.phase==='earth'){
        const p=this.playerPosition(),target=new this.T.Vector3(0,p.y,Math.abs(p.x)>.15?3:1.2),d=target.sub(p),distance=d.length();
        if(distance>.03)this.rig.object3D.position.addScaledVector(d.normalize(),Math.min(distance,1.8*dt));
        this.boardRocket();return true;
      }
      let f=(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0)-(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0)-(Math.abs(this.stick.y)>.16?this.stick.y:0),r=(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0)+(Math.abs(this.stick.x)>.16?this.stick.x:0);
      const d=new this.T.Vector3();this.head.object3D.getWorldDirection(d);const length=Math.hypot(d.x,d.z)||1,n=Math.max(1,Math.hypot(f,r));this.rig.object3D.position.x+=(-d.x*f+d.z*r)/length/n*2*dt;this.rig.object3D.position.z+=(-d.z*f-d.x*r)/length/n*2*dt;
      const p=this.playerPosition(),x=Math.max(-10,Math.min(10,p.x)),z=Math.max(-8,Math.min(18,p.z));this.rig.object3D.position.x+=x-p.x;this.rig.object3D.position.z+=z-p.z;
      // The only entrance is the front door; the rocket sides remain solid.
      if(Math.hypot(x,z)<2.2&&!(Math.abs(x)<.85&&z>-.8)){const l=Math.hypot(x,z)||1;this.rig.object3D.position.x+=x/l*2.2-x;this.rig.object3D.position.z+=z/l*2.2-z;}
      if(this.journey.phase==='earth')this.boardRocket();else{const position=this.playerPosition();if(position.distanceTo(this.tutorialRoot.object3D.position)>4.5)this.positionTutorial();}return true;
    }
    if(this.journey.flying){
      this.journey.step(dt);if(this.journey.phase==='mars'){this.finishJourney();return true;}
      this.renderFlight(dt,time);
      return true;
    }
    return true;
  },
  updateFlightSound(){
    const phase=this.journey.phase,audible=this.soundscape.enabled&&this.soundscape.focused&&!document.hidden&&!$('dialog[open]');
    if(this.launchAudioPhase!==phase){this.launchRecording.pause();this.launchRecording.currentTime=0;this.launchAudioPhase=phase;this.launchPlayBlocked=false;}
    if(phase==='launch'&&audible&&!this.launchRecordingFailed&&!this.launchPlayBlocked){
      const u=this.journey.progress;this.launchRecording.volume=(this.audio.playing?.18:.55)*Math.min(1,u*8)*Math.min(1,(1-u)*5);
      if(this.launchRecording.paused&&!this.launchPlayPending){this.launchPlayPending=true;this.launchRecording.play().catch(()=>{this.launchPlayBlocked=true;}).finally(()=>{this.launchPlayPending=false;});}
    }else this.launchRecording.pause();
    const c=this.audio.context;if(!c||c.state!=='running')return;
    if(!this.flightSound){this.soundscape.init(c);if(!this.soundscape.buffer)return;const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=this.soundscape.buffer;source.loop=true;filter.type='lowpass';filter.frequency.value=190;gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(c.destination);source.start();this.flightSound={source,gain,filter};}
    const volume=phase==='launch'?((this.launchRecordingFailed||this.launchPlayBlocked) ? .25 : 0):phase==='entry'?.12:phase==='landing'?.18*(1-this.journey.progress*.7):phase==='cruise'||phase==='orbit'?.025:0;
    this.flightSound.gain.gain.setTargetAtTime(this.soundscape.enabled&&this.soundscape.focused&&!$('dialog[open]')?volume:0,c.currentTime,.2);
  },
  finishJourney(){
    if(this.journeyFinished&&this.journey.phase==='mars')return;this.journeyFinished=true;this.ensureRoverLoaded();this.exhaustDust.visible=false;this.sun.castShadow=true;this.journey.skip();this.launchRecording.pause();this.launchRecording.currentTime=0;this.flightCaptionRoot.object3D.visible=false;this.groundHaze.position.y=0;this.groundHaze.material.opacity=.24;if(this.flightSound)this.flightSound.gain.gain.setValueAtTime(0,this.audio.context.currentTime);
    this.earthRoot.object3D.visible=this.flightRoot.object3D.visible=this.cabinRoot.object3D.visible=this.choiceRoot.object3D.visible=this.tutorialRoot.object3D.visible=false;
    this.marsRoots.forEach(o=>o.visible=true);$('#land').object3D.position.y=0;this.scene.object3D.background.set('#cba17a');this.scene.object3D.fog=this.marsFog;this.scene.object3D.environment=this.environmentTarget?.texture||null;
    document.body.classList.remove('preflight');$('#journey-hud').hidden=true;this.visit(0,false);this.placeJourneyPlayer(0,0);this.welcomeStarted=true;this.say('welcome');this.setVRMenu(false);this.setVRCaptions(false);this.refreshTargets();this.notice('Landed on Mars. Walk into a mission circle to begin.');
  }
});
