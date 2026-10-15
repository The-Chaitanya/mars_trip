(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JourneyCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const FLIGHT=[{name:'boarding',duration:4},{name:'countdown',duration:5},{name:'launch',duration:12},{name:'orbit',duration:6},{name:'cruise',duration:10},{name:'entry',duration:7},{name:'landing',duration:9},{name:'touchdown',duration:3}];
  class Journey{
    constructor(){this.phase='choice';this.elapsed=0;this.lesson=0;}
    choose(option){if(!['choice','tutorial','earth'].includes(this.phase))return false;if(option==='tutorial'){this.phase='tutorial';this.lesson=0;}else if(option==='launch')this.phase='earth';else if(option==='skip')this.phase='mars';else return false;this.elapsed=0;return true;}
    nextLesson(){if(this.phase!=='tutorial')return false;this.lesson++;if(this.lesson>=4)this.phase='earth';return true;}
    board(x,z){if(this.phase!=='earth'||Math.abs(x)>.82||z<-.8||z>1.65)return false;this.phase='boarding';this.elapsed=0;return true;}
    step(dt){const phase=FLIGHT.find(f=>f.name===this.phase);if(!phase||!Number.isFinite(dt)||dt<0)return false;this.elapsed+=dt;if(this.elapsed>=phase.duration){const index=FLIGHT.indexOf(phase);this.phase=index===FLIGHT.length-1?'mars':FLIGHT[index+1].name;this.elapsed=0;return true;}return false;}
    skip(){this.phase='mars';this.elapsed=0;}
    get flying(){return FLIGHT.some(f=>f.name===this.phase);}
    get progress(){const f=FLIGHT.find(f=>f.name===this.phase);return f?Math.min(1,this.elapsed/f.duration):0;}
  }
  function smooth(a,b,x){const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*t*(t*(t*6-15)+10);}
  function flightPose(phase,u){
    u=Math.max(0,Math.min(1,u));const e=smooth(0,1,u);
    const pose={earth:[-12,-15,-60,1],mars:[30,-4,-145,.7],space:0,veil:0,groundY:0,ground:'earth',stars:0};
    if(phase==='launch'){
      pose.groundY=-90*u*u;pose.space=smooth(.18,.85,u);
      pose.veil=smooth(.25,.47,u)*(1-smooth(.60,.80,u));pose.ground=u<.53?'earth':'none';
      pose.earth=[-8-4*e,-28+13*e,-38-22*e,1.8-.5*e];pose.stars=smooth(.72,1,u);
    }
    if(phase==='orbit'){
      pose.ground='none';pose.space=1;pose.stars=1;
      pose.earth=[-12-6*e,-15+5*e,-60-10*e,1.3-.3*e];
    }
    if(phase==='cruise'){
      pose.ground='none';pose.space=1;pose.stars=1;
      pose.earth=[-18-64*e,-10-13*e,-70-35*e,1-.8*e];
      pose.mars=[30-26*e,-4-8*e,-145+95*e,.7+.6*e];
    }
    if(['entry','landing','touchdown'].includes(phase)){
      pose.earth=[-82,-23,-105,.2];pose.mars=[0,-40,-60,3.2];pose.ground='mars';
      if(phase==='entry'){
        pose.mars=[4*(1-e),-12-28*e,-50-10*e,1.3+1.9*e];
        pose.space=1-smooth(.25,.92,u);pose.stars=1-smooth(.05,.45,u);
        pose.veil=smooth(.45,.92,u);pose.ground='none';pose.groundY=-12;
      }
      if(phase==='landing'){pose.veil=1-smooth(0,.30,u);pose.groundY=-12*(1-e);}
    }
    return pose;
  }
  return{Journey,FLIGHT,flightPose};
});
