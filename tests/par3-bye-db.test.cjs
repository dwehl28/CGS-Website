const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const {BracketsManager}=require('brackets-manager');
const {InMemoryDatabase}=require('brackets-memory-db');
let db;
test.before(async()=>{
  db=new PGlite();
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create publication supabase_realtime;');
  for(const name of ['20260806170000_add_par3_showdown_tournament.sql','20261105083434_flexible_par3_tournament_format.sql','20261105094940_par3_pool_winners_ctp_bye.sql'])await db.exec(fs.readFileSync(path.resolve(__dirname,'../supabase/migrations',name),'utf8'));
});
test.after(async()=>db?.close());
async function event(sizes=[4,4,4,4,4],size=16,mode='pool_winners_ctp_bye'){
  const id=(await db.query("insert into cgs_par3_events(slug,title,summary,starts_at,warmup_at,venue_name,venue_address,registration_url,youtube_url,pool_count,pool_size,max_players)values($1,'Isolated bye test','Preserve this summary',now(),now(),'Fixture venue','','','',$2,$3,$4)returning id",[randomUUID(),sizes.length,Math.max(...sizes),sizes.reduce((a,b)=>a+b,0)])).rows[0].id;
  await db.query('select cgs_par3_update_format($1,$2,$3,$4)',[id,JSON.stringify(sizes),size,mode]);return id;
}
async function field(id,counts=[3,3,3,3,3],manual=true){
  const pools=[];let order=0;
  for(let pool=0;pool<counts.length;pool++){
    const ids=[];
    for(let rank=1;rank<=counts[pool];rank++)ids.push((await db.query("insert into cgs_par3_players(event_id,name,display_order,pool_number,pool_rank_override)values($1,'Isolated player',$2,$3,$4)returning id",[id,++order,pool+1,manual?rank:null])).rows[0].id);
    pools.push(ids);
  }
  return pools;
}
async function timestamp(id){return(await db.query('select updated_at::text value from cgs_par3_events where id=$1',[id])).rows[0].value;}
async function confirm(id,playerId){return db.query('select cgs_par3_set_ctp_qualifiers($1,$2,$3)',[id,JSON.stringify([Number(playerId)]),await timestamp(id)]);}
async function bracket(pools,winnerId,size=16){
  const storage=new InMemoryDatabase(),manager=new BracketsManager(storage),slots=[Number(winnerId),null,...pools.flat().map(Number).filter(id=>id!==Number(winnerId))],ids=[];
  for(const id of slots)ids.push(id===null?null:await storage.insert('participant',{name:`Isolated player ${id}`,tournament_id:0,par3PlayerId:id}));
  await manager.create.stage({tournamentId:0,name:'Isolated finals',type:'single_elimination',seedingIds:ids,settings:{size,seedOrdering:['natural'],balanceByes:false}});
  return manager.get.tournamentData(0);
}
async function create(id,data,expected){return db.query('select cgs_par3_create_finals($1,$2,$3)',[id,JSON.stringify(data),expected??await timestamp(id)]);}
function firstRound(data){return data.match.filter(m=>m.round_id===data.round.find(r=>r.number===1).id);}

