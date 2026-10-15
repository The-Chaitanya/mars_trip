'use strict';
const $ = selector => document.querySelector(selector);
let expedition = null;

// A single boot gate waits for both the DOM and A-Frame. Child loaded events cannot boot it twice.
AFRAME.registerComponent('mars-expedition', {
  init() {
    let started = false;
    const start = async () => {
      if (started || !this.el.hasLoaded || document.readyState === 'loading') return;
      started = true;
      try { expedition = new MarsExpedition(this.el); await expedition.init(); }
      catch (error) { console.error('Mars startup failed', error); $('#load-status').textContent = 'The scene could not start. Reload to try again.'; $('#reload').hidden = false; }
    };
    this.el.addEventListener('loaded', event => { if (event.target === this.el) start(); });
    document.addEventListener('DOMContentLoaded', start, { once: true });
    start();
  },
  tick(time, delta) { expedition?.tick(time, delta); },
  remove() { expedition?.dispose(); expedition = null; }
});

class GuideAudio {
  constructor(onState, onError) {
    this.onState=onState;this.onError=onError;this.cache=new Map();this.token=0;this.muted=false;this.playing=false;
    this.activeKey=null;this.pending=false;
  }
  async unlock() {
    try {
      const Constructor = window.AudioContext || window.webkitAudioContext;
      if (!Constructor) throw new Error('AudioContext unavailable');
      this.context ||= new Constructor();
      if (this.context.state !== 'running') await this.context.resume();
      return this.context.state === 'running';
    } catch (e) { this.onError('Audio is unavailable in this browser. The guide captions still work.'); return false; }
  }
  stop() {
    this.token++;this.activeKey=null;this.pending=false;
    if(this.source){this.source.onended=null;try{this.source.stop();}catch(_){}this.source.disconnect();this.source=null;}
    this.playing=false;this.onState(false);
  }
  async play(key,{restart=false}={}) {
    // Repeated clicks on an unchanged result must not restart the same sentence.
    if(!restart&&this.activeKey===key&&(this.pending||this.playing))return;
    this.stop();if(this.muted)return;
    const token=this.token;this.activeKey=key;this.pending=true;
    if(!await this.unlock()||token!==this.token){if(token===this.token){this.pending=false;this.activeKey=null;}return;}
    try {
      if(!this.cache.has(key)){
        const url='audio/'+key+'.mp3?v='+encodeURIComponent(window.MARS_AUDIO_VERSION||'1');
        this.cache.set(key,fetch(url).then(r=>{if(!r.ok)throw new Error('Audio '+r.status);return r.arrayBuffer();}).then(b=>this.context.decodeAudioData(b)).catch(e=>{this.cache.delete(key);throw e;}));
      }
      const buffer=await this.cache.get(key);
      if(token!==this.token||this.muted)return;
      const source=this.context.createBufferSource();this.source=source;source.buffer=buffer;source.connect(this.context.destination);
      source.onended=()=>{source.disconnect();if(token===this.token){this.source=null;this.activeKey=null;this.pending=false;this.playing=false;this.onState(false);}};
      source.start();this.pending=false;this.playing=true;this.onState(true);
    }catch(e){if(token===this.token){this.pending=false;this.activeKey=null;this.playing=false;this.onState(false);this.onError('Guide audio could not load. Captions are available; select Replay to retry.');}}
  }
  mute(value){this.muted=value;if(value)this.stop();}
  dispose(){this.stop();this.context?.close();}
}

