const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
let db;
test.before(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);",
  );
  await db.exec(
    fs.readFileSync(
      path.resolve(
        __dirname,
        "../supabase/migrations/20261106202122_cgl_2027_platform_foundation.sql",
      ),
      "utf8",
    ),
  );
});
test.after(async () => {
  await db?.close();
});
async function member() {
  const id = randomUUID();
  await db.query("insert into auth.users values($1)", [id]);
  await db.query(
    "insert into cgl_members(id,email,display_name,handicap,handicap_status) values($1,$2,'Isolated fixture',5,'verified')",
    [id, `${id}@example.test`],
  );
  return id;
}
async function issue(id, amount, key = randomUUID()) {
  return (
    await db.query(
      "select cgl_issue_credits($1,$2,$3,'{}','Verified isolated award','test-admin') as id",
      [id, amount, key],
    )
  ).rows[0].id;
}
async function product(creditPrice = 30, stock = 5) {
  const id = randomUUID();
  await db.query(
    "insert into cgl_catalogue(id,name,credit_price,stock,active,cost_cents) values($1,'Isolated hat',$2,$3,true,1700)",
    [id, creditPrice, stock],
  );
  return id;
}
async function redeem(memberId, itemId, key = randomUUID(), quantity = 1) {
  return (
    await db.query("select cgl_redeem($1,$2,$3,$4) as id", [
      memberId,
      itemId,
      quantity,
      key,
    ])
  ).rows[0].id;
}
async function season() {
  const id = randomUUID();
  await db.query(
    "insert into cgl_seasons(id,slug,name,year,season_number,format,starts_at,ends_at,status) values($1,$2,'Fixture season',$3,1,'aggregate',now()-interval '35 days',now()+interval '56 days','active')",
    [
      id,
      `fixture-${id}`,
      2200 +
        (await db.query("select count(*)::int as n from cgl_seasons")).rows[0]
          .n,
    ],
  );
  return id;
}

