(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DustScience=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  class Lab {
    constructor(){this.planet='mars';this.running=false;this.haze=false;this.coating=false;this.seen=new Set();}
    act(action){
      if(!['earth','mars','storm','clean','clear','settle'].includes(action))return false;
      if(action==='earth'||action==='mars'){this.planet=action;this.running=true;this.haze=false;this.coating=false;this.seen.add(action);}
      if(action==='storm'){this.planet='mars';this.running=true;this.haze=true;this.coating=true;this.seen.add('storm');}
      if(action==='clean'){if(this.haze&&this.coating)this.seen.add('clean');this.coating=false;}
      if(action==='clear'){if(this.haze&&!this.coating&&this.seen.has('clean'))this.seen.add('clear');this.haze=false;this.running=false;}
      if(action==='settle')this.running=false;
      return true;
    }
    get pressure(){return .5*(this.planet==='earth'?1.2:.02)*(this.running?20*20:0);}
    get power(){return Math.round(100*(this.haze?.35:1)*(this.coating?.5:1));}
    get complete(){return ['earth','mars','storm','clean','clear'].every(k=>this.seen.has(k));}
  }
  return {Lab};
});
