const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
let db;
test.before(async () => {
  db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create publication supabase_realtime;');
  for (const name of ['20260806170000_add_par3_showdown_tournament.sql','20261105083434_flexible_par3_tournament_format.sql','20261105094940_par3_pool_winners_ctp_bye.sql']) {
    await db.exec(fs.readFileSync(path.resolve(__dirname,'../supabase/migrations',name),'utf8'));
  }
});
test.after(async () => db?.close());
async function event(sizes=[3,5],finals=4) {
  const id=(await db.query("insert into cgs_par3_events(slug,title,starts_at,warmup_at,venue_name,venue_address,registration_url,youtube_url) values($1,'Isolated test',now(),now(),'Fixture venue','Fixture address','https://example.test','') returning id",[randomUUID()])).rows[0].id;
  await db.query('select cgs_par3_update_format($1,$2,$3)',[id,JSON.stringify(sizes),finals]);
  return id;
}
async function player(id,pool=null,withdrawn=false) {
  return (await db.query("insert into cgs_par3_players(event_id,name,pool_number,is_withdrawn) values($1,'Fixture player',$2,$3) returning id",[id,pool,withdrawn])).rows[0].id;
}
async function field(id,sizes=[3,5]) {
  const pools=[];
  for(let i=0;i<sizes.length;i++) {
    const ids=[];
    for(let j=0;j<sizes[i];j++) ids.push(await player(id,i+1));
    pools.push(ids);
  }
  return pools;
}
function fixtures(pools) {
  return pools.flatMap((ids,index)=>{
    let n=0; const rows=[];
    for(let i=0;i<ids.length;i++) for(let j=i+1;j<ids.length;j++) rows.push({pool_number:index+1,match_number:++n,player1_id:Number(ids[i]),player2_id:Number(ids[j])});
    return rows;
  });
}
async function sync(id,rows) { return db.query('select cgs_par3_sync_pool_fixtures($1,$2)',[id,JSON.stringify(rows)]); }
async function timestamp(id) { return (await db.query('select updated_at::text as value from cgs_par3_events where id=$1',[id])).rows[0].value; }
async function matches(id) { return (await db.query('select id,pool_number,match_number,player1_id,player2_id,winner_id,status,bay_number from cgs_par3_pool_matches where event_id=$1 order by id',[id])).rows; }