class MarsExpedition {
  constructor(scene) {
    this.scene = scene; this.T = AFRAME.THREE; this.state = new MarsCore.Mission(); this.ready = false;
    this.anchors = [[0,0,3],[-12,0,-13],[12,0,-13],[0,0,-29],[20,0,5],[-18,0,-32]];
    this.names = ['Base camp','Rock field','Gravity lab','Mars challenge'];
    this.targets = []; this.materials = []; this.geometries = []; this.textures = [];
    this.lastVoice = 'welcome'; this.captionPages = []; this.captionPage = 0; this.captionClock = 0; this.currentAction = '';
    this.inVR = false; this.turnReady = true; this.quizLockedUntil = 0; this.lastTick = null; this.pointer = null;
    this.cleanups = [];
    this.audio = new GuideAudio(playing => { $('#voice').textContent = playing ? 'Ⅱ' : '▷'; $('#voice').classList.toggle('playing',playing); $('#voice').setAttribute('aria-label',playing?'Pause voice guide':'Play voice guide'); }, message => this.notice(message));
  }
  listen(target, name, fn, options) { target.addEventListener(name, fn, options); this.cleanups.push(() => target.removeEventListener(name,fn,options)); }
  async init() {
    this.rig = $('#rig'); this.head = $('#head');
    const T = this.T, renderer = this.scene.renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.scene.object3D.background = new T.Color('#cba17a');
    this.scene.object3D.fog = new T.FogExp2('#cba17a',.028);
    this.scene.object3D.add(new T.HemisphereLight('#e9e1d0','#6c4e34',1.8));
    this.sun = new T.DirectionalLight('#fff0d5',2.5); this.sun.position.set(-24,35,-18); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024,1024); Object.assign(this.sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:1,far:90}); this.sun.shadow.bias=-.0002; this.sun.shadow.normalBias=.025;
    this.scene.object3D.add(this.sun,this.sun.target);
    $('#load-status').textContent = 'Preparing rocks, light and science stations…';
    this.buildSky(); this.buildLandscape(); this.buildStations(); this.buildVRPanel(); this.buildExploration(); this.bind(); this.bindExploration();this.buildSoundMap();this.buildComfort();
    this.ready = true; this.visit(0,false); this.refresh(); this.checkVR();this.buildJourney();
    $('#loading').hidden = true;
    // External assets are bundled locally; fallback geometry keeps activities usable while loading.
    this.loadSurfaceAssets(); this.loadHillAssets();
    this.listen(this.scene.canvas,'webglcontextlost',event => { event.preventDefault(); this.audio.stop(); $('#loading').hidden=false; $('#load-status').textContent='Graphics paused. Reload the expedition to restore the scene.'; $('#reload').hidden=false; });
  }
  entity(parent, position = [0,0,0]) {
    const e = document.createElement('a-entity'); e.setAttribute('position',position.join(' '));
    // A-Frame applies attributes asynchronously on new entities. Static batching
    // needs their actual transform now, before the first loaded/render event.
    e.object3D.position.set(position[0],position[1],position[2]);
    parent.appendChild(e); return e;
  }
  material(color, extra = {}) { const m = new this.T.MeshStandardMaterial({color,roughness:.92,...extra}); this.materials.push(m); return m; }
  mesh(parent, geometry, material, position = [0,0,0], shadow = false) {
    this.geometries.push(geometry); const e = this.entity(parent,position); const mesh = new this.T.Mesh(geometry,material);
    mesh.castShadow=shadow; mesh.receiveShadow=true; e.setObject3D('mesh',mesh); return e;
  }
  label(parent, text, position, width=3, height=.5, options={}) {
    const e=this.entity(parent,position),canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.max(96,Math.round(1024*height/width));
    const ctx=canvas.getContext('2d'),texture=new this.T.CanvasTexture(canvas);texture.colorSpace=this.T.SRGBColorSpace;this.textures.push(texture);
    const material=new this.T.MeshBasicMaterial({map:texture,transparent:true,side:this.T.DoubleSide,toneMapped:false,depthWrite:!!options.background}); this.materials.push(material);
    const geo=new this.T.PlaneGeometry(width,height);this.geometries.push(geo);e.setObject3D('mesh',new this.T.Mesh(geo,material));
    e.change=value=>{
      if(e.value===value)return;
      e.value=value;ctx.clearRect(0,0,canvas.width,canvas.height);
      if(options.background){ctx.fillStyle=options.background;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#aec0a340';ctx.lineWidth=4;ctx.strokeRect(2,2,1020,canvas.height-4);}
      let size=options.size||46,lines=[];
      do {ctx.font=`500 ${size}px Arial`;lines=MarsCore.wrapText(String(value),s=>ctx.measureText(s).width,950);if(lines.length*size*1.3<canvas.height-20)break;size--;} while(size>20);
      ctx.fillStyle=options.color||'#f1f0e7';ctx.textAlign='center';ctx.textBaseline='middle';
      lines.forEach((line,i)=>ctx.fillText(line,512,canvas.height/2+(i-(lines.length-1)/2)*size*1.3));texture.needsUpdate=true;
    };e.change(text);return e;
  }
  target(e, action, station=null, vrOnly=false) {
    const entry={e,action,station,vrOnly,enabled:true}; this.targets.push(entry);
    e.addEventListener('click',()=>{if(!this.ready || !e.classList.contains('target'))return;this.dispatch(action);});
    e.addEventListener('mouseenter',()=>{if(e.classList.contains('target')){$('body').style.cursor='pointer';const m=e.getObject3D('mesh')?.material;if(m?.emissive){m.emissive.setHex(0x7b9a64);m.emissiveIntensity=.15;}}});
    e.addEventListener('mouseleave',()=>{$('body').style.cursor='';const m=e.getObject3D('mesh')?.material;if(m?.emissive)m.emissiveIntensity=0;});
    return entry;
  }
  button(parent,text,position,action,width=2.7,station=null,vrOnly=false) {
    const e=this.label(parent,text,position,width,.4,{background:'#253024',color:'#e5efdb',size:47});this.target(e,action,station,vrOnly);return e;
  }
  noise(x,z) {
    const hash=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n);};
    const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
    return (hash(ix,iz)*(1-u)+hash(ix+1,iz)*u)*(1-v)+(hash(ix,iz+1)*(1-u)+hash(ix+1,iz+1)*u)*v;
  }
  terrainHeight(x,z) {
    const smooth=(a,b,t)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*(3-2*u);};
    const near=Math.min(...this.anchors.map(a=>Math.hypot(x-a[0],z-a[2]+1)));
    const wx=x+(this.noise(x*.022,z*.025)-.5)*17,wz=z+(this.noise(x*.028+90,z*.021)-.5)*15;
    const ridge=1-Math.abs(this.noise(wx*.043,wz*.047)*2-1);
    let h=(this.noise(wx*.065,wz*.065)-.5)*4+Math.pow(ridge,3)*4;
    h+=Math.sin(wx*.35+this.noise(wx*.025,wz*.03)*7)*.28;
    h+=7*Math.exp(-((x+30)**2/180+(z+16)**2/360));
    h+=5*Math.exp(-((x-32)**2/190+(z+34)**2/220));
    const valley=z+21+Math.sin(x*.075)*7;h-=2.8*Math.exp(-valley*valley/35);
    const crater=Math.hypot(wx+35,wz+43);h+=4.5*Math.exp(-Math.pow((crater-12)/3.5,2))-2*Math.exp(-Math.pow(crater/9,2));
    h+=smooth(44,105,Math.hypot(x,z+8))*(8+this.noise(wx*.035,wz*.035)*23);
    const missionFlat=smooth(6.8,12.5,near),stationFlat=smooth(8,13,Math.hypot(x+25,z-10)),roverFlat=smooth(10.5,14,Math.hypot(x-20,z));
    return h*missionFlat*stationFlat*roverFlat-.025;
  }
  surfaceMaps() {
    const size=512,canvas=document.createElement('canvas'),normal=document.createElement('canvas');canvas.width=canvas.height=normal.width=normal.height=size;
    const ctx=canvas.getContext('2d'),nctx=normal.getContext('2d'),pixels=ctx.createImageData(size,size),np=nctx.createImageData(size,size),heights=new Float32Array(size*size);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const coarse=this.noise(x/30,y/30),fine=this.noise(x/5,y/5),grain=this.noise(x*2,y*2);const i=y*size+x;
      heights[i]=coarse*.55+fine*.3+grain*.15;const value=heights[i];const fleck=grain>.75?16:0;
      pixels.data.set([134+value*47+fleck,109+value*40+fleck,80+value*32+fleck,255],i*4);
    }
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const i=y*size+x,dx=heights[y*size+(x+1)%size]-heights[y*size+(x+size-1)%size],dy=heights[((y+1)%size)*size+x]-heights[((y+size-1)%size)*size+x];
      np.data.set([128-dx*170,128-dy*170,248,255],i*4);
    }
    ctx.putImageData(pixels,0,0);nctx.putImageData(np,0,0);
    const map=new this.T.CanvasTexture(canvas),normalMap=new this.T.CanvasTexture(normal);map.colorSpace=this.T.SRGBColorSpace;
    for(const t of[map,normalMap]){t.wrapS=t.wrapT=this.T.RepeatWrapping;t.repeat.set(64,64);t.anisotropy=Math.min(4,this.scene.renderer.capabilities.getMaxAnisotropy());this.textures.push(t);}return{map,normalMap};
  }
  stoneGeometry(detail=1) {
    const g=new this.T.IcosahedronGeometry(1,detail);const p=g.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),f=.78+this.noise(x*3+7,z*3+y)*.35;p.setXYZ(i,x*f,y*f*.7,z*f*.92);}g.computeVertexNormals();return g;
  }
  buildLandscape() {
    const T=this.T,land=$('#land'),maps=this.surfaceMaps();this.groundMaterial=this.material('#c2b298',{...maps,normalScale:new T.Vector2(.75,.75)});
    const geo=new T.PlaneGeometry(360,360,192,192);geo.rotateX(-Math.PI/2);const p=geo.attributes.position,colors=[];
    for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,this.terrainHeight(x,z));const n=.8+this.noise(x*.08,z*.08)*.2;colors.push(n,n*.97,n*.91);}
    geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setAttribute('uv1',geo.attributes.uv.clone());this.terrainGeometry=geo;geo.computeVertexNormals();this.groundMaterial.vertexColors=true;this.prepareHillMaterial(geo);this.mesh(land,geo,this.groundMaterial);
    const rockMap=maps.map.clone();rockMap.repeat.set(1,1);this.textures.push(rockMap);this.rockMap=rockMap;
    const rockMat=this.material('#998472',{map:rockMap}),rockGeo=this.stoneGeometry(1);this.geometries.push(rockGeo);
    const rocks=new T.InstancedMesh(rockGeo,rockMat,650),dummy=new T.Object3D();let seed=84;const rnd=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646};
    for(let i=0;i<650;i++){
      let x=(rnd()-.5)*150,z=(rnd()-.5)*150;if(this.anchors.some(a=>Math.hypot(x-a[0],z-a[2]+2)<4.6)){x+=18;z+=22;}
      const s=i<85?.22+rnd()*.8:.03+rnd()*.16;dummy.position.set(x,this.terrainHeight(x,z)+s*.38,z);dummy.rotation.set(rnd()*.6,rnd()*6,rnd()*.4);dummy.scale.set(s,s*(.6+rnd()*.5),s);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
      rocks.setColorAt(i,new T.Color().setHSL(.075+rnd()*.025,.15+rnd()*.12,.65+rnd()*.25));
    }rocks.receiveShadow=true;land.object3D.add(rocks);this.scatterMaterial=rockMat;
    // Mission hardware is fully 3D so nearby objects retain stereo depth.
    const white=this.material('#c6c2ad',{metalness:.3,roughness:.52}),metal=this.material('#5a5b52',{metalness:.6,roughness:.42}),rubber=this.material('#252722'),glass=this.material('#3e514e',{metalness:.65,roughness:.2});
    const base=this.entity(land,[-25,this.terrainHeight(-25,10),10]);this.stationBase=base;const shell=this.mesh(base,new T.CylinderGeometry(1.65,1.65,5.2,40),white,[0,1.8,0],true);shell.object3D.rotation.z=Math.PI/2;
    for(const x of[-2.3,-1.2,1.2,2.3]){const ring=this.mesh(base,new T.TorusGeometry(1.67,.035,6,40),metal,[x,1.8,0],true);ring.object3D.rotation.y=Math.PI/2;}
    this.mesh(base,new T.BoxGeometry(1.1,1.8,.13),glass,[0,1.08,1.6],true);this.mesh(base,new T.BoxGeometry(1.6,.15,1.1),metal,[0,.15,2],true);this.label(base,'ARES  /  FIELD STATION',[0,2.65,1.47],2.6,.3,{size:44,color:'#23352e'});
    for(const x of[-1.8,1.8])this.mesh(base,new T.BoxGeometry(.22,.55,2.3),metal,[x,.2,0],true);
    this.detailStation(base);
    // Empty anchor retained for movement compatibility; no legacy rover geometry.
    this.roverPlaceholder=this.entity(land,[20,0,1]);this.roverPlaceholder.object3D.visible=false;this.fallbackWheels=[];
    this.contactShadow(land,[-25,this.terrainHeight(-25,10)+.007,10],5,3);
  }
  contactShadow(parent,pos,width,height) {
    if(!this.shadowTexture){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,2,32,32,32);g.addColorStop(0,'rgba(25,18,9,.4)');g.addColorStop(1,'rgba(25,18,9,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);this.shadowTexture=new this.T.CanvasTexture(c);this.textures.push(this.shadowTexture);}
    const m=new this.T.MeshBasicMaterial({map:this.shadowTexture,transparent:true,depthWrite:false,toneMapped:false});this.materials.push(m);const e=this.mesh(parent,new this.T.PlaneGeometry(width,height),m,pos);e.object3D.rotation.x=-Math.PI/2;
  }
  buildSky() {
    const T=this.T;
    const geometry=new T.SphereGeometry(600,48,24);this.geometries.push(geometry);
    const material=new T.ShaderMaterial({
      side:T.BackSide,depthWrite:false,depthTest:false,
      uniforms:{zenith:{value:new T.Color('#a58d7c')},horizon:{value:new T.Color('#dfb78d')},sunDirection:{value:new T.Vector3(-24,35,-18).normalize()},cloudTime:{value:0}},
      vertexShader:`varying vec3 skyDirection;
        void main(){skyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform vec3 zenith;uniform vec3 horizon;uniform vec3 sunDirection;uniform float cloudTime;varying vec3 skyDirection;
        float cloudHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float cloudNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(cloudHash(i),cloudHash(i+vec2(1,0)),f.x),mix(cloudHash(i+vec2(0,1)),cloudHash(i+vec2(1,1)),f.x),f.y);}
        float cloudField(vec2 p){return .57*cloudNoise(p)+.28*cloudNoise(p*2.03)+.15*cloudNoise(p*4.09);}

        void main(){
          vec3 d=normalize(skyDirection);float elevation=max(d.y,0.0);
          vec3 color=mix(horizon,zenith,pow(elevation,0.52));
          vec2 cloudUV=d.xz/(max(d.y,0.0)+.24)*vec2(2.0,9.0)+vec2(cloudTime*.003,0.0);
          float cloud=smoothstep(.54,.78,cloudField(cloudUV+cloudField(cloudUV*.4)*2.0));
          cloud*=smoothstep(.12,.36,d.y)*.25;
          color=mix(color,vec3(.83,.84,.82),cloud);
          float alignment=clamp(dot(d,sunDirection),-1.0,1.0);
          float halo=pow(max(alignment,0.0),160.0);
          color=mix(color,vec3(0.78,0.81,0.82),halo*0.28);
          float disk=smoothstep(cos(0.0042),cos(0.0030),alignment);
          color=mix(color,vec3(3.5,3.3,2.9),disk);
          gl_FragColor=vec4(color,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });this.materials.push(material);
    this.sky=new T.Mesh(geometry,material);this.sky.frustumCulled=false;this.sky.renderOrder=-1000;this.scene.object3D.add(this.sky);
    // Real environment reflections give the rover's metallic materials proper illumination.
    try{const environment=new T.Scene();environment.add(new T.Mesh(geometry,material));const generator=new T.PMREMGenerator(this.scene.renderer);this.environmentTarget=generator.fromScene(environment,0,.1,900);this.scene.object3D.environment=this.environmentTarget.texture;generator.dispose();}catch(error){console.warn('Environment reflection fallback',error);}
  }
  async loadSurfaceAssets() {
    const T=this.T,loader=new T.TextureLoader();
    try {
      const [map,normal,arm]=await Promise.all(['ground-color.jpg','ground-normal.jpg','ground-arm.jpg'].map(name=>loader.loadAsync('assets/'+name)));
      map.colorSpace=T.SRGBColorSpace;
      for(const texture of[map,normal,arm]){texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(90,90);texture.anisotropy=Math.min(4,this.scene.renderer.capabilities.getMaxAnisotropy());this.textures.push(texture);}
      // Uniform dry-soil roughness avoids reintroducing the original tiled pattern through AO.
      // The original ARM texture still supplies the separate rock materials below.
      Object.assign(this.groundMaterial,{map,normalMap:normal,roughnessMap:null,aoMap:null,roughness:.96});
      this.groundMaterial.color.set('#d2ac8c');this.groundMaterial.normalScale.set(.7,.7);this.groundMaterial.needsUpdate=true;
      const rockColor=map.clone(),rockNormal=normal.clone(),rockRough=arm.clone();
      for(const t of[rockColor,rockNormal,rockRough]){t.repeat.set(1,1);this.textures.push(t);}
      for(const m of[this.scatterMaterial,...this.rockEls.map(e=>e.getObject3D('mesh').material)]){m.map=rockColor;m.normalMap=rockNormal;m.normalScale.set(.4,.4);m.roughnessMap=rockRough;m.needsUpdate=true;}
    }catch(error){console.warn('Terrain textures unavailable',error);this.notice('Some surface textures did not load. The expedition still works; reload to retry.');}
  }
  loadRover() {
    const entity=this.entity($('#land'),[20,0,1]);this.roverEntity=entity;entity.object3D.visible=false;entity.object3D.rotation.y=Math.PI;
    this.listen(entity,'model-loaded',event=>{
      const model=event.detail.model,box=new this.T.Box3().setFromObject(model);
      model.position.y-=box.min.y-entity.object3D.getWorldPosition(new this.T.Vector3()).y;
      model.traverse(object=>{if(!object.isMesh)return;object.castShadow=true;object.receiveShadow=true;const materials=Array.isArray(object.material)?object.material:[object.material];for(const m of materials){m.envMapIntensity=.85;this.materials.push(m);}this.geometries.push(object.geometry);});
      this.roverPlaceholder.object3D.visible=false;this.nasaRover=entity;this.setupRoverWheels(model);entity.object3D.visible=true;
    });
    this.listen(entity,'model-error',()=>this.notice('The rover model could not load. Reload to try again.'));
    entity.setAttribute('gltf-model','url(assets/perseverance.glb)');
  }
  buildStations() {
    const T=this.T;this.groups=this.anchors.map((p)=>this.entity($('#stations'),p));
    const metal=this.material('#706d60',{metalness:.6,roughness:.4}),light=this.material('#c1beb0',{roughness:.6});
    let g=this.groups[0];this.label(g,'WELCOME TO MARS',[0,2.45,-4.8],3.8,.48,{size:55});this.label(g,'Your expedition starts here',[0,1.99,-4.8],3.2,.3,{size:36});this.button(g,'Visit the rock field  →',[0,1.22,-4],'visit:1',3.2,0);
    g=this.groups[1];this.label(g,'01  /  ROCK DETECTIVE',[0,2.8,-4.3],3.5,.4,{size:46});this.label(g,'Choose each specimen to inspect and collect it',[0,2.35,-4.3],4,.33,{size:37});this.rockEls=[];this.rockTargets=[];this.sampleLabels=[];
    const rockNames=['BASALT','LAYERED ROCK','IRON-RICH ROCK'],colors=['#62594e','#b09b7d','#99714f'];
    MarsCore.SAMPLE_KEYS.forEach((key,i)=>{
      const x=(i-1)*1.2;this.mesh(g,new T.CylinderGeometry(.42,.46,.6,24),metal,[x,.3,-2.8],true);this.mesh(g,new T.CylinderGeometry(.43,.43,.035,24),light,[x,.617,-2.8]);
      const geo=this.sampleGeometry(i);geo.scale(.46,.46,.46);const rock=this.mesh(g,geo,this.material(colors[i],{map:this.rockMap,vertexColors:true}),[x,.86,-2.8],true);rock.object3D.rotation.set(.1,i*.9,.15);
      this.rockTargets.push(this.target(rock,'sample:'+key,1));this.rockEls.push(rock);this.sampleLabels.push(this.label(g,rockNames[i],[x,.42,-2.32],1.08,.23,{size:50}));this.contactShadow(g,[x,.638,-2.8],.65,.65);
    });
    g=this.groups[2];
    this.label(g,'02 / GRAVITY LAB',[0,4.05,-4.6],3.8,.4,{size:46});this.balls=[];
    [-.78,.78].forEach((x,i)=>{
      this.mesh(g,new T.CylinderGeometry(.42,.42,.05,24),metal,[x,.025,-3.8],true);
      this.mesh(g,new T.CylinderGeometry(.014,.014,3.05,8),light,[x+.44,1.525,-3.94]);
      this.balls.push(this.mesh(g,new T.SphereGeometry(.16,24,16),this.material(i?'#cb8d54':'#95b9c9',{metalness:.55,roughness:.22}),[x,3.16,-3.8],true));
      this.label(g,i?'MARS':'EARTH',[x,.15,-4.35],1.1,.20,{size:44});
    });
    // All explanatory text and controls are outside the two falling-ball columns.
    const consoleX=2.4,consoleZ=-3.8;
    this.label(g,'EXPERIMENT CONTROL',[consoleX,2.65,consoleZ],1.85,.32,{background:'#253024',size:45});
    this.label(g,'3 m drop · vacuum model',[consoleX,2.22,consoleZ],1.85,.42,{background:'#253024',size:40});
    this.dropButton=this.button(g,'Release both balls',[consoleX,1.7,consoleZ],'drop',1.85,2);
    this.timer=this.label(g,'Predict which ball lands first',[consoleX,1.1,consoleZ],1.85,.55,{background:'#253024',size:38});
    this.label(g,'Earth 9.81 m/s² · Mars 3.71 m/s²',[consoleX,.5,consoleZ],1.85,.4,{size:38});
    g=this.groups[3];this.label(g,'03  /  MARS CHALLENGE',[0,2.9,-4],4,.42,{size:45});this.questionLabel=this.label(g,'',[0,2.28,-3.6],3.7,.6,{background:'#273024',size:43});
    this.answerEls=[0,1,2].map(i=>this.button(g,'',[0,1.56-i*.47,-3],'answer:'+i,3.25,3));
    this.quizLabel=this.label(g,'',[0,.20,-3],3.5,.24,{size:40});
  }
  buildVRPanel() {
    this.vrPanel=$('#vr-ui');const g=this.vrPanel;
    this.label(g,'EXPEDITION',[0,1.03,0],1.65,.25,{background:'#20291e',color:'#cedcbe',size:47});
    ['Base camp','Rock field','Gravity lab','Challenge'].forEach((name,i)=>this.button(g,name,[0,.67-i*.45,0],'visit:'+i,1.65,null,true));
    this.button(g,'Rover survey',[1.9,.67,0],'visit:4',1.65,null,true);this.button(g,'Stop mission / walk',[1.9,.22,0],'rover-exit',1.65,null,true);
    this.button(g,'Replay guide',[-.45,-1.17,0],'replay',.8,null,true);this.mute3d=this.button(g,'Sound on',[.45,-1.17,0],'mute',.8,null,true);
    this.reset3d=this.button(g,'Restart expedition',[0,-1.63,0],'vr-reset',1.65,null,true);
    // Comfort updates these captions from the tracked head pose each frame.
    this.vrCaptionRoot=this.entity(this.scene);this.caption3d=this.label(this.vrCaptionRoot,'',[0,0,0],3.25,.48,{background:'#20281e',size:34});
    this.progress3d=this.label(this.vrCaptionRoot,'',[0,.42,0],2.8,.25,{background:'#20281e',size:40});
    this.vrPanel.object3D.visible=false;this.vrCaptionRoot.object3D.visible=false;
  }
  bind() {
    this.listen($('#station-nav'),'click',event=>{const button=event.target.closest('[data-station]');if(button)this.dispatch('visit:'+button.dataset.station);});
    this.listen($('#task-actions'),'click',event=>{const button=event.target.closest('[data-action]');if(button&&!button.disabled)this.dispatch(button.dataset.action);});
    this.listen($('#voice'),'click',()=>{if(this.audio.playing||this.audio.pending)this.audio.stop();else this.say(this.lastVoice,true);});
    this.listen($('#replay'),'click',()=>this.dispatch('replay'));this.listen($('#mute'),'click',()=>this.dispatch('mute'));
    this.listen($('#restart'),'click',()=>$('#reset-dialog').showModal());
    this.listen($('#reset-dialog'),'close',()=>{if($('#reset-dialog').returnValue==='reset')this.reset();});
    this.listen($('#help'),'click',()=>$('#help-dialog').showModal());
    this.listen($('#recenter'),'click',()=>this.recenter());
    this.listen($('#hide-ui'),'click',()=>{document.body.classList.add('clear-view');$('#restore-ui').hidden=false;});
    this.listen($('#restore-ui'),'click',()=>{document.body.classList.remove('clear-view');$('#restore-ui').hidden=true;});
    this.listen($('#vr'),'click',async()=>{
      if(!this.xrSupported){$('#help-dialog').showModal();return;}
      if(this.enteringVR)return;this.enteringVR=true;$('#vr').disabled=true;
      this.audio.unlock();
      try {await this.scene.enterVR();}
      catch(e){this.notice('VR could not start. Open the page directly in Meta Quest Browser and allow immersive VR access.');}
      finally{this.enteringVR=false;$('#vr').disabled=false;}
    });
    this.listen(this.scene,'enter-vr',()=>{this.inVR=true;document.body.classList.add('immersive');this.refreshTargets();this.positionVRPanel();this.setVRMenu(false);this.setVRCaptions(false);this.sun.shadow.mapSize.set(1024,1024);});
    this.listen(this.scene,'exit-vr',()=>{this.inVR=false;document.body.classList.remove('immersive');this.vrPanel.object3D.visible=false;this.vrCaptionRoot.object3D.visible=false;this.rig.object3D.rotation.set(0,0,0);this.recenter();this.refreshTargets();this.checkVR();});
    this.listen($('#right-hand'),'thumbstickmoved',event=>{
      if(!this.inVR)return;const x=event.detail.x;if(Math.abs(x)<.35){this.turnReady=true;return;}if(!this.turnReady||Math.abs(x)<.72)return;
      this.turnReady=false;const headPos=new this.T.Vector3();this.head.object3D.getWorldPosition(headPos);
      this.rig.object3D.position.sub(headPos).applyAxisAngle(new this.T.Vector3(0,1,0),-Math.sign(x)*Math.PI/6).add(headPos);this.rig.object3D.rotation.y-=Math.sign(x)*Math.PI/6;
    });
    this.listen(window,'keydown',event=>{
      if(event.ctrlKey||event.altKey||event.metaKey||event.repeat||event.target.matches('input,textarea,select')||$('dialog[open]'))return;
      if(/^[1-4]$/.test(event.key)){event.preventDefault();this.dispatch('visit:'+(Number(event.key)-1));}
      if(event.key.toLowerCase()==='r')this.dispatch('replay');
      if(event.key==='Escape'&&document.body.classList.contains('clear-view'))$('#restore-ui').click();
    });
    const canvas=this.scene.canvas;
    this.listen(canvas,'pointerdown',event=>{if(event.button!==0||this.inVR)return;this.pointer={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};});
    this.listen(canvas,'pointermove',event=>{
      if(this.pointer?.id===event.pointerId&&Math.hypot(event.clientX-this.pointer.x,event.clientY-this.pointer.y)>7)this.pointer.moved=true;
    });
    this.listen(canvas,'pointerup',event=>{
      const p=this.pointer;this.pointer=null;if(!p||p.id!==event.pointerId||p.moved||this.inVR)return;
      const target=this.pick(event.clientX,event.clientY);if(target)this.dispatch(target.action);
    });
    this.listen(canvas,'pointercancel',()=>this.pointer=null);
    this.listen(document,'visibilitychange',()=>{this.lastTick=null;if(document.hidden)this.audio.stop();});
    this.listen(window,'pagehide',()=>this.audio.stop());
  }
  pick(clientX,clientY) {
    const rect=this.scene.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return null;
    this.mouseRay ||= new this.T.Raycaster();this.mouseRay.setFromCamera(new this.T.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),this.scene.camera);
    const valid=this.targets.filter(t=>t.e.classList.contains('target'));const hits=this.mouseRay.intersectObjects(valid.map(t=>t.e.getObject3D('mesh')),true);
    if(!hits.length)return null;return valid.find(t=>t.e.getObject3D('mesh')===hits[0].object)||null;
  }
  async checkVR() {
    this.xrSupported=false;
    try{this.xrSupported=!!navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr');}catch(_){}
    $('#vr').disabled=false;$('#vr').textContent=this.xrSupported?'Enter VR ↗':'Play on Quest ↗';
    $('#vr').setAttribute('aria-label',this.xrSupported?'Enter immersive virtual reality':'How to open this experience on Meta Quest');
  }
  dispatch(action) {
    if(!this.ready)return;
    const now=performance.now();if(action===this.currentAction&&now-this.lastActionTime<250)return;this.currentAction=action;this.lastActionTime=now;
    const [type,value]=action.split(':');
    if(type==='journey'){this.journeyAction(value);return;}
    if(this.journey&&this.journey.phase!=='mars'&&!['effects','mute'].includes(type))return;
    if(type==='dust'){this.setDustMode(value);return;}
    if(type==='visit'){this.audio.unlock();this.visit(Number(value));return;}
    if(type==='replay'){this.say(this.lastVoice,true);return;}
    if(type==='mute'){this.audio.mute(!this.audio.muted);this.refresh();return;}
    if(type==='vr-reset'){
      if(this.resetArmedUntil&&now<this.resetArmedUntil){this.reset();this.resetArmedUntil=0;this.reset3d.change('Restart expedition');}
      else{this.resetArmedUntil=now+4500;this.reset3d.change('Press again to restart');}return;
    }
    if(type==='sample'){this.startSampleScan(value);return;}
    if(['drop','answer'].includes(type)&&(this.zones.active!==this.state.station||!this.insideActiveZone()))return;
    if(type==='effects'){this.effectsToggle();return;}
    if(type==='rover-exit'){this.stopMission();return;}
    if(type==='drop'){
      if(!this.state.startDrop())return;
      this.audio.unlock();this.audio.stop();this.setCaption('Watch both balls. They start from the same height, but experience different gravity.');this.refresh();this.updateBalls(0);return;
    }
    if(type==='answer'){
      if(now<this.quizLockedUntil)return;
      const result=this.state.answer(Number(value));if(result==='ignored')return;
      this.quizLockedUntil=now+700;this.refresh();
      if(result==='wrong'){$('#feedback').textContent='Not quite. Try another answer.';this.quizLabel.change('Not quite. Try another answer.');this.say('wrong');}
      else{$('#feedback').textContent=result==='finished'?'All three answers correct.':'Correct — next question.';this.say(this.state.complete?'complete':result==='finished'?'finish':'correct');}
    }
  }
  visit(index,narrate=true) {
    if(this.journey&&this.journey.phase!=='mars')return;
    if(!Number.isInteger(index)||index<0||index>5)return;
    this.stopMission(false);this.destination=index;
    const a=this.anchors[index];this.teleportTo(a[0],a[2]+(index?4:0));
    this.positionVRPanel();this.refresh();
    if(narrate){this.audio.stop();this.setCaption(index?'Walk into the glowing circle to start '+(MarsCore.ZONES.find(z=>z.id===index)?.name||'the mission')+'.':'Explore the field. Walk into a mission circle to begin.');}
  }
  recenter() {
    const look=this.head.components['look-controls'];if(!this.inVR){this.rig.object3D.rotation.y=0;if(look){look.pitchObject.rotation.x=0;look.yawObject.rotation.y=0;}this.head.object3D.rotation.set(0,0,0);}
  }
  positionStationVRPanel(){
    const a=this.anchors[this.zones?.active||this.destination||0];this.vrPanel.object3D.position.set(a[0]-2.75,1.95,a[2]-2.9);this.vrPanel.object3D.rotation.y=.45;
    if(this.state.station===2){this.vrCaptionRoot.object3D.position.set(a[0]+4.15,1.0,a[2]-3.75);this.vrCaptionRoot.object3D.rotation.set(0,-.60,0);}else{this.vrCaptionRoot.object3D.position.set(a[0],.48,a[2]-2.05);this.vrCaptionRoot.object3D.rotation.set(0,0,0);}
  }
  refreshTargets() {
    for(const t of this.targets){
      let active=t.enabled&&(!t.vrOnly||this.inVR)&&(t.station===null||(t.station===this.state.station&&(t.station===0||this.zones.active===t.station)));
      if(t.action.startsWith('answer:')&&this.state.question===3)active=false;
      if(t.action==='drop'&&this.state.elapsed!==null)active=false;
      if(t.action.startsWith('dust:')&&this.zones.active!==5)active=false;
      for(let o=t.e.object3D;o;o=o.parent)if(!o.visible)active=false;
      t.e.classList.toggle('target',active);
    }
    for(const hand of[$('#left-hand'),$('#right-hand')])hand.components.raycaster?.refreshObjects();
  }
  refresh() {
    const s=this.state;this.groups.forEach((g,i)=>g.object3D.visible=i!==0);
    document.querySelectorAll('[data-station]').forEach(button=>{if(Number(button.dataset.station)===s.station)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
    document.body.classList.toggle('gravity-station',s.station===2);document.body.classList.toggle('experiment-running',s.elapsed!==null);$('#location').textContent=this.names[s.station];$('#location-note').textContent=['A new perspective on the Red Planet.','Small specimens. A planet’s history.','Same experiment. Different worlds.','Bring your discoveries together.'][s.station];
    $('#count').textContent=s.score+' / 3 complete';$('#progress').style.width=s.score/3*100+'%';$('.progress').setAttribute('aria-valuenow',s.score);$('#sample-count').textContent=s.samples.size+' / 3 samples';
    this.progress3d.change('MISSIONS '+s.score+' / 3'+(s.complete?'  •  COMPLETE':''));
    $('#mute').textContent=this.audio.muted?'Sound off':'Sound on';$('#mute').setAttribute('aria-pressed',String(this.audio.muted));this.mute3d.change(this.audio.muted?'Sound off':'Sound on');
    $('#feedback').textContent='';const actions=$('#task-actions');actions.replaceChildren();
    const add=(text,action,options={})=>{const button=document.createElement('button');button.type='button';button.dataset.action=action;button.textContent=text;if(options.primary)button.classList.add('primary');if(options.chosen)button.classList.add('chosen');button.disabled=!!options.disabled;actions.appendChild(button);return button;};
    const title=$('#task-title'),desc=$('#task-description');$('#mission-label').textContent=s.complete?'EXPEDITION COMPLETE':'MISSION '+String(s.station).padStart(2,'0');
    if(s.station===0){title.textContent=s.complete?'You’re a Mars explorer.':'Make your first discovery.';desc.textContent=s.complete?'All three missions are complete. Revisit a station, or restart for the next explorer.':'Explore the rock field, compare gravity, then test what you discovered.';add('Explore the rock field →','visit:1',{primary:true});add('Run the gravity experiment','visit:2');}
    if(s.station===1){title.textContent=s.samples.size===3?'Collection complete.':'Read the rocks.';desc.textContent='Click a specimen in the scene or choose one below. Each different sample counts once.';['Volcanic basalt','Layered sedimentary rock','Iron-rich rock'].forEach((name,i)=>{const key=MarsCore.SAMPLE_KEYS[i];add((s.samples.has(key)?'✓ ':'')+name,'sample:'+key,{chosen:s.samples.has(key)});});if(s.samples.size===3)add('Continue to gravity lab →','visit:2',{primary:true});}
    if(s.station===2){title.textContent='Which ball lands first?';desc.textContent='Two balls. A 3 m drop. No air resistance. Compare Earth’s gravity with Mars’ gravity.';add(s.elapsed!==null?'Experiment running…':'Release both balls','drop',{primary:true,disabled:s.elapsed!==null});if(s.gravityDone){$('#feedback').textContent='Earth: 0.78 s  ·  Mars: 1.27 s';add('Take the Mars challenge →','visit:3');}}
    if(s.station===3){
      if(s.question===3){title.textContent=s.complete?'Expedition complete!':'Challenge complete.';desc.textContent=s.complete?'You collected three samples, ran the experiment and answered every question. Well done.':'All three answers are correct. Finish the other missions to complete your expedition.';add(s.samples.size<3?'Visit the rock field':'Revisit gravity lab','visit:'+(s.samples.size<3?1:2),{primary:true});}
      else{title.textContent=MarsCore.QUESTIONS[s.question].text;desc.textContent='Question '+(s.question+1)+' of 3. Use the clues from your expedition.';MarsCore.QUESTIONS[s.question].choices.forEach((text,i)=>add(text,'answer:'+i));}
    }
    this.questionLabel.change(s.question===3?'All three answers correct!':MarsCore.QUESTIONS[s.question].text);
    this.answerEls.forEach((e,i)=>{e.object3D.visible=s.question<3;if(s.question<3)e.change(MarsCore.QUESTIONS[s.question].choices[i]);});
    this.quizLabel.change(s.question===3?'Challenge complete':'Question '+(s.question+1)+' / 3');
    this.dropButton.change(s.elapsed!==null?'Watching the drop…':'Release both balls');
    if(s.elapsed===null)this.timer.change(s.gravityDone?'Earth: 0.78 s  |  Mars: 1.27 s':'Predict which ball lands first');
    this.rockEls.forEach((e,i)=>{this.sampleLabels[i].change((s.samples.has(MarsCore.SAMPLE_KEYS[i])?'✓ ':'')+['BASALT','LAYERED ROCK','IRON-RICH ROCK'][i]);e.getObject3D('mesh').material.emissive.setHex(s.samples.has(MarsCore.SAMPLE_KEYS[i])?0x38502a:0);e.getObject3D('mesh').material.emissiveIntensity=s.samples.has(MarsCore.SAMPLE_KEYS[i])?.12:0;});
    this.refreshExploration();this.refreshTargets();
  }
  setCaption(text) {
    $('#caption').textContent=text;
    const sentences=text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[text];this.captionPages=[];
    for(const sentence of sentences){const trimmed=sentence.trim();if(!trimmed)continue;if(trimmed.length<=150)this.captionPages.push(trimmed);else this.captionPages.push(...MarsCore.wrapText(trimmed,s=>s.length,140));}
    this.captionPage=0;this.captionClock=0;this.caption3d.change(this.captionPages[0]||text);
  }
  narrateText(text){const entry=Object.entries(window.MARS_LINES).find(([,line])=>line===text);if(entry)this.say(entry[0]);else this.setCaption(text);}
  say(key,restart=false){if(!window.MARS_LINES[key])return;this.lastVoice=key;this.setCaption(window.MARS_LINES[key]);this.audio.play(key,{restart});}
  updateBalls(time) {
    const t=time===null?0:time;this.balls.forEach((ball,i)=>ball.object3D.position.y=MarsCore.ballHeight(t,i?3.71:9.81));
  }
  tick(time,delta) {
    if(!this.ready||document.hidden)return;
    this.tickViewerText();
    if(this.lastTick===null){this.lastTick=time;return;}this.lastTick=time;
    if(this.tickJourney(Math.min(delta/1000,.1),time))return;
    this.tickExploration(Math.min(delta/1000,.05),time);this.tickSoundMap(Math.min(delta/1000,.05),time);this.tickComfort(Math.min(delta/1000,.05),time);
    if(this.state.elapsed!==null){
      const ended=this.state.step(delta/1000);this.updateBalls(ended?2:this.state.elapsed);
      if(ended){this.refresh();this.say(this.state.complete?'complete':'dropped');}
      else this.timer.change(this.state.elapsed.toFixed(2)+' s  /  observe both balls');
    }
    if(this.captionPages.length>1){this.captionClock+=delta/1000;const current=this.captionPages[this.captionPage];if(this.captionClock>Math.max(3,current.length/20)){this.captionClock=0;this.captionPage=Math.min(this.captionPage+1,this.captionPages.length-1);this.caption3d.change(this.captionPages[this.captionPage]);}}
    if(this.resetArmedUntil&&performance.now()>this.resetArmedUntil){this.resetArmedUntil=0;this.reset3d.change('Restart expedition');}
  }
  reset(){this.audio.stop();this.zones.stop();this.scan=null;this.keys?.clear();this.roverSpeed=0;this.disarmedZone=null;this.roverPoint=0;this.roverSurveyDone=false;this.roverPosition={x:20,z:1};this.roverHeading=Math.PI;this.driveRover(0,0,0);this.state.reset();this.quizLockedUntil=0;this.currentAction='';this.visit(0);}
  notice(message){$('#notice').textContent=message;$('#notice').hidden=false;clearTimeout(this.noticeTimer);this.noticeTimer=setTimeout(()=>$('#notice').hidden=true,7000);}
  dispose(){this.ready=false;if(this.flightSound){this.flightSound.source.stop();this.flightSound.source.disconnect();this.flightSound.gain.disconnect();}this.soundscape?.dispose();this.audio.dispose();this.cleanups.forEach(fn=>fn());clearTimeout(this.noticeTimer);this.materials.forEach(m=>m.dispose());this.geometries.forEach(g=>g.dispose());this.textures.forEach(t=>t.dispose());this.environmentTarget?.dispose();}
}

window.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{if(!expedition?.ready){$('#load-status').textContent='Loading is taking longer than expected. Check your connection or reload.';$('#reload').hidden=false;}},20000);
});
