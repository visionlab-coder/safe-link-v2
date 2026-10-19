const assert=require('node:assert/strict');
const load=require('./helpers/load-typescript.cjs')({'./free-talk-client':{ensureFreeTalkSession:async()=>{}}});
global.Audio=class {
  play(){ if(this.onended) setTimeout(()=>this.onended?.(),5); return Promise.resolve(); }
  pause(){}
};
const {FreeTalkAudio}=load('src/utils/free-talk-audio.ts');
(async()=>{
  const requests=[];
  global.fetch=async(url,options)=>{assert.equal(url,'/api/free-talk/tts');assert.equal(options.method,'POST'); requests.push(JSON.parse(options.body)); return new Response('audio',{headers:{'Content-Type':'audio/mpeg'}});};
  const speaker=new FreeTalkAudio();
  let idle=0,failed=0;
  const done=new Promise(resolve=>{
    const onIdle=()=>{idle++;resolve();};
    speaker.speak('one','en','female',onIdle,()=>failed++);
    speaker.speak('two','ko','male',onIdle,()=>failed++);
  });
  await done;
  assert.deepEqual(requests.map(r=>r.text),['one','two']); assert.equal(idle,1); assert.equal(failed,0);
  global.fetch=async()=>new Response('',{status:503});
  await new Promise(resolve=>speaker.speak('failure','en','female',resolve,()=>failed++));
  assert.equal(failed,1,'Failure still releases microphone via onIdle');
  let cancelledIdle=false;
  global.fetch=async(_url,options)=>new Promise((_resolve,reject)=> options.signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true}));
  speaker.speak('cancel','en','female',()=>cancelledIdle=true,()=>failed++);
  await new Promise(r=>setTimeout(r,5)); speaker.cancel();
  await new Promise(r=>setTimeout(r,5));
  assert.equal(cancelledIdle,false); assert.equal(failed,1);
  console.log('Free Talk audio: queued POST requests, single idle callback, failure recovery and cancellation passed. Audio playback mocked.');
})().catch(e=>{console.error(e);process.exitCode=1;});
