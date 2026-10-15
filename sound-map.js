'use strict';
class MarsSoundscape {
  constructor(){this.enabled=true;this.focused=true;this.nodes=[];this.stepDistance=0;}
  init(context){
    if(this.context||!context||context.state!=='running')return;this.context=context;
    const c=context;this.master=c.createGain();this.master.gain.value=0;this.master.connect(c.destination);
    const buffer=c.createBuffer(1,c.sampleRate*6,c.sampleRate),data=buffer.getChannelData(0);let brown=0;
    for(let i=0;i<data.length;i++){brown=(brown+(Math.random()*2-1)*.025)/1.015;data[i]=brown*3;}
    this.buffer=buffer;
    const wind=c.createBufferSource();wind.buffer=buffer;wind.loop=true;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=620;
    this.windGain=c.createGain();this.windGain.gain.value=.23;wind.connect(filter);filter.connect(this.windGain);this.windGain.connect(this.master);wind.start();this.nodes.push(wind);
    const motor=c.createOscillator();motor.type='triangle';motor.frequency.value=85;const motorFilter=c.createBiquadFilter();motorFilter.type='lowpass';motorFilter.frequency.value=900;
    this.motorGain=c.createGain();this.motorGain.gain.value=0;this.pan=c.createStereoPanner();motor.connect(motorFilter);motorFilter.connect(this.motorGain);this.motorGain.connect(this.pan);this.pan.connect(this.master);motor.start();this.nodes.push(motor);this.motor=motor;
    const grit=c.createBufferSource();grit.buffer=buffer;grit.loop=true;grit.playbackRate.value=2.8;const gritFilter=c.createBiquadFilter();gritFilter.type='bandpass';gritFilter.frequency.value=1100;gritFilter.Q.value=.6;
    this.gritGain=c.createGain();this.gritGain.gain.value=0;grit.connect(gritFilter);gritFilter.connect(this.gritGain);this.gritGain.connect(this.pan);grit.start();this.nodes.push(grit);
  }
  silence(){if(this.context){this.master.gain.cancelScheduledValues(this.context.currentTime);this.master.gain.setValueAtTime(0,this.context.currentTime);}}
  update({speed,distance,pan,walking,dt,narrating,paused}){
    if(!this.context)return;const c=this.context,t=c.currentTime;
    const audible=this.enabled&&this.focused&&!paused;
    this.master.gain.setTargetAtTime(audible?(narrating?.22:.68):0,t,.09);
    this.windGain.gain.setTargetAtTime(.18+.065*Math.sin(t*.13)+.035*Math.sin(t*.37),t,.4);
    const moving=Math.abs(speed)>.04?Math.min(1,Math.abs(speed)/2.4):0,attenuation=1/(1+distance*distance*.04);
    this.motor.frequency.setTargetAtTime(75+moving*190,t,.08);this.motorGain.gain.setTargetAtTime(moving*.14*attenuation,t,.08);this.gritGain.gain.setTargetAtTime(moving*.35*attenuation,t,.08);this.pan.pan.setTargetAtTime(Math.max(-1,Math.min(1,pan)),t,.08);
    if(audible&&walking>0&&walking<.8){this.stepDistance+=walking;if(this.stepDistance>.82){this.stepDistance=0;this.footstep();}}else if(!audible)this.stepDistance=0;
  }
  footstep(){const c=this.context,t=c.currentTime,s=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();s.buffer=this.buffer;s.playbackRate.value=1.6+Math.random()*.4;filter.type='lowpass';filter.frequency.value=950;gain.gain.setValueAtTime(.001,t);gain.gain.exponentialRampToValueAtTime(.38,t+.016);gain.gain.exponentialRampToValueAtTime(.001,t+.16);s.connect(filter);filter.connect(gain);gain.connect(this.master);s.onended=()=>{s.disconnect();filter.disconnect();gain.disconnect();};s.start(t,Math.random()*4);s.stop(t+.18);}
  dispose(){this.silence();for(const n of this.nodes){try{n.stop();}catch{}n.disconnect();}this.master?.disconnect();}
}
Object.assign(MarsExpedition.prototype,{
  buildSoundMap(){
    this.soundscape=new MarsSoundscape();this.mapCanvas=$('#minimap');this.mapContext=this.mapCanvas.getContext('2d');this.lastMapTime=-1000;
    this.mapGround=document.createElement('canvas');this.mapGround.width=this.mapGround.height=256;const ctx=this.mapGround.getContext('2d');
    const center=MarsCore.FIELD,scale=2.45;
    ctx.fillStyle='#161d1d';ctx.fillRect(0,0,256,256);
    for(let py=0;py<256;py+=2)for(let px=0;px<256;px+=2){const x=center.x+(px-128)/scale,z=center.z+(py-128)/scale;if(Math.hypot(x-center.x,z-center.z)>46)continue;const h=this.terrainHeight(x,z),shade=Math.max(0,Math.min(30,h*2));ctx.fillStyle=`rgb(${70+shade},${64+shade},${53+shade})`;ctx.fillRect(px,py,2,2);if(h>1&&h%2<.2){ctx.fillStyle='#95846a55';ctx.fillRect(px,py,2,2);}}
    const toggle=async()=>{this.soundscape.enabled=!this.soundscape.enabled;if(this.soundscape.enabled){await this.audio.unlock();this.soundscape.init(this.audio.context);}else this.soundscape.silence();this.refreshSoundButton();};
    this.listen($('#effects-toggle'),'click',toggle);this.effectsToggle=toggle;
    this.listen(window,'blur',()=>{this.soundscape.focused=false;this.soundscape.silence();});this.listen(window,'focus',()=>this.soundscape.focused=true);
    this.listen(document,'visibilitychange',()=>{if(document.hidden)this.soundscape.silence();});
    this.listen(window,'pointerdown',()=>{if(!this.audio.context)this.audio.unlock();},{once:true});
    this.effects3d=this.button(this.vrPanel,'Ambient sound on',[1.9,-.23,0],'effects',1.65,null,true);
    const texture=new this.T.CanvasTexture(this.mapCanvas);texture.colorSpace=this.T.SRGBColorSpace;this.textures.push(texture);this.mapTexture=texture;
    const material=new this.T.MeshBasicMaterial({map:texture,toneMapped:false,side:this.T.DoubleSide});this.materials.push(material);
    this.wristMap=this.mesh($('#left-hand'),new this.T.PlaneGeometry(.23,.23),material,[0,.09,.03]);this.wristMap.object3D.rotation.x=-Math.PI/2;this.wristMap.object3D.visible=false;
    this.listen(this.scene,'enter-vr',()=>this.wristMap.object3D.visible=false);this.listen(this.scene,'exit-vr',()=>this.wristMap.object3D.visible=false);
  },
  refreshSoundButton(){const enabled=this.soundscape.enabled;$('#effects-toggle').textContent=enabled?'Ambience on':'Ambience off';$('#effects-toggle').setAttribute('aria-pressed',String(enabled));this.effects3d.change(enabled?'Ambient sound on':'Ambient sound off');},
  tickSoundMap(dt,time){
    const p=this.playerPosition(),d=this.directionVector;this.head.object3D.getWorldDirection(d);const rx=this.roverPosition.x-p.x,rz=this.roverPosition.z-p.z,distance=Math.hypot(rx,rz);
    const walking=this.previousSoundPosition?Math.hypot(p.x-this.previousSoundPosition.x,p.z-this.previousSoundPosition.z):0;this.previousSoundPosition={x:p.x,z:p.z};
    this.soundscape.init(this.audio.context);this.soundscape.update({speed:this.roverSpeed,distance,pan:distance?(rx*d.z-rz*d.x)/distance:0,walking:this.zones.active===4?0:walking,dt,narrating:this.audio.playing||!!this.audio.utterance,paused:document.hidden||!!$('dialog[open]')});
    if(time-this.lastMapTime<125)return;this.lastMapTime=time;this.drawMap(p,d);this.mapTexture.needsUpdate=true;
  },
  drawMap(player,direction){
    const c=this.mapContext,s=2.45,to=(x,z)=>[128+(x-MarsCore.FIELD.x)*s,128+(z-MarsCore.FIELD.z)*s];
    c.clearRect(0,0,256,256);c.drawImage(this.mapGround,0,0);c.save();c.beginPath();c.arc(128,128,46*s,0,Math.PI*2);c.clip();
    c.strokeStyle='#ffffff0d';c.lineWidth=1;for(let i=0;i<256;i+=24){c.beginPath();c.moveTo(i,0);c.lineTo(i,256);c.moveTo(0,i);c.lineTo(256,i);c.stroke();}
    const target=MarsCore.ZONES.find(z=>z.id===(this.zones.active||this.destination));
    if(target){const [x,z]=to(target.x,target.z+.6),[px,pz]=to(player.x,player.z);c.strokeStyle='#f1ca7a';c.setLineDash([4,4]);c.beginPath();c.moveTo(px,pz);c.lineTo(x,z);c.stroke();c.setLineDash([]);}
    for(const z of MarsCore.ZONES){const [x,y]=to(z.x,z.z+.6),active=this.zones.active===z.id;c.strokeStyle=active?'#9be6cf':'#e2b968';c.fillStyle=active?'#9be6cf33':'#e2b96816';c.beginPath();const boundaryCenter=active?to(z.x,z.z-1):[x,y];c.arc(boundaryCenter[0],boundaryCenter[1],(active?6.5:1.35)*s,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#f7e8c8';c.font='bold 14px Arial';c.textAlign='center';c.fillText(String(z.id),x,y+5);}
    const [ox,oy]=to(-25,10);c.fillStyle='#c9caca';c.fillRect(ox-5,oy-4,10,8);
    const [rx,ry]=to(this.roverPosition.x,this.roverPosition.z);c.save();c.translate(rx,ry);c.rotate(-this.roverHeading);c.fillStyle='#74dbef';c.fillRect(-3,-5,6,10);c.restore();
    const [px,py]=to(player.x,player.z);c.save();c.translate(px,py);c.rotate(Math.atan2(-direction.x,direction.z));c.shadowColor='#ffffff';c.shadowBlur=5;c.fillStyle='#fff';c.beginPath();c.moveTo(0,-8);c.lineTo(-5,6);c.lineTo(0,3);c.lineTo(5,6);c.closePath();c.fill();c.restore();c.restore();
    c.strokeStyle='#d3b37e';c.lineWidth=2;c.beginPath();c.arc(128,128,46*s,0,Math.PI*2);c.stroke();c.fillStyle='#eef0e9';c.font='bold 14px Arial';c.textAlign='center';c.fillText('N',128,12);
  },
  setupRoverWheels(model){
    this.roverWheels=[];this.roverSteering=[];model.traverse(o=>{if(/^wheel_(left|right)_(front|middle|rear)$/i.test(o.name))this.roverWheels.push(o);if(/^steer_(left|right)_(front|rear)$/i.test(o.name))this.roverSteering.push(o);});
  },
  spinRoverWheels(distance){for(const w of this.roverWheels||[])w.rotation.x+=distance/.2628693;for(const w of this.fallbackWheels||[])w.rotation.x+=distance/.32;}
});
