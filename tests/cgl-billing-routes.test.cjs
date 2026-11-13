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
const termsVersion='cgl-membership-terms-2026-11-14';
function harness(options={}) {
  const calls={rpc:[],checkout:[],sync:[],receipt:[],worker:[],after:[]};
  const platform={
    verifyCglOrigin(request){if(request.headers.get('origin')&&request.headers.get('origin')!=='https://example.test')throw new BillingError('Wrong origin',403);},
    async getCglMemberIdentity(request){if(request.headers.get('authorization')!=='Bearer member')throw new BillingError('Sign in',401);return{id:memberId,email:'own@example.invalid'};},
    cglApiFailure(error){return Response.json({error:error.message},{status:error.status??500});},
  };
  const square={
    CglSquareError:BillingError,
    getCglSquareReadiness:()=>({ready:options.ready!==false,configured:true,environment:options.environment??'sandbox',oneOffActionsEnabled:options.ready!==false,subscriptionActionsEnabled:options.subscriptionActionsEnabled===true}),
    getCglSquareOperationalReadiness:async()=>({ready:options.ready!==false,configured:true,environment:options.environment??'sandbox',oneOffActionsEnabled:options.ready!==false,subscriptionActionsEnabled:options.subscriptionActionsEnabled===true}),
    async createCglSquareCheckout(...args){calls.checkout.push(args);return'https://sandbox.square.link/test';},
    async syncCglSquareMember(...args){calls.sync.push(args);return{status:'pending',checkouts:[{id:args[1],state:'pending'}]};},
    async receiveCglSquareWebhook(...args){calls.receipt.push(args);if(options.badSignature)throw new BillingError('Invalid signature',401);return options.testEvent?{eventId:'test-event',event_id:'test-event',test:true}:{eventId:'event',queued:true};},
    async processQueuedCglSquareEvents(...args){calls.worker.push(args);return{processed:0};},
  };
  const mocks={
    '@/lib/cgl-platform':platform,'@/lib/cgl-square':square,'@/lib/cgl-terms':{CGL_MEMBERSHIP_TERMS_VERSION:termsVersion},
    '@/lib/supabase-admin':{getSupabaseAdmin:()=>({async rpc(...args){calls.rpc.push(args);return options.rpcFailure?{error:{message:'Changed price'}}:{data:options.intent??{id:checkoutId,member_id:memberId,amount_cents:2995,recurring:true,environment:options.environment??'sandbox'}};}})},
    'next/server':{after(fn){calls.after.push(fn);}},
  };
  return{calls,checkout:compile('app/api/cgl/checkout/route.ts',mocks),sync:compile('app/api/cgl/billing/sync/route.ts',mocks),webhook:compile('app/api/cgl/square-webhook/route.ts',mocks),recovery:compile('app/api/cgl/billing/reconcile/route.ts',mocks)};
}
function post(pathname,body,headers={}){return new Request('https://example.test'+pathname,{method:'POST',headers:{authorization:'Bearer member','content-type':'application/json',...headers},body:JSON.stringify(body)});}
const purchase={planCode:'monthly',requestKey:checkoutId,termsAccepted:true,termsVersion,acceptedAmountCents:2995};
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
test('only the $100 season pass carries a season into checkout',async()=>{
  const seasonId='33333333-3333-4333-8333-333333333333';
  const ordinary=harness();
  assert.equal((await ordinary.checkout.POST(post('/api/cgl/checkout',{...purchase,seasonId}))).status,200);
  assert.equal(ordinary.calls.rpc[0][1].p_season_id,null);

  const missing=harness();
  const seasonPass={planCode:'casual_season',requestKey:checkoutId,termsAccepted:true,termsVersion,acceptedAmountCents:10000};
  assert.equal((await missing.checkout.POST(post('/api/cgl/checkout',seasonPass))).status,400);
  assert.equal(missing.calls.rpc.length,0);

  const selected=harness({intent:{id:checkoutId,member_id:memberId,amount_cents:10000,recurring:false,environment:'sandbox'}});
  assert.equal((await selected.checkout.POST(post('/api/cgl/checkout',{...seasonPass,seasonId}))).status,200);
  assert.equal(selected.calls.rpc[0][1].p_season_id,seasonId);
});
test('production checkout uses the live one-off RPC and keeps recurring plans locked',async()=>{
  const oneOff={planCode:'casual_registration',requestKey:checkoutId,termsAccepted:true,termsVersion,acceptedAmountCents:2900};
  const live=harness({environment:'production',intent:{id:checkoutId,member_id:memberId,amount_cents:2900,recurring:false,environment:'production'}});
  assert.equal((await live.checkout.POST(post('/api/cgl/checkout',oneOff))).status,200);
  assert.deepEqual(live.calls.rpc[0],['cgl_prepare_square_live_checkout',{p_member_id:memberId,p_plan_code:'casual_registration',p_season_id:null,p_request_key:checkoutId,p_accepted_amount_cents:2900}]);
  const recurring=harness({environment:'production'});
  assert.equal((await recurring.checkout.POST(post('/api/cgl/checkout',purchase))).status,409);
  assert.equal(recurring.calls.rpc.length,0);assert.equal(recurring.calls.checkout.length,0);
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
  const testEvent=harness({testEvent:true});assert.equal((await testEvent.webhook.POST(post('/api/cgl/square-webhook',{}))).status,200);assert.equal(testEvent.calls.after.length,0);assert.equal(testEvent.calls.worker.length,0);
  const invalid=harness({badSignature:true});assert.equal((await invalid.webhook.POST(post('/api/cgl/square-webhook',{}))).status,401);assert.equal(invalid.calls.after.length,0);
});
test('recovery job rejects missing or incorrect secrets before processing any queue',async()=>{
  const saved=process.env.CRON_SECRET;process.env.CRON_SECRET='test-recovery-secret-with-at-least-32-characters';
  try{for(const token of ['', 'wrong']){const h=harness();const response=await h.recovery.GET(new Request('https://example.test/api/cgl/billing/reconcile',{headers:{authorization:'Bearer '+token}}));assert.equal(response.status,403);assert.equal(h.calls.worker.length,0);}}
  finally{if(saved===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=saved;}
});
test('member and admin production billing views exclude Sandbox and unrelated manual records',async()=>{
  const environmentRecord=(record,environment)=>record.environment===environment||record.metadata?.environment===environment||String(record.external_id??'').startsWith(`square:${environment}:`);
  const sandbox={id:'sandbox',member_id:memberId,environment:'sandbox',metadata:{environment:'sandbox'}};
  const production={id:'production',member_id:memberId,environment:'production',metadata:{environment:'production'}};
  const manual={id:'manual'};
  const billing={memberships:[sandbox],payments:[sandbox],checkouts:[sandbox,production],events:[sandbox,production],invoices:[sandbox,production],seasonEntitlements:[sandbox,production]};
  const platform={
    cglApiFailure(error){return Response.json({error:error.message},{status:error.status??500});},
    async getCglAdminActor(){return{id:'admin',role:'super_admin'};},
    async getCglAdminSnapshot(){return{status:'ready',memberships:[production,manual],payments:[production,manual],billing};},
    async getCglMemberIdentity(){return{id:memberId};},
    async getCglMemberSnapshot(){return{status:'ready',memberships:[production,manual],payments:[production,manual],billing:{memberships:[sandbox],payments:[sandbox]}};},
    isCglSquareEnvironmentRecord:environmentRecord,
  };
  const square={getCglSquareOperationalReadiness:async()=>({environment:'production',livePaymentsEnabled:true,recurringEnabled:false,ready:true})};
  const records={cgl_square_checkout_intents:[sandbox,production],cgl_square_season_entitlements:[sandbox,production]};
  const database={getSupabaseAdmin:()=>({from(table){const filters=[];const builder={select(){return builder;},eq(key,value){filters.push([key,value]);return builder;},order(){return builder;},limit(){return builder;},then(resolve,reject){const data=(records[table]??[]).filter(row=>filters.every(([key,value])=>row[key]===value));return Promise.resolve({data,error:null}).then(resolve,reject);}};return builder;}})};
  const mocks={'@/lib/cgl-platform':platform,'@/lib/cgl-square':square,'@/lib/supabase-admin':database};
  const admin=compile('app/api/cgl/admin/route.ts',mocks);
  const member=compile('app/api/cgl/member/route.ts',mocks);
  const adminBody=await (await admin.GET(new Request('https://example.test/api/cgl/admin'))).json();
  const memberBody=await (await member.GET(new Request('https://example.test/api/cgl/member'))).json();
  for(const body of [adminBody,memberBody]){
    assert.deepEqual(body.billing.memberships.map(row=>row.id),['production']);
    assert.deepEqual(body.billing.payments.map(row=>row.id),['production']);
    assert.deepEqual(body.billing.checkouts.map(row=>row.id),['production']);
    assert.equal(JSON.stringify(body.billing).includes('sandbox'),false);
    assert.equal(JSON.stringify(body.billing).includes('manual'),false);
  }
});