test('migration preserves legacy six-by-four format, null optional capacities and finals of sixteen',async()=>{
  const row=(await db.query("select pool_count,pool_size,pool_sizes,max_players,finals_size from cgs_par3_events where slug='par-3-showdown-2026'")).rows[0];
  assert.deepEqual(row,{pool_count:6,pool_size:4,pool_sizes:null,max_players:24,finals_size:16});
});
test('unequal capacities calculate field size and accept more than six pools',async()=>{
  const id=await event([2,3,4,5,6,7,8],32);
  assert.deepEqual((await db.query('select pool_count,pool_size,max_players,finals_size from cgs_par3_events where id=$1',[id])).rows[0],{pool_count:7,pool_size:8,max_players:35,finals_size:32});
  const last=await player(id,7);
  await db.query('update cgs_par3_players set pool_rank_override=8,ctp_rank=12 where id=$1',[last]);
});
test('invalid sizes, fractional capacities, oversized field and impossible finals reject atomically',async()=>{
  const id=await event();
  for(const [sizes,size] of [[[1,4],4],[[9,4],4],[[2.5,4],4],[Array(9).fill(8),32],[[2,2],8],[[2,2],3],[[],2]]) {
    await assert.rejects(db.query('select cgs_par3_update_format($1,$2,$3)',[id,JSON.stringify(sizes),size]));
  }
  assert.equal((await db.query('select max_players from cgs_par3_events where id=$1',[id])).rows[0].max_players,8);
});
test('pool and total capacities reject additional entrants including restoration of withdrawn entrants',async()=>{
  const id=await event([2,2],4);
  await field(id,[2,2]);
  await assert.rejects(player(id,1),/field is full/);
  const w=await player(id,1,true);
  await assert.rejects(db.query('update cgs_par3_players set is_withdrawn=false where id=$1',[w]),/field is full/);
  const other=await event([2,3],4); await player(other,1);await player(other,1);
  await assert.rejects(player(other,1),/pool is already at capacity/);
});
test('resizing synchronises sold-out registration status while respecting a manual closure',async()=>{
  const id=await event([2,2],4);await field(id,[2,2]);
  await db.query("update cgs_par3_events set registrations_open=false,status_label='Sold out' where id=$1",[id]);
  await db.query('select cgs_par3_update_format($1,$2,4)',[id,'[3,3]']);
  assert.deepEqual((await db.query('select registrations_open,status_label from cgs_par3_events where id=$1',[id])).rows[0],{registrations_open:true,status_label:'Registrations open'});
  await db.query("update cgs_par3_events set registrations_open=false,status_label='Draw preparation' where id=$1",[id]);
  await db.query('select cgs_par3_update_format($1,$2,4)',[id,'[4,4]']);
  assert.equal((await db.query('select registrations_open from cgs_par3_events where id=$1',[id])).rows[0].registrations_open,false);
  await db.query('select cgs_par3_update_format($1,$2,4)',[id,'[2,2]']);
  assert.deepEqual((await db.query('select registrations_open,status_label from cgs_par3_events where id=$1',[id])).rows[0],{registrations_open:false,status_label:'Sold out'});
});
test('format shrink protects assigned players and leaves scheduled draw intact on failure',async()=>{
  const id=await event();const pools=await field(id);await sync(id,fixtures(pools));const before=await matches(id);
  await assert.rejects(db.query('select cgs_par3_update_format($1,$2,4)',[id,'[3,4]']),/capacity is smaller/);
  assert.deepEqual(await matches(id),before);
  await db.query('select cgs_par3_update_format($1,$2,8)',[id,'[4,6]']);
  assert.deepEqual(await matches(id),before);
});
test('capacity and finals changes preserve unchanged scheduled fixtures including bay queue and IDs',async()=>{
  const id=await event();const pools=await field(id);await sync(id,fixtures(pools));
  const first=(await matches(id))[0];await db.query('update cgs_par3_pool_matches set bay_number=3 where id=$1',[first.id]);
  const before=await matches(id);
  await db.query('select cgs_par3_update_format($1,$2,8)',[id,'[4,6]']);
  assert.deepEqual(await matches(id),before);
});
test('four pools expand back to five with unassigned entrants and unplayed fixtures in either finals format',async()=>{
  for(const mode of ['standard','pool_winners_ctp_bye']){
    const id=await event([4,4,4,4],16),pools=await field(id,[3,3,3,3]);
    await sync(id,fixtures(pools));
    await db.query('update cgs_par3_players set pool_number=null where id=$1',[pools[1][2]]);
    for(let i=0;i<3;i++)await player(id);
    if(mode!=='standard')await db.query('select cgs_par3_update_format($1,$2,16,$3)',[id,'[4,4,4,4]',mode]);
    const before=await matches(id),players=(await db.query('select id,pool_number from cgs_par3_players where event_id=$1 order by id',[id])).rows;
    await db.query('select cgs_par3_update_format($1,$2,16,$3)',[id,'[4,4,4,4,4]',mode]);
    assert.deepEqual((await db.query('select pool_count,pool_sizes,max_players,finals_size,finals_format from cgs_par3_events where id=$1',[id])).rows[0],{pool_count:5,pool_sizes:[4,4,4,4,4],max_players:20,finals_size:16,finals_format:mode});
    assert.deepEqual(await matches(id),before);
    assert.deepEqual((await db.query('select id,pool_number from cgs_par3_players where event_id=$1 order by id',[id])).rows,players);
  }
});
test('five pools change from four places to three for a fifteen-player CTP bye field without replacing scheduled fixtures',async()=>{
  const id=await event([4,4,4,4,4],16),pools=await field(id,[3,3,3,3,3]);
  await db.query('select cgs_par3_update_format($1,$2,16,$3)',[id,'[4,4,4,4,4]','pool_winners_ctp_bye']);
  await sync(id,fixtures(pools));
  await db.query('update cgs_par3_pool_matches set bay_number=2 where event_id=$1',[id]);
  const before=await matches(id),entrants=(await db.query('select id,pool_number from cgs_par3_players where event_id=$1 order by id',[id])).rows;
  await db.query('select cgs_par3_update_format($1,$2,16,$3)',[id,'[3,3,3,3,3]','pool_winners_ctp_bye']);
  assert.deepEqual((await db.query('select pool_count,pool_size,pool_sizes,max_players,finals_size,finals_format,registrations_open,status_label from cgs_par3_events where id=$1',[id])).rows[0],{pool_count:5,pool_size:3,pool_sizes:[3,3,3,3,3],max_players:15,finals_size:16,finals_format:'pool_winners_ctp_bye',registrations_open:false,status_label:'Sold out'});
  assert.deepEqual(await matches(id),before);
  assert.deepEqual((await db.query('select id,pool_number from cgs_par3_players where event_id=$1 order by id',[id])).rows,entrants);
});
test('changing pool capacity after a recorded match is rejected while retaining the result and saved capacity',async()=>{
  const id=await event([4,4,4,4,4],16),pools=await field(id,[3,3,3,3,3]);
  await db.query('select cgs_par3_update_format($1,$2,16,$3)',[id,'[4,4,4,4,4]','pool_winners_ctp_bye']);
  await sync(id,fixtures(pools));
  const first=(await matches(id))[0];await db.query("update cgs_par3_pool_matches set winner_id=player1_id,status='complete' where id=$1",[first.id]);
  const before=await matches(id);
  await assert.rejects(db.query('select cgs_par3_update_format($1,$2,16,$3)',[id,'[3,3,3,3,3]','pool_winners_ctp_bye']),/match starts or results are recorded/);
  assert.deepEqual(await matches(id),before);
  assert.deepEqual((await db.query('select pool_size,pool_sizes,max_players from cgs_par3_events where id=$1',[id])).rows[0],{pool_size:4,pool_sizes:[4,4,4,4,4],max_players:20});
});
test('draw calculates complete round robins for unequal actual pool sizes with byes in odd pools',async()=>{
  const id=await event();const pools=await field(id);await sync(id,fixtures(pools));
  const rows=await matches(id);assert.equal(rows.length,13);
  assert.equal(rows.filter(r=>r.pool_number===1).length,3);
  assert.equal(rows.filter(r=>r.pool_number===2).length,10);
});
test('partial capacity is valid but every active player must be assigned before draw generation',async()=>{
  const id=await event([4,6],4);const pools=await field(id,[2,3]);const extra=await player(id);
  await assert.rejects(sync(id,fixtures(pools)),/Assign every active player/);
  await db.query('update cgs_par3_players set pool_number=2 where id=$1',[extra]);pools[1].push(extra);
  await sync(id,fixtures(pools));assert.equal((await matches(id)).length,7);
});
test('unchanged regeneration preserves live fixtures, bay allocations, completed results and IDs',async()=>{
  const id=await event();const pools=await field(id);const desired=fixtures(pools);await sync(id,desired);
  const initial=await matches(id);
  await db.query("update cgs_par3_pool_matches set winner_id=player1_id,status='complete' where id=$1",[initial[0].id]);
  await db.query("update cgs_par3_pool_matches set status='live',bay_number=2 where id=$1",[initial[1].id]);
  const before=await matches(id);await sync(id,desired);assert.deepEqual(await matches(id),before);
  await assert.rejects(db.query('select cgs_par3_update_format($1,$2,4)',[id,'[4,5]']),/match starts/);
  await assert.rejects(db.query('update cgs_par3_players set pool_number=null where id=$1',[pools[0][0]]),/match starts/);
  await assert.rejects(db.query('delete from cgs_par3_pool_matches where id=$1',[initial[1].id]),/cannot be deleted/);
});
test('invalid later pool cannot delete or partially regenerate earlier scheduled pool',async()=>{
  const id=await event();const pools=await field(id);await sync(id,fixtures(pools));const before=await matches(id);
  const bad=fixtures(pools);bad.pop();
  await assert.rejects(sync(id,bad),/every distinct pool pairing/);assert.deepEqual(await matches(id),before);
  const duplicate=fixtures(pools);duplicate[duplicate.length-1]={...duplicate[duplicate.length-2]};
  await assert.rejects(sync(id,duplicate));assert.deepEqual(await matches(id),before);
});
test('automatic allocation replaces only scheduled fixtures and assigns all active players once',async()=>{
  const id=await event([3,5],4);const pools=await field(id);await sync(id,fixtures(pools));
  const ids=pools.flat();const assignments=ids.map((id,i)=>({player_id:Number(id),pool_number:i<3?1:2}));
  await db.query('select cgs_par3_allocate_pools($1,$2)',[id,JSON.stringify(assignments)]);
  assert.equal((await matches(id)).length,0);
  assert.equal((await db.query('select count(*)::int n from cgs_par3_players where event_id=$1 and not is_withdrawn and pool_number is not null',[id])).rows[0].n,8);
  await assert.rejects(db.query('select cgs_par3_allocate_pools($1,$2)',[id,JSON.stringify(assignments.map(()=>assignments[0]))]),/exactly once/);
  await sync(id,fixtures(pools));const first=(await matches(id))[0];await db.query("update cgs_par3_pool_matches set status='live' where id=$1",[first.id]);
  await assert.rejects(db.query('select cgs_par3_allocate_pools($1,$2)',[id,JSON.stringify(assignments)]),/reallocated/);
});
test('CTP replacement is atomic and stale pool data cannot confirm qualifiers',async()=>{
  const id=await event([2,2],4);const pools=await field(id,[2,2]);const first=pools[0][0],second=pools[1][0];
  const stale=await timestamp(id);await db.query('update cgs_par3_players set pool_rank_override=1 where id=$1',[first]);
  await assert.rejects(db.query('select cgs_par3_set_ctp_qualifiers($1,$2,$3)',[id,JSON.stringify([Number(first)]),stale]),/tournament changed/);
  await db.query('select cgs_par3_set_ctp_qualifiers($1,$2,$3)',[id,JSON.stringify([Number(first),Number(second)]),await timestamp(id)]);
  await assert.rejects(db.query('select cgs_par3_set_ctp_qualifiers($1,$2,$3)',[id,JSON.stringify([Number(first),Number(first)]),await timestamp(id)]),/distinct/);
  assert.equal((await db.query('select count(*)::int n from cgs_par3_players where event_id=$1 and ctp_rank is not null',[id])).rows[0].n,2);
});
test('finals creation rejects stale data, preserves existing draw and locks pool seeds/results',async()=>{
  const id=await event([2,2],4);const pools=await field(id,[2,2]);await sync(id,fixtures(pools));
  const bracket={participant:pools.flat().map((id,i)=>({id:i,name:`Player ${id}`})),stage:[],match:[],round:[],group:[],match_game:[]};
  const stale=await timestamp(id);await db.query('update cgs_par3_players set pool_rank_override=1 where id=$1',[pools[0][0]]);
  await assert.rejects(db.query('select cgs_par3_create_finals($1,$2,$3)',[id,JSON.stringify(bracket),stale]),/tournament changed/);
  await db.query('select cgs_par3_create_finals($1,$2,$3)',[id,JSON.stringify(bracket),await timestamp(id)]);
  await assert.rejects(db.query('select cgs_par3_create_finals($1,$2,$3)',[id,JSON.stringify(bracket),await timestamp(id)]),/already been generated/);
  await assert.rejects(db.query('update cgs_par3_players set pool_rank_override=2 where id=$1',[pools[0][0]]),/after finals/);
  await assert.rejects(db.query('update cgs_par3_players set display_order=1 where id=$1',[pools[0][0]]),/after finals/);
  await assert.rejects(db.query("update cgs_par3_pool_matches set winner_id=player1_id,status='complete' where event_id=$1",[id]),/locked after finals/);
});
test('new mutating RPCs are inaccessible to public and normal signed-in users',async()=>{
  const rows=(await db.query("select p.proname,has_function_privilege('anon',p.oid,'execute') as anon,has_function_privilege('authenticated',p.oid,'execute') as member,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('cgs_par3_update_format','cgs_par3_allocate_pools','cgs_par3_sync_pool_fixtures','cgs_par3_set_ctp_qualifiers','cgs_par3_create_finals')")).rows;
  assert.equal(rows.length,5);assert.ok(rows.every(r=>!r.anon&&!r.member&&!r.prosecdef));
});