test("configured plan amounts and casual non-renewal constraints are stored in cents", async () => {
  const plans = (
    await db.query(
      "select code,price_cents,auto_renew from cgl_plans order by code",
    )
  ).rows;
  assert.deepEqual(
    Object.fromEntries(plans.map((p) => [p.code, p.price_cents])),
    {
      annual: 24900,
      casual_registration: 2900,
      casual_season: 10000,
      monthly: 2995,
      weekly: 895,
    },
  );
  await assert.rejects(
    db.exec("update cgl_plans set auto_renew=true where code='casual_season'"),
  );
});
test("award issues once, retains original 18-month expiry, and conflicting idempotency is refused", async () => {
  const id = await member(),
    key = randomUUID();
  const lot = await issue(id, 20, key);
  assert.equal(await issue(id, 20, key), lot);
  await assert.rejects(issue(id, 21, key));
  const row = (
    await db.query(
      "select original_amount,remaining_amount,expires_at=issued_at+interval '18 months' as expiry from cgl_credit_lots where id=$1",
      [lot],
    )
  ).rows[0];
  assert.equal(row.expiry, true);
  assert.equal(row.remaining_amount, 20);
});
test("redemption consumes earliest-expiring lots atomically and request replay cannot spend twice", async () => {
  const id = await member(),
    item = await product(),
    late = await issue(id, 40),
    early = await issue(id, 20);
  await db.query(
    "update cgl_credit_lots set expires_at=now()+interval '2 months' where id=$1",
    [early],
  );
  const key = randomUUID(),
    order = await redeem(id, item, key);
  assert.equal(await redeem(id, item, key), order);
  const lots = (
    await db.query(
      "select id,remaining_amount from cgl_credit_lots where member_id=$1",
      [id],
    )
  ).rows;
  assert.equal(lots.find((l) => l.id === early).remaining_amount, 0);
  assert.equal(lots.find((l) => l.id === late).remaining_amount, 30);
  assert.equal(
    (await db.query("select stock from cgl_catalogue where id=$1", [item]))
      .rows[0].stock,
    4,
  );
  await assert.rejects(redeem(id, item, key, 2));
});
test("insufficient credits roll back stock, order and ledger changes", async () => {
  const id = await member(),
    item = await product(100, 1);
  await issue(id, 20);
  await assert.rejects(redeem(id, item));
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from cgl_orders where member_id=$1",
        [id],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (await db.query("select stock from cgl_catalogue where id=$1", [item]))
      .rows[0].stock,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select sum(remaining_amount)::int as n from cgl_credit_lots where member_id=$1",
        [id],
      )
    ).rows[0].n,
    20,
  );
});
test("stock exhaustion and payment-discount redemptions are rejected before spending", async () => {
  const id = await member(),
    item = await product(10, 0);
  await issue(id, 100);
  await assert.rejects(redeem(id, item));
  await db.query(
    "update cgl_catalogue set stock=1,kind='membership_discount' where id=$1",
    [item],
  );
  await assert.rejects(redeem(id, item));
});
test("expired credits are excluded before the scheduler and expiry processing is idempotent", async () => {
  const id = await member(),
    lot = await issue(id, 20),
    item = await product(10);
  await db.query(
    "update cgl_credit_lots set issued_at=now()-interval '19 months',expires_at=now()-interval '1 month' where id=$1",
    [lot],
  );
  await assert.rejects(redeem(id, item));
  await db.exec("select cgl_expire_credits(); select cgl_expire_credits();");
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from cgl_credit_transactions where lot_id=$1 and kind='expire'",
        [lot],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select remaining_amount from cgl_credit_lots where id=$1",
        [lot],
      )
    ).rows[0].remaining_amount,
    0,
  );
});
test("credit ledger and administrative history reject direct updates/deletes", async () => {
  const id = await member(),
    lot = await issue(id, 10);
  await assert.rejects(
    db.query("update cgl_credit_transactions set amount=999 where lot_id=$1", [
      lot,
    ]),
  );
  await assert.rejects(
    db.query("delete from cgl_credit_transactions where lot_id=$1", [lot]),
  );
  await db.exec(
    "insert into cgl_audit_events(actor,action,entity,reason) values('fixture','test','test','Test reason')",
  );
  await assert.rejects(db.exec("delete from cgl_audit_events"));
});
test("negative adjustments are idempotent, audited and cannot create a negative balance", async () => {
  const id = await member();
  await issue(id, 20);
  const key = randomUUID();
  await db.query(
    "select cgl_adjust_credits($1,-15,$2,'Verified correction','admin')",
    [id, key],
  );
  await db.query(
    "select cgl_adjust_credits($1,-15,$2,'Verified correction','admin')",
    [id, key],
  );
  await assert.rejects(
    db.query(
      "select cgl_adjust_credits($1,-6,$2,'Verified correction','admin')",
      [id, randomUUID()],
    ),
  );
  assert.equal(
    (
      await db.query(
        "select sum(remaining_amount)::int as n from cgl_credit_lots where member_id=$1",
        [id],
      )
    ).rows[0].n,
    5,
  );
});
test("cancelled unfulfilled orders restore stock and credits with an immutable compensating record", async () => {
  const id = await member(),
    item = await product();
  await issue(id, 40);
  const order = await redeem(id, item);
  await db.query("select cgl_command('cancel_order',$1,'admin')", [
    { id: order, reason: "Order cancellation requested" },
  ]);
  await db.query("select cgl_command('cancel_order',$1,'admin')", [
    { id: order, reason: "Order cancellation requested" },
  ]);
  assert.equal(
    (
      await db.query(
        "select sum(remaining_amount)::int as n from cgl_credit_lots where member_id=$1",
        [id],
      )
    ).rows[0].n,
    40,
  );
  assert.equal(
    (await db.query("select stock from cgl_catalogue where id=$1", [item]))
      .rows[0].stock,
    5,
  );
});
test("allowlisted configuration saves preserve defaults and log before/after atomically", async () => {
  const id = randomUUID();
  const created = (
    await db.query(
      "select cgl_admin_save('catalogue',$1,'admin','New isolated catalogue item') as item",
      [{ id, name: "Fixture glove", credit_price: 30, stock: 2 }],
    )
  ).rows[0].item;
  assert.equal(created.active, false);
  assert.equal(created.cost_cents, 0);
  const changed = (
    await db.query(
      "select cgl_admin_save('catalogue',$1,'admin','Review isolated stock') as item",
      [{ id, stock: 3 }],
    )
  ).rows[0].item;
  assert.equal(changed.name, "Fixture glove");
  assert.equal(changed.stock, 3);
  await assert.rejects(
    db.query(
      "select cgl_admin_save('catalogue',$1,'admin','Invalid credit edit')",
      [{ id, remaining_amount: 999 }],
    ),
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from cgl_audit_events where entity_id=$1",
        [id],
      )
    ).rows[0].n,
    2,
  );
});
test("SGT requests never silently replace an existing verified identity", async () => {
  const id = await member();
  await db.query(
    "update cgl_members set sgt_username='Original',sgt_id='123456789',sgt_verified_at=now() where id=$1",
    [id],
  );
  const request = (
    await db.query("select cgl_command('link_sgt',$1,$2) as value", [
      {
        member_id: id,
        sgt_username: "NewHandle",
        sgt_id: "987654321",
        reason: "Verify my account",
      },
      id,
    ])
  ).rows[0].value;
  assert.equal(
    (await db.query("select sgt_username from cgl_members where id=$1", [id]))
      .rows[0].sgt_username,
    "Original",
  );
  await db.query("select cgl_command('verify_sgt',$1,'admin')", [
    {
      id: request.id,
      state: "verified",
      reason: "Verified official SGT profile",
    },
  ]);
  assert.equal(
    (await db.query("select sgt_username from cgl_members where id=$1", [id]))
      .rows[0].sgt_username,
    "NewHandle",
  );
});
test("verified SGT result corrections require explicit intent and preserve original revisions", async () => {
  const id = await member(),
    seasonId = await season(),
    weekId = randomUUID();
  await db.query(
    "insert into cgl_weeks(id,season_id,week_number,championship_week,name,phase) values($1,$2,4,1,'Championship week','championship')",
    [weekId, seasonId],
  );
  const result = {
    member_id: id,
    external_id: "fixture-result",
    gross: 72,
    net: 67,
    handicap: 5,
    division: "A",
    holes: [],
    stats: {},
    played_at: new Date().toISOString(),
  };
  await db.query(
    "select cgl_import_results($1,'https://simulatorgolftour.com/scorecard/1/1','first',$2,'admin','Verified official source',false)",
    [weekId, [result]],
  );
  const current = (
    await db.query("select id from cgl_results where week_id=$1", [weekId])
  ).rows[0].id;
  await db.query(
    "select cgl_review_result($1,'verified','Verified official source','admin')",
    [current],
  );
  await assert.rejects(
    db.query(
      "select cgl_import_results($1,'https://simulatorgolftour.com/scorecard/1/1','changed',$2,'admin','Verified correction',false)",
      [weekId, [{ ...result, gross: 73 }]],
    ),
  );
  await db.query(
    "select cgl_import_results($1,'https://simulatorgolftour.com/scorecard/1/1','changed',$2,'admin','Verified correction',true)",
    [weekId, [{ ...result, gross: 73 }]],
  );
  assert.deepEqual(
    (
      await db.query(
        "select state,revision from cgl_results where week_id=$1 order by revision",
        [weekId],
      )
    ).rows,
    [
      { state: "superseded", revision: 1 },
      { state: "pending", revision: 2 },
    ],
  );
});
test("publication checks snapshot consistency and duplicate award processing issues once", async () => {
  const id = await member(),
    seasonId = await season(),
    weekId = randomUUID(),
    resultId = randomUUID();
  await db.query(
    "insert into cgl_weeks(id,season_id,week_number,championship_week,name,phase) values($1,$2,4,1,'Championship week','championship')",
    [weekId, seasonId],
  );
  await db.query(
    "insert into cgl_results(id,week_id,member_id,external_id,source_url,gross,net,division,state) values($1,$2,$3,'published-source','https://simulatorgolftour.com/scorecard/1/1',72,67,'A','verified')",
    [resultId, weekId, id],
  );
  const snapshot = (
    await db.query(
      "select jsonb_agg(jsonb_build_object('id',id,'updated_at',updated_at) order by id) as snapshot from cgl_results where week_id=$1",
      [weekId],
    )
  ).rows[0].snapshot;
  const calculation = {
    rules_version: "fixture",
    points_version: {},
    source_snapshot: snapshot,
    rows: [],
    awards: [{ playerId: id, category: "net", credits: 20 }],
    manual_review: false,
  };
  await assert.rejects(
    db.query("select cgl_publish_calculation($1,$2,'admin',true)", [
      weekId,
      { ...calculation, source_snapshot: [] },
    ]),
  );
  await db.query("select cgl_publish_calculation($1,$2,'admin',true)", [
    weekId,
    calculation,
  ]);
  await db.query("select cgl_publish_calculation($1,$2,'admin',true)", [
    weekId,
    calculation,
  ]);
  assert.equal(
    (
      await db.query(
        "select sum(remaining_amount)::int as n from cgl_credit_lots where member_id=$1",
        [id],
      )
    ).rows[0].n,
    20,
  );
  assert.equal(
    (
      await db.query("select results_published from cgl_weeks where id=$1", [
        weekId,
      ])
    ).rows[0].results_published,
    true,
  );
});
test("gift allocation rejects casuals and low successful payment counts, and avoids duplicates", async () => {
  const id = await member(),
    seasonId = await season(),
    giftId = randomUUID();
  await db.query(
    "insert into cgl_gift_items(id,season_id,name,unit_cost_cents,stock) values($1,$2,'Fixture hat',1700,2)",
    [giftId, seasonId],
  );
  await assert.rejects(
    db.query("select cgl_allocate_gift($1,$2,'admin','Seasonal gift review')", [
      id,
      giftId,
    ]),
  );
  const membershipId = randomUUID();
  await db.query(
    "insert into cgl_memberships(id,member_id,plan_code,state,starts_at,paid_through) values($1,$2,'monthly','active',now()-interval '60 days',now()+interval '30 days')",
    [membershipId, id],
  );
  await db.query(
    "insert into cgl_payments(member_id,membership_id,kind,amount_cents,state) values($1,$2,'monthly',2995,'completed')",
    [id, membershipId],
  );
  await assert.rejects(
    db.query("select cgl_allocate_gift($1,$2,'admin','Seasonal gift review')", [
      id,
      giftId,
    ]),
  );
  await db.query(
    "insert into cgl_payments(member_id,membership_id,kind,amount_cents,state) values($1,$2,'monthly',2995,'completed')",
    [id, membershipId],
  );
  const allocation = (
    await db.query(
      "select cgl_allocate_gift($1,$2,'admin','Seasonal gift review') as id",
      [id, giftId],
    )
  ).rows[0].id;
  assert.equal(
    (
      await db.query(
        "select cgl_allocate_gift($1,$2,'admin','Seasonal gift review') as id",
        [id, giftId],
      )
    ).rows[0].id,
    allocation,
  );
  assert.equal(
    (await db.query("select stock from cgl_gift_items where id=$1", [giftId]))
      .rows[0].stock,
    1,
  );
});
test("CGL tables and transactional functions have no public/member write privileges", async () => {
  const result = (
    await db.query(
      "select has_table_privilege('anon','cgl_members','SELECT') as public_member,has_table_privilege('authenticated','cgl_credit_lots','UPDATE') as member_credits,has_function_privilege('authenticated','cgl_redeem(uuid,uuid,integer,text)','EXECUTE') as rpc",
    )
  ).rows[0];
  assert.deepEqual(result, {
    public_member: false,
    member_credits: false,
    rpc: false,
  });
  assert.equal(
    (
      await db.query(
        "select count(*)::int as n from pg_class where relnamespace='public'::regnamespace and relname like 'cgl_%' and relkind='r' and not relrowsecurity",
      )
    ).rows[0].n,
    0,
  );
});

