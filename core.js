/* Shared mission rules: DOM controls and VR rays use the same guarded transitions. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MarsCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const QUESTIONS = [
    { text: 'What gives Mars its reddish color?', choices: ['Iron minerals in dust', 'Red plants', 'Liquid lava everywhere'], correct: 0 },
    { text: 'Which ball takes longer to land?', choices: ['The Earth ball', 'The Mars ball', 'Both take the same time'], correct: 1 },
    { text: 'The atmosphere of Mars is mostly…', choices: ['Oxygen', 'Hydrogen', 'Carbon dioxide'], correct: 2 }
  ];
  const SAMPLE_KEYS = ['basalt', 'sediment', 'iron'];
  function ballHeight(t, g) { return .16 + Math.max(0, 3 - .5 * g * t * t); }
  class Mission {
    constructor() { this.reset(); }
    reset() { this.station = 0; this.samples = new Set(); this.gravityDone = false; this.question = 0; this.elapsed = null; }
    get done() { return [this.samples.size === 3, this.gravityDone, this.question === QUESTIONS.length]; }
    get score() { return this.done.filter(Boolean).length; }
    get complete() { return this.score === 3; }
    visit(station) {
      if (!Number.isInteger(station) || station < 0 || station > 3) return false;
      this.station = station; this.elapsed = null; return true;
    }
    collect(key) {
      if (this.station !== 1 || !SAMPLE_KEYS.includes(key) || this.samples.has(key)) return false;
      this.samples.add(key); return true;
    }
    startDrop() {
      if (this.station !== 2 || this.elapsed !== null) return false;
      this.elapsed = 0; return true;
    }
    step(seconds) {
      if (this.elapsed === null || !Number.isFinite(seconds) || seconds < 0) return false;
      this.elapsed += seconds;
      if (this.elapsed >= Math.sqrt(6 / 3.71)) { this.gravityDone = true; this.elapsed = null; return true; }
      return false;
    }
    answer(index) {
      if (this.station !== 3 || this.question >= QUESTIONS.length || !Number.isInteger(index) || index < 0 || index > 2) return 'ignored';
      if (index !== QUESTIONS[this.question].correct) return 'wrong';
      this.question++; return this.question === QUESTIONS.length ? 'finished' : 'correct';
    }
  }
  function wrapText(text, measure, width) {
    const lines = []; let line = '';
    for (const word of text.split(/\s+/)) {
      if (!word) continue;
      const next = line ? line + ' ' + word : word;
      if (line && measure(next) > width) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }
  const FIELD = {x:0,z:-12,radius:46};
  const ZONES = [
    {id:1,x:-12,z:-13,name:'Rock detective'},
    {id:2,x:12,z:-13,name:'Gravity lab'},
    {id:3,x:0,z:-29,name:'Mars challenge'},
    {id:4,x:20,z:5,name:'Rover survey'},
    {id:5,x:-18,z:-32,name:'Dust chamber'}
  ];
  function clampCircle(x,z,c,margin=0) {
    const dx=x-c.x,dz=z-c.z,d=Math.hypot(dx,dz),r=c.radius-margin;
    return d>r?{x:c.x+dx*r/d,z:c.z+dz*r/d,clamped:true}:{x,z,clamped:false};
  }
  class FieldZones {
    constructor(){this.active=null;}
    update(x,z){
      if(this.active!==null){const zone=ZONES.find(q=>q.id===this.active);
        if(Math.hypot(x-zone.x,z-(zone.z-1))>6.5){const id=this.active;this.active=null;return{type:'stop',id};}
        return null;
      }
      const zone=ZONES.find(q=>Math.hypot(x-q.x,z-(q.z+.6))<=1.35);
      if(zone){this.active=zone.id;return{type:'start',id:zone.id};}return null;
    }
    stop(){const id=this.active;this.active=null;return id;}
  }
  return { Mission, QUESTIONS, SAMPLE_KEYS, ballHeight, wrapText, FIELD, ZONES, FieldZones, clampCircle };
});