test('mode-only update preserves capacity, open registrations, null legacy pool sizes and all fifteen scheduled fixtures',async()=>{
  const id=await event([4,4,4,4,4],16,'standard'),pools=await field(id,undefined,false),rows=[];
  for(let pool=0;pool<pools.length;pool++){let n=0;for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)rows.push({pool_number:pool+1,match_number:++n,player1_id:Number(pools[pool][i]),player2_id:Number(pools[pool][j])});}
  await db.query('select cgs_par3_sync_pool_fixtures($1,$2)',[id,JSON.stringify(rows)]);
  await db.query('update cgs_par3_pool_matches set bay_number=2 where event_id=$1',[id]);
  const before=(await db.query('select id,pool_number,match_number,player1_id,player2_id,status,bay_number from cgs_par3_pool_matches where event_id=$1 order by id',[id])).rows;
  await db.query('select cgs_par3_update_format($1,$2,16,$3)',[id,'[4,4,4,4,4]','pool_winners_ctp_bye']);
  assert.deepEqual((await db.query('select id,pool_number,match_number,player1_id,player2_id,status,bay_number from cgs_par3_pool_matches where event_id=$1 order by id',[id])).rows,before);
  assert.deepEqual((await db.query('select pool_sizes,max_players,registrations_open,summary,finals_format from cgs_par3_events where id=$1',[id])).rows[0],{pool_sizes:null,max_players:20,registrations_open:true,summary:'Preserve this summary',finals_format:'pool_winners_ctp_bye'});
});
test('mode can change after pool results without changing fixtures, while existing CTP confirmation must be cleared',async()=>{
  const id=await event([4,4,4,4,4],16,'standard'),pools=await field(id),first=pools[0];
  await db.query("insert into cgs_par3_pool_matches(event_id,pool_number,match_number,player1_id,player2_id,winner_id,status)values($1,1,1,$2,$3,$2,'complete')",[id,first[0],first[1]]);
  await db.query('select cgs_par3_update_format($1,$2,16,$3)',[id,'[4,4,4,4,4]','pool_winners_ctp_bye']);
  await confirm(id,first[0]);
  await assert.rejects(db.query('select cgs_par3_update_format($1,$2,16,$3)',[id,'[4,4,4,4,4]','standard']),/Clear CTP/);
  await db.query('select cgs_par3_set_ctp_qualifiers($1,$2,$3)',[id,'[]',await timestamp(id)]);
  await db.query('select cgs_par3_update_format($1,$2,16,$3)',[id,'[4,4,4,4,4]','standard']);
  assert.equal((await db.query('select winner_id from cgs_par3_pool_matches where event_id=$1',[id])).rows[0].winner_id,first[0]);
});
test('CTP selection requires one pool winner and completed or fully manually ranked pools',async()=>{
  const id=await event(),pools=await field(id,undefined,false);
  await assert.rejects(confirm(id,pools[0][0]),/Complete or manually seed/);
  for(const pool of pools)for(let i=0;i<pool.length;i++)await db.query('update cgs_par3_players set pool_rank_override=$1 where id=$2',[i+1,pool[i]]);
  await assert.rejects(confirm(id,pools[0][1]),/confirmed pool winner/);
  await assert.rejects(db.query('select cgs_par3_set_ctp_qualifiers($1,$2,$3)',[id,JSON.stringify([null,Number(pools[0][0])]),await timestamp(id)]),/exactly one/);
  await confirm(id,pools[2][0]);
  assert.deepEqual((await db.query('select id,ctp_rank from cgs_par3_players where event_id=$1 and ctp_rank is not null',[id])).rows,[{id:pools[2][0],ctp_rank:1}]);
});
test('SQL validates the genuine fifteen-player bye draw and automatically advanced CTP winner',async()=>{
  const id=await event(),pools=await field(id),winner=pools[3][0];await confirm(id,winner);
  const data=await bracket(pools,winner);await create(id,data);
  const saved=(await db.query('select knockout_data from cgs_par3_events where id=$1',[id])).rows[0].knockout_data;
  assert.equal(saved.participant.length,15);assert.equal(firstRound(saved).filter(m=>m.opponent1&&m.opponent2).length,7);
  assert.equal(firstRound(saved).filter(m=>m.opponent1===null||m.opponent2===null).length,1);
  await assert.rejects(create(id,data),/already been generated/);
});
test('wrong bye recipient, duplicate entrants and a fake player instead of a null bye are rejected atomically',async()=>{
  const id=await event(),pools=await field(id),winner=pools[0][0];await confirm(id,winner);
  const wrong=await bracket(pools,pools[1][0]);await assert.rejects(create(id,wrong),/confirmed CTP winner must receive/);
  const duplicate=await bracket(pools,winner);duplicate.participant[1].par3PlayerId=duplicate.participant[0].par3PlayerId;
  await assert.rejects(create(id,duplicate),/every active player exactly once/);
  const fake=await bracket(pools,winner);firstRound(fake)[0].opponent2={id:999,position:2};
  await assert.rejects(create(id,fake),/exactly one genuine bye/);
  assert.equal((await db.query('select knockout_data from cgs_par3_events where id=$1',[id])).rows[0].knockout_data,null);
});
test('missing or duplicated opening opponent and missing automatic next-round advancement are rejected',async()=>{
  const id=await event(),pools=await field(id),winner=pools[0][0];await confirm(id,winner);
  const missing=await bracket(pools,winner);firstRound(missing)[1].opponent2.id=null;
  await assert.rejects(create(id,missing),/Every remaining entrant/);
  const duplicate=await bracket(pools,winner);firstRound(duplicate)[1].opponent2.id=firstRound(duplicate)[1].opponent1.id;
  await assert.rejects(create(id,duplicate),/Every remaining entrant/);
  const stalled=await bracket(pools,winner),second=stalled.round.find(r=>r.number===2).id;
  stalled.match.find(m=>m.round_id===second&&m.number===1).opponent1.id=null;
  await assert.rejects(create(id,stalled),/advance automatically/);
});
test('pre-recorded opening wins and extra later-round advancement are rejected',async()=>{
  const id=await event(),pools=await field(id),winner=pools[0][0];await confirm(id,winner);
  const prewon=await bracket(pools,winner);firstRound(prewon)[1].status=4;firstRound(prewon)[1].opponent1.result='win';firstRound(prewon)[1].opponent2.result='loss';
  await assert.rejects(create(id,prewon),/Opening matches must be unplayed/);
  const injected=await bracket(pools,winner),second=injected.round.find(r=>r.number===2).id;
  injected.match.find(m=>m.round_id===second&&m.number===2).opponent1.id=injected.participant[1].id;
  await assert.rejects(create(id,injected),/Only the CTP bye recipient/);
  const futureResult=await bracket(pools,winner),finalRound=futureResult.round.find(r=>r.number===4).id;
  futureResult.match.find(m=>m.round_id===finalRound).opponent1.result='win';
  await assert.rejects(create(id,futureResult),/Only the CTP bye recipient/);
  assert.equal((await db.query('select knockout_data from cgs_par3_events where id=$1',[id])).rows[0].knockout_data,null);
});
test('generic seven-player/eight-slot format keeps only one bye and older calls preserve the mode',async()=>{
  const id=await event([3,4],8),pools=await field(id,[3,4]);
  await db.query('select cgs_par3_update_format($1,$2,8)',[id,'[3,4]']);
  assert.equal((await db.query('select finals_format from cgs_par3_events where id=$1',[id])).rows[0].finals_format,'pool_winners_ctp_bye');
  await confirm(id,pools[1][0]);await create(id,await bracket(pools,pools[1][0],8));
  const data=(await db.query('select knockout_data from cgs_par3_events where id=$1',[id])).rows[0].knockout_data;
  assert.equal(data.participant.length,7);assert.equal(firstRound(data).filter(m=>m.opponent1&&m.opponent2).length,3);
});
test('a bye format cannot nominate more pools than its required field can populate',async()=>{
  await assert.rejects(event([2,2,2,2],8),/at least two entrants/);
});
test('wrong field count and stale result snapshots cannot confirm CTP or generate finals',async()=>{
  const id=await event(),pools=await field(id),winner=pools[0][0],data=await bracket(pools,winner);
  const stale=await timestamp(id);await confirm(id,winner);
  await assert.rejects(create(id,data,stale),/tournament changed/);
  await db.query("insert into cgs_par3_players(event_id,name,pool_number)values($1,'Additional fixture player',1)",[id]);
  await assert.rejects(confirm(id,winner),/exactly one fewer entrant/);
  await assert.rejects(create(id,data),/exactly one fewer entrant/);
});
test('result winners use head-to-head and display order consistently with the public table',async()=>{
  const id=await event(),pools=await field(id,undefined,false);
  for(const pool of pools){
    const pairs=[[pool[0],pool[1],pool[0]],[pool[0],pool[2],pool[2]],[pool[1],pool[2],pool[1]]];let match=0;
    for(const [p1,p2,winner]of pairs)await db.query("insert into cgs_par3_pool_matches(event_id,pool_number,match_number,player1_id,player2_id,winner_id,status)values($1,$2,$3,$4,$5,$6,'complete')",[id,pools.indexOf(pool)+1,++match,p1,p2,winner]);
  }
  const winners=(await db.query('select cgs_par3_completed_pool_winners($1) ids',[id])).rows[0].ids;
  assert.deepEqual(winners,pools.map(pool=>Number(pool[0])));
  await db.query('update cgs_par3_players set display_order=1 where event_id=$1',[id]);
  const duplicateOrderWinners=(await db.query('select cgs_par3_completed_pool_winners($1) ids',[id])).rows[0].ids;
  assert.deepEqual(duplicateOrderWinners,pools.map(pool=>Number(pool[0])));
  await confirm(id,pools[0][0]);
});
test('new helper and replacement format RPC remain service-only without SECURITY DEFINER',async()=>{
  const rows=(await db.query("select p.proname,p.pronargs,p.pronargdefaults,p.prosecdef,has_function_privilege('anon',p.oid,'execute') a,has_function_privilege('authenticated',p.oid,'execute') u from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('cgs_par3_update_format','cgs_par3_completed_pool_winners') order by p.proname")).rows;
  assert.equal(rows.length,2);assert.ok(rows.every(r=>!r.prosecdef&&!r.a&&!r.u));
  assert.equal(rows.find(r=>r.proname==='cgs_par3_update_format').pronargs,4);
  assert.equal(rows.find(r=>r.proname==='cgs_par3_update_format').pronargdefaults,1);
});