test("a full season generates three qualification and ten championship fixtures without overwriting existing fixtures", async () => {
  const id = await season();
  assert.equal(
    (
      await db.query(
        "select cgl_generate_fixtures($1,'admin','Generate approved season fixture') as n",
        [id],
      )
    ).rows[0].n,
    13,
  );
  const counts = (
    await db.query(
      "select count(*)::int total,count(*) filter(where phase='qualification')::int qualifying,count(*) filter(where phase='championship')::int championship from cgl_weeks where season_id=$1",
      [id],
    )
  ).rows[0];
  assert.deepEqual(counts, { total: 13, qualifying: 3, championship: 10 });
  await assert.rejects(
    db.query(
      "select cgl_generate_fixtures($1,'admin','Repeat request must preserve fixture IDs')",
      [id],
    ),
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from cgl_weeks where season_id=$1",
        [id],
      )
    ).rows[0].n,
    13,
  );
});

test("four-round publication is atomic when one fixture is locked", async () => {
  const id = await season();
  await db.query(
    "select cgl_generate_fixtures($1,'admin','Prepare release test fixtures')",
    [id],
  );
  const ids = (
    await db.query(
      "select id from cgl_weeks where season_id=$1 order by week_number limit 4",
      [id],
    )
  ).rows.map((row) => row.id);
  await db.query("update cgl_weeks set status='locked' where id=$1", [ids[3]]);
  await assert.rejects(
    db.query(
      "select cgl_publish_block($1,null,null,'admin','Release first four rounds')",
      [ids],
    ),
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from cgl_weeks where id=any($1) and status='published'",
        [ids],
      )
    ).rows[0].n,
    0,
  );
  await db.query("update cgl_weeks set status='draft' where id=$1", [ids[3]]);
  assert.equal(
    (
      await db.query(
        "select cgl_publish_block($1,null,null,'admin','Release reviewed four rounds') as n",
        [ids],
      )
    ).rows[0].n,
    4,
  );
});

