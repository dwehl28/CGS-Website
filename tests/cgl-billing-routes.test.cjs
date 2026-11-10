const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function compile(file, mocks) {
  const filename=path.resolve(__dirname,'..',file), loaded=new Module(filename,module);
  loaded.filename=filename; loaded.paths=module.paths;
  loaded.require=name=>Object.hasOwn(mocks,name)?mocks[name]:module.require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
  return loaded.exports;
}
class BillingError extends Error { constructor(message,status=503){super(message);this.status=status;} }
const memberId='11111111-1111-4111-8111-111111111111';
const checkoutId='22222222-2222-4222-8222-222222222222';
function harness(options={}) {
  const calls={rpc:[],checkout:[],sync:[],receipt:[],worker:[],after:[]};
  const platform={
    verifyCglOrigin(request){if(request.headers.get('origin')&&request.headers.get('origin')!=='https://example.test')throw new BillingError('Wrong origin',403);},
    async getCglMemberIdentity(request){if(request.headers.get('authorization')!=='Bearer member')throw new BillingError('Sign in',401);return{id:memberId,email:'own@example.invalid'};},
    cglApiFailure(error){return Response.json({error:error.message},{status:error.status??500});},
  };
  const square={
    CglSquareError:BillingError,
    getCglSquareReadiness:()=>({ready:options.ready!==false,configured:true}),
    async createCglSquareCheckout(...args){calls.checkout.push(args);return'https://sandbox.square.link/test';},
    async syncCglSquareMember(...args){calls.sync.push(args);return{status:'pending',checkouts:[{id:args[1],state:'pending'}]};},
    async receiveCglSquareWebhook(...args){calls.receipt.push(args);if(options.badSignature)throw new BillingError('Invalid signature',401);return{eventId:'event',queued:true};},
    async processQueuedCglSquareEvents(...args){calls.worker.push(args);return{processed:0};},
  };
  const mocks={
    '@/lib/cgl-platform':platform,'@/lib/cgl-square':square,
    '@/lib/supabase-admin':{getSupabaseAdmin:()=>({async rpc(...args){calls.rpc.push(args);return options.rpcFailure?{error:{message:'Changed price'}}:{data:{id:checkoutId,member_id:memberId,amount_cents:2995,recurring:true}};}})},
    'next/server':{after(fn){calls.after.push(fn);}},
  };
  return{calls,checkout:compile('app/api/cgl/checkout/route.ts',mocks),sync:compile('app/api/cgl/billing/sync/route.ts',mocks),webhook:compile('app/api/cgl/square-webhook/route.ts',mocks),recovery:compile('app/api/cgl/billing/reconcile/route.ts',mocks)};
}
function post(pathname,body,headers={}){return new Request('https://example.test'+pathname,{method:'POST',headers:{authorization:'Bearer member','content-type':'application/json',...headers},body:JSON.stringify(body)});}
const purchase={planCode:'monthly',requestKey:checkoutId,termsAccepted:true,acceptedAmountCents:2995};
test('checkout rejects unauthenticated, cross-origin and client-account overrides before provider or database changes',async()=>{
  for(const [body,headers,status] of [[purchase,{authorization:'Bearer legacy-admin'},401],[purchase,{origin:'https://other.test'},403],[{...purchase,memberId:'other'}, {},400]]){
    const h=harness(); assert.equal((await h.checkout.POST(post('/api/cgl/checkout',body,headers))).status,status);
    assert.equal(h.calls.rpc.length,0);assert.equal(h.calls.checkout.length,0);
  }
});
test('checkout binds the verified account and confirmed price to one atomic prepare request',async()=>{
  const h=harness();assert.equal((await h.checkout.POST(post('/api/cgl/checkout',purchase))).status,200);
  assert.deepEqual(h.calls.rpc[0],['cgl_prepare_square_checkout',{p_member_id:memberId,p_plan_code:'monthly',p_season_id:null,p_request_key:checkoutId,p_accepted_amount_cents:2995}]);
  assert.equal(h.calls.checkout.length,1);
  const changed=harness({rpcFailure:true});assert.equal((await changed.checkout.POST(post('/api/cgl/checkout',purchase))).status,409);assert.equal(changed.calls.checkout.length,0);
});
test('Sandbox checkout disabled flag, malformed JSON and actual body limits fail before preparation',async()=>{
  const off=harness({ready:false});assert.equal((await off.checkout.POST(post('/api/cgl/checkout',purchase))).status,503);assert.equal(off.calls.rpc.length,0);
  for(const text of ['{',JSON.stringify({...purchase,extra:'x'.repeat(5000)})]){
    const h=harness();const response=await h.checkout.POST(new Request('https://example.test/api/cgl/checkout',{method:'POST',headers:{authorization:'Bearer member'},body:text}));
    assert.ok([400,413].includes(response.status));assert.equal(h.calls.rpc.length,0);
  }
});
test('member payment refresh only forwards the authenticated member and validated own-checkout selector',async()=>{
  const h=harness();assert.equal((await h.sync.POST(post('/api/cgl/billing/sync',{checkoutId}))).status,200);assert.deepEqual(h.calls.sync,[[memberId,checkoutId]]);
  for(const value of [{checkoutId:'not-an-id'},{checkoutId,memberId:'other'}]){const rejected=harness();assert.equal((await rejected.sync.POST(post('/api/cgl/billing/sync',value))).status,400);assert.equal(rejected.calls.sync.length,0);}
});
test('webhook durably receives exact raw bytes before responding and defers provider work',async()=>{
  const h=harness();const raw='{ "event_id": "event" }';const response=await h.webhook.POST(new Request('https://example.test/api/cgl/square-webhook',{method:'POST',headers:{'x-square-hmacsha256-signature':'signature','square-environment':'sandbox'},body:raw}));
  assert.equal(response.status,200);assert.deepEqual(h.calls.receipt,[[raw,'signature','sandbox']]);assert.equal(h.calls.worker.length,0);assert.equal(h.calls.after.length,1);
  await h.calls.after[0]();assert.deepEqual(h.calls.worker,[[{eventId:'event',limit:1}]]);
  const invalid=harness({badSignature:true});assert.equal((await invalid.webhook.POST(post('/api/cgl/square-webhook',{}))).status,401);assert.equal(invalid.calls.after.length,0);
});
test('recovery job rejects missing or incorrect secrets before processing any queue',async()=>{
  const saved=process.env.CRON_SECRET;process.env.CRON_SECRET='test-recovery-secret-with-at-least-32-characters';
  try{for(const token of ['', 'wrong']){const h=harness();const response=await h.recovery.GET(new Request('https://example.test/api/cgl/billing/reconcile',{headers:{authorization:'Bearer '+token}}));assert.equal(response.status,403);assert.equal(h.calls.worker.length,0);}}
  finally{if(saved===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=saved;}
});