test("credit prize approval and reversal preserve one issue and one compensating debit", async () => {
  const memberId = await member(),
    seasonId = await season(),
    id = randomUUID();
  await db.query(
    "insert into cgl_prizes(id,member_id,season_id,category,kind,amount,state,source_key) values($1,$2,$3,'champion','credits',300,'verified',$4)",
    [id, memberId, seasonId, `award-${id}`],
  );
  await db.query("select cgl_command('review_prize',$1,'admin')", [
    { id, state: "approved", reason: "Approve reviewed championship prize" },
  ]);
  await assert.rejects(
    db.query("select cgl_command('review_prize',$1,'admin')", [
      {
        id,
        state: "approved",
        reason: "Duplicate approval must not issue twice",
      },
    ]),
  );
  await db.query("select cgl_command('reverse_prize',$1,'admin')", [
    { id, reason: "Authorised correction after source review" },
  ]);
  await db.query("select cgl_command('reverse_prize',$1,'admin')", [
    { id, reason: "Repeat same reversal is idempotent" },
  ]);
  assert.equal(
    (
      await db.query(
        "select coalesce(sum(remaining_amount),0)::int n from cgl_credit_lots where member_id=$1",
        [memberId],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from cgl_credit_transactions where member_id=$1",
        [memberId],
      )
    ).rows[0].n,
    2,
  );
});
