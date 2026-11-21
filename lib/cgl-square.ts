import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { CGL_MEMBERSHIP_TERMS_VERSION } from "@/lib/cgl-terms";

const SQUARE_API = {
  sandbox: "https://connect.squareupsandbox.com/v2",
  production: "https://connect.squareup.com/v2",
} as const;
const SQUARE_VERSION = "2026-09-16";
const SANDBOX_APPLICATION_ID = "sandbox-sq0idb-coifDq2jybhW8YXqBoxAyw";
const PLAN_CADENCES: Record<string, string> = { annual: "ANNUAL", monthly: "MONTHLY", weekly: "WEEKLY" };
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Data = Record<string, unknown>;
export type CglSquareEnvironment = keyof typeof SQUARE_API;
export class CglSquareError extends Error {
  constructor(message: string, public status = 503, public code = "square_configuration") { super(message); this.name = "CglSquareError"; }
}
export type CglSquareCheckout = {
  id: string; member_id: string; membership_id: string; plan_code: string; amount_cents: number;
  recurring: boolean; square_plan_variation_id: string | null; payment_link_url: string | null;
  square_link_id?: string | null; square_order_id?: string | null; season_id: string | null;
  environment?: CglSquareEnvironment;
  checkout_channel?: "account" | "guest";
  terms_snapshot?: Data | null;
};
function object(value: unknown): Data { return value && typeof value === "object" && !Array.isArray(value) ? value as Data : {}; }
function string(value: unknown): string | null { return typeof value === "string" && value.length > 0 ? value : null; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function integer(value: unknown): number | null { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null; }
function invalid(message: string): never { throw new CglSquareError(message, 409, "square_identity_mismatch"); }
function canonicalTimezone(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  try { return new Intl.DateTimeFormat("en-AU", { timeZone: value }).resolvedOptions().timeZone; } catch { return null; }
}
function isSquareSubscriptionTestEvent(event: Data) {
  const data = object(event.data), payment = object(object(data.object).payment), amount = object(payment.amount_money);
  return event.type === "payment.created" &&
    data.type === "payment" &&
    data.id === "KkAkhdMsgzn59SM8A89WgKwekxLZY" &&
    payment.id === "hYy9pRFVxpDsO1FB05SunFWUe9JZY" &&
    payment.location_id === "S8GWD5R9QB376" &&
    payment.order_id === "03O3USaPaAaFnI6kkwB1JxGgBsUZY" &&
    amount.amount === 100 &&
    amount.currency === "USD";
}

function configuredEnvironment(env: NodeJS.ProcessEnv): CglSquareEnvironment {
  return env.CGL_SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";
}

function environmentKeys(environment: CglSquareEnvironment) {
  if (environment === "production") return {
    applicationId: "CGL_SQUARE_PRODUCTION_APPLICATION_ID",
    token: "CGL_SQUARE_PRODUCTION_ACCESS_TOKEN",
    locationId: "CGL_SQUARE_PRODUCTION_LOCATION_ID",
    merchantId: "CGL_SQUARE_PRODUCTION_MERCHANT_ID",
    signatureKey: "CGL_SQUARE_PRODUCTION_WEBHOOK_SIGNATURE_KEY",
    notificationUrl: "CGL_SQUARE_PRODUCTION_WEBHOOK_URL",
  } as const;
  return {
    applicationId: "CGL_SQUARE_APPLICATION_ID",
    token: "CGL_SQUARE_ACCESS_TOKEN",
    locationId: "CGL_SQUARE_LOCATION_ID",
    merchantId: "CGL_SQUARE_MERCHANT_ID",
    signatureKey: "CGL_SQUARE_WEBHOOK_SIGNATURE_KEY",
    notificationUrl: "CGL_SQUARE_WEBHOOK_URL",
  } as const;
}

export function getCglSquareReadiness(env: NodeJS.ProcessEnv = process.env) {
  const environment = configuredEnvironment(env), keys = environmentKeys(environment);
  const apiRequired = [keys.token, keys.locationId, keys.merchantId] as const;
  const required = [...apiRequired, keys.signatureKey, keys.notificationUrl, keys.applicationId];
  const missing = required.filter(key => !env[key]?.trim());
  const applicationId = env[keys.applicationId]?.trim() || (environment === "sandbox" ? SANDBOX_APPLICATION_ID : "");
  const enabled = env.CGL_SQUARE_CHECKOUT_ENABLED === "true";
  const testingEnabled = env.CGL_SQUARE_SANDBOX_TESTING_ENABLED === "true";
  const livePaymentsEnabled = env.CGL_SQUARE_LIVE_PAYMENTS_ENABLED === "true";
  const recurringEnabled = env.CGL_SQUARE_LIVE_RECURRING_ENABLED === "true";
  const termsApproved = env.CGL_SQUARE_TERMS_APPROVED === "true";
  const termsVersion = env.CGL_SQUARE_TERMS_VERSION?.trim() ?? "";
  const termsVersionMatches = termsVersion === CGL_MEMBERSHIP_TERMS_VERSION;
  let webhookUrlValid = false;
  try { const url = new URL(env[keys.notificationUrl] ?? ""); webhookUrlValid = url.protocol === "https:" && !url.username && !url.password && !url.hash; } catch { /* Stay unready. */ }
  const applicationMatches = environment === "sandbox"
    ? applicationId === SANDBOX_APPLICATION_ID
    : applicationId.startsWith("sq0idp-");
  const apiConfigured = applicationMatches && apiRequired.every(key => Boolean(env[key]?.trim()));
  const configured = apiConfigured && missing.length === 0 && webhookUrlValid;
  const ready = environment === "sandbox"
    ? configured && enabled && testingEnabled
    : configured && enabled && livePaymentsEnabled && termsApproved && termsVersionMatches;
  return {
    environment,
    applicationId,
    apiConfigured,
    configured,
    enabled,
    testingEnabled,
    livePaymentsEnabled: environment === "production" && ready,
    recurringEnabled: environment === "production" && ready && recurringEnabled,
    termsApproved,
    termsVersion,
    termsVersionMatches,
    expectedTermsVersion: CGL_MEMBERSHIP_TERMS_VERSION,
    ready,
    oneOffActionsEnabled: ready,
    subscriptionActionsEnabled: environment === "production" && ready && recurringEnabled,
    missing,
    webhookUrlValid,
  };
}
export async function getCglSquareOperationalReadiness(
  env: NodeJS.ProcessEnv = process.env,
) {
  const readiness = getCglSquareReadiness(env);
  if (readiness.environment === "sandbox")
    return {
      ...readiness,
      databaseApproved: true,
      databaseRecurringApproved: false,
      databaseTermsApproved: true,
    };

  let setting: Data = {}, legal: Data = {};
  try {
    const db = getSupabaseAdmin();
    const [launchResult, legalResult] = await Promise.all([
      db.from("cgl_settings").select("value").eq("key", "square_production").maybeSingle(),
      db.from("cgl_settings").select("value").eq("key", "legal").maybeSingle(),
    ]);
    if (!launchResult.error) setting = object(object(launchResult.data).value);
    if (!legalResult.error) legal = object(object(legalResult.data).value);
  } catch {
    // Missing or unavailable launch approval must fail closed.
  }
  const databaseTermsApproved = legal.approved === true &&
    legal.version === CGL_MEMBERSHIP_TERMS_VERSION;
  const databaseApproved = databaseTermsApproved &&
    setting.checkout_enabled === true && setting.launch_approved === true;
  const databaseRecurringApproved = databaseApproved &&
    setting.recurring_enabled === true;
  return {
    ...readiness,
    databaseApproved,
    databaseRecurringApproved,
    databaseTermsApproved,
    ready: readiness.ready && databaseApproved,
    livePaymentsEnabled: readiness.livePaymentsEnabled && databaseApproved,
    recurringEnabled: readiness.recurringEnabled && databaseRecurringApproved,
    oneOffActionsEnabled: readiness.oneOffActionsEnabled && databaseApproved,
    subscriptionActionsEnabled:
      readiness.subscriptionActionsEnabled && databaseRecurringApproved,
  };
}
function getConfig(checkout = false, webhook = true) {
  const readiness = getCglSquareReadiness();
  const keys = environmentKeys(readiness.environment), label = readiness.environment === "sandbox" ? "Square Sandbox" : "Square production";
  if (!(webhook ? readiness.configured : readiness.apiConfigured)) throw new CglSquareError(`${label} is not connected. No payment has been taken.`);
  if (checkout && !readiness.ready) throw new CglSquareError(readiness.environment === "sandbox"
    ? "CGL Sandbox checkout requires explicit test activation. Live payments remain disabled."
    : "CGL live checkout requires verified production credentials, published terms and explicit launch activation. No payment has been taken.");
  return {
    environment: readiness.environment,
    apiBase: SQUARE_API[readiness.environment],
    token: process.env[keys.token]!.trim(),
    locationId: process.env[keys.locationId]!.trim(),
    merchantId: process.env[keys.merchantId]!.trim(),
    signatureKey: process.env[keys.signatureKey]?.trim() ?? "",
    notificationUrl: process.env[keys.notificationUrl]?.trim() ?? "",
  };
}
async function squareRequest(path: string, init: Pick<RequestInit, "method" | "body"> = {}) {
  const config = getConfig(false, false);
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) invalid("Invalid Square API path.");
  let response: Response;
  try { response = await fetch(`${config.apiBase}${path}`, { ...init, cache: "no-store", signal: AbortSignal.timeout(12_000), headers: { Authorization: `Bearer ${config.token}`, "Square-Version": SQUARE_VERSION, "Content-Type": "application/json" } }); }
  catch { throw new CglSquareError("Square could not be reached. The saved request can be retried safely.", 503, "square_unavailable"); }
  const value = object(await response.json().catch(() => null));
  if (!response.ok || !Object.keys(value).length || list(value.errors).length) {
    // Operational diagnostics contain static resource names and documented error
    // codes only. Provider details, resource IDs, contact data and credentials stay out.
    const parts = path.split("?")[0].split("/").filter(Boolean);
    const staticChild = (parts[0] === "catalog" && parts[1] === "object")
      || (parts[0] === "online-checkout" && parts[1] === "payment-links")
      || (parts[0] === "subscriptions" && parts[1] === "search");
    const operation = `/${parts[0] ?? "unknown"}${staticChild ? `/${parts[1]}` : parts.length > 1 ? "/:id" : ""}`;
    const codes = list(value.errors).slice(0, 10).map(error => {
      const code = string(object(error).code);
      return code && /^[A-Z][A-Z0-9_]{0,80}$/.test(code) ? code : "UNKNOWN";
    });
    console.error("CGL Square request failed", { environment: config.environment, operation, status: response.status, codes });
    throw new CglSquareError("Square could not verify this record. No unverified access has been granted.", 502,
      codes.includes("IDEMPOTENCY_KEY_REUSED") ? "square_idempotency_reused" : response.status === 429 || response.status >= 500 ? "square_unavailable" : "square_provider_rejected");
  }
  return value;
}
/** Read-only; also usable before configuring webhooks. */
export async function verifyCglSquareConnection() {
  const config = getConfig(false, false);
  const [seller, place] = await Promise.all([squareRequest(`/merchants/${encodeURIComponent(config.merchantId)}`), squareRequest(`/locations/${encodeURIComponent(config.locationId)}`)]);
  const merchant = object(seller.merchant), location = object(place.location);
  if (merchant.id !== config.merchantId || merchant.status !== "ACTIVE" || merchant.country !== "AU" || location.id !== config.locationId || location.merchant_id !== config.merchantId || location.status !== "ACTIVE" || location.country !== "AU" || location.currency !== "AUD") invalid("The Square seller or active Australian dollar location does not match CGL.");
  const timezone = string(location.timezone);
  if (!canonicalTimezone(timezone)) invalid("The Square location has an invalid billing timezone.");
  return { environment: config.environment, merchantId: config.merchantId, locationId: config.locationId, timezone: timezone! };
}
export function verifyCglSquareSignature(rawBody: string, signature: string | null, key: string, notificationUrl: string) {
  if (!signature || !key || !notificationUrl) return false;
  const expected = createHmac("sha256", key).update(notificationUrl + rawBody).digest("base64");
  const receivedBytes = Buffer.from(signature), expectedBytes = Buffer.from(expected);
  return receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes);
}
function phaseMoney(phase: Data) { const pricing = object(phase.pricing); return object(pricing.price ?? pricing.price_money ?? phase.recurring_price_money); }
function relativePricing(phase: Data) { return object(phase.pricing).type === "RELATIVE"; }
function isActiveAtLocation(item: Data, locationId: string) {
  return item.is_deleted !== true &&
    (item.present_at_all_locations !== false || list(item.present_at_location_ids).includes(locationId)) &&
    !list(item.absent_at_location_ids).includes(locationId);
}
export function validateCglSquareVariation(variation: unknown, checkout: Pick<CglSquareCheckout, "plan_code" | "amount_cents">) {
  const item = object(variation), data = object(item.subscription_plan_variation_data), phases = list(data.phases);
  const phase = object(phases[0]), pricing = object(phase.pricing), money = phaseMoney(phase);
  const relative = pricing.type === "RELATIVE";
  const staticPriceMatches = pricing.type === "STATIC" && money.currency === "AUD" && money.amount === checkout.amount_cents;
  const monthlyAnchor = integer(data.monthly_billing_anchor_date);
  const monthlyBillingMatches = checkout.plan_code === "monthly"
    ? (monthlyAnchor === null && data.can_prorate !== true) || (monthlyAnchor === 1 && data.can_prorate === true)
    : data.monthly_billing_anchor_date == null && data.can_prorate !== true;
  if (!PLAN_CADENCES[checkout.plan_code] || item.type !== "SUBSCRIPTION_PLAN_VARIATION" || item.is_deleted === true || phases.length !== 1 || phase.cadence !== PLAN_CADENCES[checkout.plan_code] || phase.periods != null || (!relative && !staticPriceMatches) || (relative && (list(pricing.discount_ids).length > 0 || Object.keys(money).length > 0)) || !monthlyBillingMatches) throw new CglSquareError("The Square plan differs from the displayed CGL price or uses an unsupported billing adjustment.", 409, "square_plan_mismatch");
}
async function verifyRelativeCglSquarePrice(variation: Data, checkout: Pick<CglSquareCheckout, "plan_code" | "amount_cents">) {
  const config = getConfig(false, false), data = object(variation.subscription_plan_variation_data);
  const parentId = string(data.subscription_plan_id);
  if (!parentId) invalid("The Square variation has no parent subscription plan.");
  const parent = object((await squareRequest(`/catalog/object/${encodeURIComponent(parentId)}`)).object);
  const plan = object(parent.subscription_plan_data), itemIds = list(plan.eligible_item_ids);
  if (parent.id !== parentId || parent.type !== "SUBSCRIPTION_PLAN" || !isActiveAtLocation(parent, config.locationId)
    || plan.all_items === true || list(plan.eligible_category_ids).length > 0 || itemIds.length !== 1
    || !list(plan.subscription_plan_variations).some(value => object(value).id === variation.id)) {
    invalid("The Square subscription plan catalogue mapping is unavailable.");
  }
  const itemId = string(itemIds[0]);
  if (!itemId) invalid("The Square subscription item mapping is unavailable.");
  const catalogItem = object((await squareRequest(`/catalog/object/${encodeURIComponent(itemId)}`)).object);
  const itemData = object(catalogItem.item_data);
  const priced = list(itemData.variations).map(object).filter(value => {
    const variationData = object(value.item_variation_data), money = object(variationData.price_money);
    return value.type === "ITEM_VARIATION" && isActiveAtLocation(value, config.locationId)
      && variationData.item_id === itemId && variationData.pricing_type === "FIXED_PRICING"
      && money.currency === "AUD" && money.amount === checkout.amount_cents
      && list(variationData.subscription_plan_ids).includes(parentId);
  });
  if (catalogItem.id !== itemId || catalogItem.type !== "ITEM" || !isActiveAtLocation(catalogItem, config.locationId) || priced.length !== 1) {
    throw new CglSquareError("The Square plan item differs from the displayed CGL price.", 409, "square_plan_mismatch");
  }
  const itemVariationId = string(priced[0].id);
  if (!itemVariationId) invalid("The Square subscription item variation is unavailable.");
  return itemVariationId;
}
async function retrieveVariation(id: string, checkout?: Pick<CglSquareCheckout, "plan_code" | "amount_cents">) {
  const variation = object((await squareRequest(`/catalog/object/${encodeURIComponent(id)}`)).object);
  if (variation.id !== id || variation.type !== "SUBSCRIPTION_PLAN_VARIATION" || variation.is_deleted === true) invalid("The Square plan variation identity does not match.");
  let catalogItemVariationId: string | null = null;
  if (checkout) {
    validateCglSquareVariation(variation, checkout);
    if (relativePricing(object(list(object(variation.subscription_plan_variation_data).phases)[0]))) {
      catalogItemVariationId = await verifyRelativeCglSquarePrice(variation, checkout);
    }
  }
  const locationId = getConfig(false, false).locationId;
  if (!isActiveAtLocation(variation, locationId)) invalid("The Square plan is unavailable at the CGL location.");
  return { variation, catalogItemVariationId };
}
/** Validate explicit existing catalog IDs without creating, updating or name-matching products. */
export async function auditCglSquareCatalogMappings(plans: { code: string; amountCents: number; variationId: string }[]) {
  const connection = await verifyCglSquareConnection(), mappings = [];
  for (const plan of plans) {
    const { variation } = await retrieveVariation(plan.variationId, { plan_code: plan.code, amount_cents: plan.amountCents });
    const parentId = string(object(variation.subscription_plan_variation_data).subscription_plan_id);
    if (!parentId) invalid("The Square variation has no parent subscription plan.");
    const parent = object((await squareRequest(`/catalog/object/${encodeURIComponent(parentId)}`)).object);
    if (parent.id !== parentId || parent.type !== "SUBSCRIPTION_PLAN" || parent.is_deleted === true) invalid("The Square parent plan is unavailable.");
    mappings.push({ code: plan.code, variationId: plan.variationId, parentId, amountCents: plan.amountCents, currency: "AUD", cadence: PLAN_CADENCES[plan.code] });
  }
  return { ...connection, mappings };
}
export function buildCglSquareCheckout(
  checkout: CglSquareCheckout,
  locationId: string,
  redirectUrl: string,
  catalogItem?: { id: string } | null,
) {
  if (![checkout.id, checkout.member_id, checkout.membership_id].every(value => UUID.test(value))) invalid("Verified CGL member, membership and checkout identities are required.");
  if (!Number.isSafeInteger(checkout.amount_cents) || checkout.amount_cents < 1) invalid("A positive, verified CGL checkout amount is required.");
  if (checkout.recurring !== Boolean(PLAN_CADENCES[checkout.plan_code]) || (checkout.recurring && !checkout.square_plan_variation_id)) invalid("The CGL recurring plan is not configured.");
  const environment = checkout.environment ?? getCglSquareReadiness().environment;
  if (!Object.hasOwn(SQUARE_API, environment)) invalid("The CGL checkout environment is invalid.");
  // Hosted checkout selects the customer from buyer input. Its template preserves
  // our immutable participant identities; email and customer_id are not proof.
  const label = environment === "sandbox" ? "Sandbox test" : "Crossodog Golf League";
  const lineItem = catalogItem?.id
    ? { catalog_object_id: catalogItem.id, quantity: "1" }
    : { name: `CGL ${checkout.plan_code.replaceAll("_", " ")} — ${label}`, quantity: "1", base_price_money: { amount: checkout.amount_cents, currency: "AUD" } };
  return { idempotency_key: environment === "sandbox" ? `cgl-checkout-${checkout.id}` : `cgl-live-checkout-${checkout.id}`, order: { location_id: locationId, reference_id: `cgl:${checkout.id}`, metadata: { cgl_environment: environment, cgl_intent_id: checkout.id, cgl_member_id: checkout.member_id, cgl_membership_id: checkout.membership_id }, line_items: [lineItem], pricing_options: { auto_apply_taxes: false, auto_apply_discounts: false } }, checkout_options: { allow_tipping: false, redirect_url: redirectUrl, ...(checkout.recurring ? { subscription_plan_id: checkout.square_plan_variation_id } : {}) }, payment_note: `CGL checkout ${checkout.id}` };
}
export function isCglSquareCheckoutUrl(value: string, environment: CglSquareEnvironment = getCglSquareReadiness().environment) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return false;
    const hosts = environment === "sandbox"
      ? ["square.link", "squareupsandbox.com"]
      : ["square.link", "square.site", "squareup.com"];
    return hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}
function assertLocation(value: Data) { if (value.location_id !== getConfig(false, false).locationId) invalid("The Square record belongs to a different location."); }
type CheckoutLink = { intent_id: string; order_id: string; member_id: string; membership_id: string; customer_id: string | null; subscription_id: string | null };
function checkoutLinkFromOrder(order: Data, subscription?: Data): CheckoutLink | null {
  assertLocation(order);
  const meta = object(order.metadata), id = string(meta.cgl_intent_id);
  if (!id || meta.cgl_environment !== getConfig(false, false).environment) return null;
  if (!UUID.test(id) || !UUID.test(String(meta.cgl_member_id)) || !UUID.test(String(meta.cgl_membership_id)) || order.reference_id !== `cgl:${id}` || !string(order.id)) invalid("The Square checkout template identity is inconsistent.");
  return { intent_id: id, order_id: String(order.id), member_id: String(meta.cgl_member_id), membership_id: String(meta.cgl_membership_id), customer_id: string(subscription?.customer_id), subscription_id: string(subscription?.id) };
}
function requireUnpaidCheckoutOrder(order: Data) {
  // Square Sandbox can leave a paid order OPEN. A recorded attempt must be
  // reconciled before reuse, including an attempt whose outcome is not yet known.
  if (list(order.tenders).some(tender => Boolean(string(object(tender).payment_id)))) {
    throw new CglSquareError("This Square checkout already has a recorded payment attempt. Refresh your CGL billing to reconcile it before another purchase.", 409, "square_checkout_payment_recorded");
  }
}
function verifyRecoveredCheckoutOrder(checkout: CglSquareCheckout, order: Data, orderId: string) {
  const proof = checkoutLinkFromOrder(order);
  if (!proof || proof.order_id !== orderId || proof.intent_id !== checkout.id || proof.member_id !== checkout.member_id
    || proof.membership_id !== checkout.membership_id || (checkout.square_order_id && checkout.square_order_id !== orderId)) {
    invalid("The recovered Square checkout does not belong to this CGL purchase.");
  }
  const items = list(order.line_items), item = object(items[0]), money = object(item.base_price_money);
  if (items.length !== 1 || item.quantity !== "1" || money.currency !== "AUD" || money.amount !== checkout.amount_cents) {
    invalid("The recovered Square checkout price differs from the saved CGL purchase.");
  }
  const total = object(order.total_money);
  if ((order.total_money != null && (total.amount !== checkout.amount_cents || total.currency !== "AUD"))
    || ["total_tax_money", "total_discount_money", "total_tip_money", "total_service_charge_money"].some(key => order[key] != null && object(order[key]).amount !== 0)) {
    invalid("The recovered Square checkout contains an unapproved price adjustment.");
  }
  if (!["DRAFT", "OPEN", "COMPLETED", "CANCELED"].includes(String(order.state))) invalid("The recovered Square checkout state needs review.");
}

/** Square can reject replay after a link's order changes. Recover the original
 * provider link through its original order; never create a second idempotency key. */
async function recoverCglSquareCheckout(checkout: CglSquareCheckout, redirectUrl: string) {
  const startedAt = Date.now(), config = getConfig(true), seenIds = new Set<string>(), candidates = new Map<string, string>();
  let cursor: string | null = null, inspected = 0, complete = false;
  for (let page = 0; page < 10; page += 1) {
    if (Date.now() - startedAt >= 20_000) break;
    const query = new URLSearchParams({ limit: "100", ...(cursor ? { cursor } : {}) });
    const response = await squareRequest(`/online-checkout/payment-links?${query}`);
    for (const value of list(response.payment_links)) {
      const link = object(value), id = string(link.id), orderId = string(link.order_id);
      if (!id || !orderId || seenIds.has(id)) continue;
      seenIds.add(id);
      // Only a previously stored original order ID can reduce the read set.
      // Buyer contact, payment notes and descriptions never establish ownership.
      if (checkout.square_order_id && orderId !== checkout.square_order_id) continue;
      if (inspected >= 50 || Date.now() - startedAt >= 20_000) {
        throw new CglSquareError("Square checkout recovery needs administrator reconciliation before another payment.", 409, "square_recovery_limit");
      }
      inspected += 1;
      const order = object((await squareRequest(`/orders/${encodeURIComponent(orderId)}`)).order);
      if (order.id !== orderId) invalid("The recovered Square order identity does not match.");
      if (order.location_id !== config.locationId) continue;
      const metadata = object(order.metadata);
      if (order.reference_id !== `cgl:${checkout.id}` && metadata.cgl_intent_id !== checkout.id) continue;
      verifyRecoveredCheckoutOrder(checkout, order, orderId);
      candidates.set(id, orderId);
      if (candidates.size > 1) throw new CglSquareError("More than one Square checkout matches this CGL purchase. CGS must reconcile it before payment.", 409, "square_recovery_ambiguous");
    }
    cursor = string(response.cursor);
    if (!cursor) { complete = true; break; }
  }
  // A partial scan can never prove uniqueness, even when one match was found.
  if (!complete) throw new CglSquareError("Square checkout recovery needs administrator reconciliation before another payment.", 409, "square_recovery_limit");
  const match = [...candidates.entries()][0];
  if (!match) throw new CglSquareError("The original Square checkout could not yet be verified. CGS must reconcile the saved request before another payment.", 409, "square_recovery_unmatched");
  const [linkId, orderId] = match;
  const link = object((await squareRequest(`/online-checkout/payment-links/${encodeURIComponent(linkId)}`)).payment_link);
  const options = object(link.checkout_options), url = string(link.url);
  if (link.id !== linkId || link.order_id !== orderId || !url || !isCglSquareCheckoutUrl(url)
    || options.redirect_url !== redirectUrl || (checkout.recurring ? options.subscription_plan_id !== checkout.square_plan_variation_id : options.subscription_plan_id != null)) {
    invalid("The recovered Square checkout options differ from this CGL purchase.");
  }
  const order = object((await squareRequest(`/orders/${encodeURIComponent(orderId)}`)).order);
  verifyRecoveredCheckoutOrder(checkout, order, orderId);
  const { error } = await getSupabaseAdmin().rpc("cgl_attach_square_checkout", { p_intent_id: checkout.id, p_link_id: linkId, p_order_id: orderId, p_url: url });
  if (error) throw new CglSquareError("The original Square checkout was found but could not be saved. Retry this same request safely.", 503, "square_recovery_save_failed");
  if (order.state === "COMPLETED" || order.state === "CANCELED") invalid("The original Square checkout has already finished. Reconcile its saved result before another purchase.");
  requireUnpaidCheckoutOrder(order);
  return url;
}
export async function createCglSquareCheckout(
  checkout: CglSquareCheckout,
  options: { guestAccessKey?: string } = {},
) {
  const config = getConfig(true);
  const environment = checkout.environment ?? config.environment;
  if (environment !== config.environment) invalid("The saved checkout belongs to a different Square environment.");
  const channel = checkout.checkout_channel ?? "account";
  const guestAccessKey = options.guestAccessKey;
  if (channel === "guest" && !/^[A-Za-z0-9_-]{43}$/.test(guestAccessKey ?? "")) {
    invalid("A valid guest checkout return key is required.");
  }
  if (channel === "account" && guestAccessKey) {
    invalid("An account checkout cannot use a guest return key.");
  }
  const redirect = new URL(channel === "guest" ? "/cgl/join" : "/cgl/dashboard", config.notificationUrl);
  redirect.searchParams.set("checkout", checkout.id);
  if (guestAccessKey) redirect.searchParams.set("guest", guestAccessKey);
  const redirectUrl = redirect.href;
  if (environment === "production" && checkout.recurring && !getCglSquareReadiness().subscriptionActionsEnabled) {
    throw new CglSquareError("Recurring Square membership checkout is not yet enabled. Choose a one-off option or contact CGS.", 409, "square_recurring_disabled");
  }
  await verifyCglSquareConnection();
  if (checkout.payment_link_url) {
    if (!checkout.square_link_id || !checkout.square_order_id || !isCglSquareCheckoutUrl(checkout.payment_link_url, environment)) invalid("The stored checkout needs reconciliation before reuse.");
    const link = object((await squareRequest(`/online-checkout/payment-links/${encodeURIComponent(checkout.square_link_id)}`)).payment_link);
    const savedOptions = object(link.checkout_options);
    if (link.id !== checkout.square_link_id || link.order_id !== checkout.square_order_id || !string(link.url) || !isCglSquareCheckoutUrl(String(link.url), environment) || (channel === "guest" ? savedOptions.redirect_url !== redirectUrl : Boolean(savedOptions.redirect_url) && savedOptions.redirect_url !== redirectUrl)) invalid("The saved Square checkout is unavailable.");
    const order = object((await squareRequest(`/orders/${encodeURIComponent(checkout.square_order_id)}`)).order), proof = checkoutLinkFromOrder(order);
    if (!proof || proof.order_id !== checkout.square_order_id || proof.intent_id !== checkout.id || proof.member_id !== checkout.member_id || proof.membership_id !== checkout.membership_id || order.state === "COMPLETED" || order.state === "CANCELED") invalid("The saved checkout is no longer payable. Reconcile its result before another.");
    requireUnpaidCheckoutOrder(order);
    return String(link.url);
  }
  let catalogItemVariationId: string | null = null;
  if (checkout.recurring) {
    ({ catalogItemVariationId } = await retrieveVariation(checkout.square_plan_variation_id!, checkout));
  }
  let response: Data;
  try {
    response = await squareRequest("/online-checkout/payment-links", { method: "POST", body: JSON.stringify(buildCglSquareCheckout(checkout, config.locationId, redirectUrl, catalogItemVariationId ? { id: catalogItemVariationId } : null)) });
  } catch (error) {
    if (error instanceof CglSquareError && error.code === "square_idempotency_reused") return recoverCglSquareCheckout(checkout, redirectUrl);
    throw error;
  }
  const link = object(response.payment_link), url = string(link.url), orderId = string(link.order_id);
  if (!url || !isCglSquareCheckoutUrl(url, environment) || !string(link.id) || !orderId) throw new CglSquareError("Square returned an incomplete checkout. Reconcile the saved request before another payment.", 502, "square_invalid_record");
  const createdOrder = object((await squareRequest(`/orders/${encodeURIComponent(orderId)}`)).order);
  const proof = checkoutLinkFromOrder(createdOrder);
  if (!proof || proof.order_id !== orderId || proof.intent_id !== checkout.id || proof.member_id !== checkout.member_id || proof.membership_id !== checkout.membership_id) invalid("Square did not preserve the CGL checkout identity.");
  verifyRecoveredCheckoutOrder(checkout, createdOrder, orderId);
  const { error } = await getSupabaseAdmin().rpc("cgl_attach_square_checkout", { p_intent_id: checkout.id, p_link_id: link.id, p_order_id: orderId, p_url: url });
  if (error) throw new CglSquareError("The checkout could not be saved. Retry the same request to recover it safely.");
  return url;
}

/** Close an unpaid checkout whose accepted terms no longer match the published
 * version. Square is cancelled first so a retired local intent can never leave
 * a payable provider link behind. */
export async function retireStaleCglSquareCheckout(checkout: CglSquareCheckout) {
  const config = getConfig(true);
  const environment = checkout.environment ?? config.environment;
  const acceptedTerms = string(object(checkout.terms_snapshot).terms_version);
  if (environment !== config.environment) invalid("The saved checkout belongs to a different Square environment.");
  if (acceptedTerms === CGL_MEMBERSHIP_TERMS_VERSION) invalid("The saved checkout already uses the current membership terms.");

  await verifyCglSquareConnection();
  if (checkout.square_order_id) {
    const orderId = checkout.square_order_id;
    let order = object((await squareRequest(`/orders/${encodeURIComponent(orderId)}`)).order);
    verifyRecoveredCheckoutOrder(checkout, order, orderId);
    if (order.state === "COMPLETED") {
      throw new CglSquareError(
        "This Square checkout may already be paid. Refresh billing before another purchase.",
        409,
        "square_checkout_payment_recorded",
      );
    }
    requireUnpaidCheckoutOrder(order);
    if (order.state !== "CANCELED") {
      if (!checkout.square_link_id) invalid("The stale Square checkout link is incomplete.");
      const linkId = checkout.square_link_id;
      const link = object((await squareRequest(`/online-checkout/payment-links/${encodeURIComponent(linkId)}`)).payment_link);
      if (link.id !== linkId || link.order_id !== orderId) invalid("The stale Square checkout link does not match its order.");
      const retired = await squareRequest(`/online-checkout/payment-links/${encodeURIComponent(linkId)}`, { method: "DELETE" });
      if (retired.id !== linkId || retired.cancelled_order_id !== orderId) invalid("Square did not confirm the stale checkout cancellation.");
      order = object((await squareRequest(`/orders/${encodeURIComponent(orderId)}`)).order);
      verifyRecoveredCheckoutOrder(checkout, order, orderId);
      if (order.state !== "CANCELED") invalid("Square did not cancel the stale checkout order.");
    }
  } else if (checkout.square_link_id || checkout.payment_link_url) {
    invalid("The stale Square checkout is missing its verified order.");
  }

  const { data, error } = await getSupabaseAdmin().rpc("cgl_retire_stale_square_checkout", {
    p_intent_id: checkout.id,
    p_member_id: checkout.member_id,
    p_environment: environment,
    p_current_terms_version: CGL_MEMBERSHIP_TERMS_VERSION,
  });
  const result = object(data);
  if (error || result.state !== "cancelled") {
    throw new CglSquareError(
      "The old Square checkout was closed but its CGL record still needs reconciliation.",
      503,
      "square_retirement_save_failed",
    );
  }
  return result;
}

export function normalizeCglSquarePayment(value: unknown) {
  const payment = object(value), money = object(payment.amount_money), amount = integer(money.amount), refunded = integer(object(payment.refunded_money).amount ?? 0);
  const fees = list(payment.processing_fee).map(fee => integer(object(object(fee).amount_money).amount));
  if (!string(payment.id) || amount === null || refunded === null || refunded > amount || fees.some(fee => fee === null)) throw new CglSquareError("Square returned an invalid payment record.", 502, "square_invalid_record");
  return { id: String(payment.id), order_id: string(payment.order_id), customer_id: string(payment.customer_id), location_id: string(payment.location_id), state: string(payment.status) ?? "UNKNOWN", amount_cents: amount, refunded_cents: refunded, currency: string(money.currency), fee_cents: fees.reduce<number>((sum, fee) => sum + (fee ?? 0), 0), paid_at: string(object(object(payment.card_details).card_payment_timeline).captured_at) ?? string(payment.updated_at), updated_at: string(payment.updated_at), version_token: string(payment.version_token), intent_id: null as string | null, invoice_id: null as string | null, subscription_id: null as string | null, receipt_url: string(payment.receipt_url) };
}
type NormalizedPayment = ReturnType<typeof normalizeCglSquarePayment>;
function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}
/** Local calendar dates retain the ORIGINAL monthly/annual anniversary. */
export function getCglSquareBillingBoundary(startDate: string, planCode: string, cycle: number): string {
  const start = parseDate(startDate);
  if (!start || !Number.isSafeInteger(cycle) || cycle < 0 || cycle > 6000 || !PLAN_CADENCES[planCode]) invalid("Invalid Square billing calendar.");
  if (planCode === "weekly") return new Date(start.getTime() + cycle * 7 * 86_400_000).toISOString().slice(0, 10);
  const target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + cycle * (planCode === "annual" ? 12 : 1), 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(start.getUTCDate(), lastDay));
  return target.toISOString().slice(0, 10);
}
function cycleForDate(startDate: string, date: string, planCode: string): number | null {
  const start = parseDate(startDate), current = parseDate(date);
  if (!start || !current) return null;
  const months = (current.getUTCFullYear() - start.getUTCFullYear()) * 12 + current.getUTCMonth() - start.getUTCMonth();
  const cycle = planCode === "weekly" ? (current.getTime() - start.getTime()) / (7 * 86_400_000) : months / (planCode === "annual" ? 12 : 1);
  return Number.isSafeInteger(cycle) && cycle >= 0 && cycle < 6000 && getCglSquareBillingBoundary(startDate, planCode, cycle) === date ? cycle : null;
}
function anchoredMonthlyPeriod(startDate: string, dueDate: string, anchor: number) {
  const start = parseDate(startDate), due = parseDate(dueDate);
  if (!start || !due || anchor < 1 || anchor > 28 || due < start) return null;
  const boundary = (year: number, month: number) => new Date(Date.UTC(year, month, anchor));
  const sameMonth = boundary(start.getUTCFullYear(), start.getUTCMonth());
  const firstAnchor = sameMonth > start ? sameMonth : boundary(start.getUTCFullYear(), start.getUTCMonth() + 1);
  if (due.getTime() === start.getTime()) {
    const end = start.getUTCDate() === anchor
      ? boundary(start.getUTCFullYear(), start.getUTCMonth() + 1)
      : firstAnchor;
    return { cycle: 0, start: startDate, end: end.toISOString().slice(0, 10), prorated: start.getUTCDate() !== anchor };
  }
  if (due.getUTCDate() !== anchor || due < firstAnchor) return null;
  const months = (due.getUTCFullYear() - firstAnchor.getUTCFullYear()) * 12 + due.getUTCMonth() - firstAnchor.getUTCMonth();
  if (!Number.isSafeInteger(months) || months < 0 || months > 6000) return null;
  const end = boundary(due.getUTCFullYear(), due.getUTCMonth() + 1);
  return { cycle: months + 1, start: dueDate, end: end.toISOString().slice(0, 10), prorated: false };
}
function normalizeInvoice(value: Data) {
  assertLocation(value);
  return { id: string(value.id), order_id: string(value.order_id), subscription_id: string(value.subscription_id), customer_id: string(object(value.primary_recipient).customer_id), status: string(value.status), version: integer(value.version), updated_at: string(value.updated_at), created_at: string(value.created_at), scheduled_at: string(value.scheduled_at), timezone: string(value.timezone), payment_requests: list(value.payment_requests).map(request => { const item = object(request), computed = object(item.computed_amount_money), completed = object(item.total_completed_amount_money); return { request_type: string(item.request_type), due_date: string(item.due_date), computed_amount_cents: integer(computed.amount), completed_amount_cents: integer(completed.amount), currency: string(computed.currency), completed_currency: string(completed.currency), automatic_payment_source: string(item.automatic_payment_source) }; }), payment_ids: [] as string[], period_start_date: null as string | null, period_end_date_exclusive: null as string | null, paid: false, amount_cents: 0, completed_cents: 0, currency: null as string | null };
}
type NormalizedInvoice = ReturnType<typeof normalizeInvoice>;
/** Neither ACTIVE, invoiced-through, successful payment count nor payment time proves a paid period. */
export function deriveCglSquareCoverage(subscription: Data, variation: Data, invoices: NormalizedInvoice[], events: Data[], complete: boolean, expected?: { planCode: string; amountCents: number }) {
  const variationData = object(variation.subscription_plan_variation_data);
  const phase = object(list(variationData.phases)[0]);
  const planCode = expected?.planCode ?? Object.keys(PLAN_CADENCES).find(code => PLAN_CADENCES[code] === phase.cadence);
  const override = object(subscription.price_override_money);
  const amount = expected?.amountCents ?? integer(phaseMoney(phase).amount) ?? integer(override.amount);
  const unsupported = (reason: string) => ({ billing_supported: false, coverage_complete: complete, paid_through_date_exclusive: null, next_billing_date: null, coverage_reason: reason });
  if (relativePricing(phase) && !expected) return unsupported("missing_checkout_expectation");
  if (!planCode || amount === null || !parseDate(subscription.start_date) || !canonicalTimezone(subscription.timezone)) return unsupported("unsupported_billing_calendar");
  try { validateCglSquareVariation(variation, { plan_code: planCode, amount_cents: amount }); } catch { return unsupported("unsupported_billing_variation"); }
  const startDate = String(subscription.start_date), startDay = parseDate(startDate)!.getUTCDate();
  const variationAnchor = integer(variationData.monthly_billing_anchor_date);
  const subscriptionAnchor = integer(subscription.monthly_billing_anchor_date);
  const expectedAnchor = variationAnchor ?? startDay;
  if ((subscription.monthly_billing_anchor_date != null && subscriptionAnchor !== expectedAnchor)
    || (variationAnchor !== null && planCode !== "monthly")
    || (subscription.tax_percentage != null && Number(subscription.tax_percentage) !== 0)
    || (subscription.price_override_money != null && (override.amount !== amount || override.currency !== "AUD"))) return unsupported("subscription_billing_changed");
  const safeEvents = ["START_SUBSCRIPTION", "STOP_SUBSCRIPTION", "CANCEL_SUBSCRIPTION", "DEACTIVATE_SUBSCRIPTION", "COMPLETE_SUBSCRIPTION"];
  if (!complete || events.some(event => !safeEvents.includes(String(event.subscription_event_type))) || list(subscription.actions).some(action => object(action).type !== "CANCEL")) return unsupported("billing_history_requires_review");
  const paidCycles = new Map<number, string>();
  let inconsistent = false;
  for (const invoice of invoices) {
    const request = invoice.payment_requests[0];
    const anchored = planCode === "monthly" && variationAnchor !== null && request?.due_date
      ? anchoredMonthlyPeriod(startDate, request.due_date, variationAnchor)
      : null;
    const cycle = anchored?.cycle ?? (request?.due_date ? cycleForDate(startDate, request.due_date, planCode) : null);
    const invoiceAmount = request?.computed_amount_cents ?? null;
    const amountMatches = anchored?.prorated ? invoiceAmount !== null && invoiceAmount > 0 && invoiceAmount <= amount : invoiceAmount === amount;
    if (invoice.subscription_id !== subscription.id || invoice.customer_id !== subscription.customer_id || canonicalTimezone(invoice.timezone) !== canonicalTimezone(subscription.timezone) || invoice.payment_requests.length !== 1 || request?.request_type !== "BALANCE" || cycle === null || !amountMatches || request.currency !== "AUD") { inconsistent = true; continue; }
    invoice.period_start_date = anchored?.start ?? getCglSquareBillingBoundary(startDate, planCode, cycle);
    invoice.period_end_date_exclusive = anchored?.end ?? getCglSquareBillingBoundary(startDate, planCode, cycle + 1);
    invoice.amount_cents = invoiceAmount!; invoice.completed_cents = request.completed_amount_cents ?? 0; invoice.currency = request.currency;
    invoice.paid = invoice.status === "PAID" && request.completed_currency === "AUD" && invoice.completed_cents === invoiceAmount && invoice.payment_ids.length > 0;
    if (invoice.paid) {
      if (paidCycles.has(cycle)) inconsistent = true;
      paidCycles.set(cycle, invoice.period_end_date_exclusive);
    }
  }
  if (inconsistent) return unsupported("invoice_period_requires_review");
  let throughCycle = 0;
  while (paidCycles.has(throughCycle)) throughCycle += 1;
  const gap = [...paidCycles.keys()].some(cycle => cycle >= throughCycle);
  const paidThrough = throughCycle ? paidCycles.get(throughCycle - 1) ?? null : null;
  const invoicedThrough = parseDate(subscription.charged_through_date), nextDate = invoicedThrough ? new Date(invoicedThrough.getTime() + 86_400_000).toISOString().slice(0, 10) : null;
  return { billing_supported: true, coverage_complete: complete, paid_through_date_exclusive: paidThrough, next_billing_date: subscription.status === "ACTIVE" && !subscription.canceled_date && !list(subscription.actions).some(action => object(action).type === "CANCEL") ? nextDate : null, coverage_reason: gap ? "unpaid_billing_gap" : paidThrough ? null : "no_verified_paid_invoice" };
}
function templateIds(subscription: Data) { return [...new Set([string(subscription.order_template_id), ...list(subscription.phases).map(phase => string(object(phase).order_template_id))].filter((id): id is string => Boolean(id)))]; }
async function fetchSubscription(id: string) {
  const subscription = object((await squareRequest(`/subscriptions/${encodeURIComponent(id)}?include=actions`)).subscription);
  assertLocation(subscription);
  if (subscription.id !== id || !string(subscription.customer_id) || !string(subscription.plan_variation_id)) invalid("The Square subscription identity is incomplete.");
  return subscription;
}
async function subscriptionLink(subscription: Data): Promise<CheckoutLink | null> {
  let link: CheckoutLink | null = null;
  for (const id of templateIds(subscription)) {
    const order = object((await squareRequest(`/orders/${encodeURIComponent(id)}`)).order);
    if (order.id !== id) invalid("The Square template order identity does not match.");
    const candidate = checkoutLinkFromOrder(order, subscription);
    if (candidate && link && candidate.intent_id !== link.intent_id) invalid("The Square subscription references conflicting CGL checkouts.");
    if (candidate) link = candidate;
  }
  return link;
}
async function checkoutExpectation(link: CheckoutLink | null, subscription: Data) {
  if (!link) return null;
  const environment = getCglSquareReadiness().environment;
  const { data, error } = await getSupabaseAdmin()
    .from("cgl_square_checkout_intents")
    .select("id,member_id,membership_id,environment,plan_code,amount_cents,recurring,square_plan_variation_id")
    .eq("id", link.intent_id)
    .eq("environment", environment)
    .maybeSingle();
  if (error || !data) return null;
  if (data.member_id !== link.member_id || data.membership_id !== link.membership_id || data.recurring !== true
    || data.square_plan_variation_id !== subscription.plan_variation_id || !PLAN_CADENCES[data.plan_code]
    || !Number.isSafeInteger(data.amount_cents) || data.amount_cents < 1) {
    invalid("The Square subscription differs from its saved CGL checkout.");
  }
  return { planCode: String(data.plan_code), amountCents: Number(data.amount_cents) };
}
async function searchSubscriptions(customerId?: string) {
  const config = getConfig(false, false), subscriptions: Data[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 5; page += 1) {
    const response = await squareRequest("/subscriptions/search", { method: "POST", body: JSON.stringify({ query: { filter: { ...(customerId ? { customer_ids: [customerId] } : {}), location_ids: [config.locationId] } }, include: ["actions"], ...(cursor ? { cursor } : {}) }) });
    for (const value of list(response.subscriptions)) { const subscription = object(value); assertLocation(subscription); if (customerId && subscription.customer_id !== customerId) invalid("Square returned a subscription for a different customer."); subscriptions.push(subscription); }
    cursor = string(response.cursor);
    if (!cursor) return subscriptions;
  }
  throw new CglSquareError("Square customer history requires a smaller reconciliation batch.", 503, "square_history_limit");
}
async function findSubscriptionForPayment(payment: NormalizedPayment) {
  if (!payment.customer_id || !payment.order_id) return null;
  let match: Data | null = null;
  for (const candidate of await searchSubscriptions(payment.customer_id)) {
    if (!string(candidate.id)) continue;
    const subscription = await fetchSubscription(String(candidate.id)), link = await subscriptionLink(subscription);
    if (!link) continue;
    let matches = link.order_id === payment.order_id;
    for (const id of list(subscription.invoice_ids)) {
      if (typeof id !== "string") invalid("Square returned an invalid subscription invoice identity.");
      const invoice = object((await squareRequest(`/invoices/${encodeURIComponent(id)}`)).invoice); assertLocation(invoice);
      if (invoice.subscription_id !== subscription.id) invalid("The Square invoice references a different subscription.");
      if (invoice.order_id === payment.order_id) matches = true;
    }
    if (matches) { if (match && match.id !== subscription.id) invalid("The payment matches more than one CGL subscription."); match = subscription; }
  }
  return match;
}
async function subscriptionEvents(id: string) {
  const events: Data[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 5; page += 1) {
    const query = new URLSearchParams({ limit: "100", ...(cursor ? { cursor } : {}) });
    const response = await squareRequest(`/subscriptions/${encodeURIComponent(id)}/events?${query}`);
    events.push(...list(response.subscription_events).map(object)); cursor = string(response.cursor);
    if (!cursor) return { events, complete: true };
  }
  return { events, complete: false };
}
async function hydrateEvent(kind: string, objectId: string | null, timezone: string) {
  const environment = getConfig(false, false).environment;
  const payments = new Map<string, NormalizedPayment>(), invoices = new Map<string, NormalizedInvoice>();
  let subscription: Data | null = null, checkoutLink: CheckoutLink | null = null, invoiceOrderId: string | null = null;
  const readPayment = async (id: string) => {
    const value = object((await squareRequest(`/payments/${encodeURIComponent(id)}`)).payment); assertLocation(value);
    if (value.id !== id) invalid("The Square payment identity does not match.");
    const payment = normalizeCglSquarePayment(value); payments.set(payment.id, payment); return payment;
  };
  const readInvoice = async (id: string) => {
    const value = object((await squareRequest(`/invoices/${encodeURIComponent(id)}`)).invoice);
    if (value.id !== id) invalid("The Square invoice identity does not match.");
    const invoice = normalizeInvoice(value);
    if (invoice.order_id) {
      const order = object((await squareRequest(`/orders/${encodeURIComponent(invoice.order_id)}`)).order); assertLocation(order);
      if (order.id !== invoice.order_id) invalid("The Square invoice order identity does not match.");
      for (const tender of list(order.tenders)) {
        const id = string(object(tender).payment_id); if (!id) continue;
        const payment = payments.get(id) ?? await readPayment(id);
        if (payment.order_id !== invoice.order_id || (payment.customer_id && payment.customer_id !== invoice.customer_id)) invalid("The Square invoice payment identity does not match.");
        payment.invoice_id = invoice.id; payment.subscription_id = invoice.subscription_id;
        if (payment.state === "COMPLETED" && payment.refunded_cents === 0 && payment.currency === "AUD") invoice.payment_ids.push(payment.id);
      }
    }
    invoices.set(id, invoice); return invoice;
  };
  if (objectId && /^payment\.(created|updated)$/.test(kind)) {
    const payment = await readPayment(objectId);
    if (payment.order_id) {
      const order = object((await squareRequest(`/orders/${encodeURIComponent(payment.order_id)}`)).order);
      if (order.id !== payment.order_id) invalid("The Square payment order identity does not match.");
      checkoutLink = checkoutLinkFromOrder(order);
      if (checkoutLink) { checkoutLink.customer_id = payment.customer_id; payment.intent_id = checkoutLink.intent_id; }
    }
    subscription = environment === "sandbox" ? await findSubscriptionForPayment(payment) : null;
  } else if (objectId && /^refund\.(created|updated)$/.test(kind)) {
    const refund = object((await squareRequest(`/refunds/${encodeURIComponent(objectId)}`)).refund);
    if (refund.id !== objectId || (refund.location_id != null && refund.location_id !== getConfig(false, false).locationId)) invalid("The Square refund identity does not match.");
    if (string(refund.payment_id)) {
      const payment = await readPayment(String(refund.payment_id));
      if (payment.order_id) {
        const order = object((await squareRequest(`/orders/${encodeURIComponent(payment.order_id)}`)).order);
        if (order.id !== payment.order_id) invalid("The Square refund order identity does not match.");
        checkoutLink = checkoutLinkFromOrder(order);
        if (checkoutLink) { checkoutLink.customer_id = payment.customer_id; payment.intent_id = checkoutLink.intent_id; }
      }
      subscription = environment === "sandbox" ? await findSubscriptionForPayment(payment) : null;
    }
  } else if (objectId && /^subscription\.(created|updated)$/.test(kind)) {
    if (environment === "production" && !getCglSquareReadiness().subscriptionActionsEnabled) throw new CglSquareError("Production subscription processing is not enabled.", 409, "square_recurring_disabled");
    subscription = await fetchSubscription(objectId);
  } else if (objectId && /^invoice\./.test(kind)) {
    if (environment === "production" && !getCglSquareReadiness().subscriptionActionsEnabled) throw new CglSquareError("Production subscription processing is not enabled.", 409, "square_recurring_disabled");
    const invoice = await readInvoice(objectId); invoiceOrderId = invoice.order_id; if (invoice.subscription_id) subscription = await fetchSubscription(invoice.subscription_id);
  }
  let normalizedSubscription: Data | null = null;
  if (subscription) {
    if (canonicalTimezone(subscription.timezone) !== canonicalTimezone(timezone)) invalid("The Square subscription timezone differs from its verified location.");
    const actualLink = await subscriptionLink(subscription);
    if (actualLink && checkoutLink && actualLink.intent_id !== checkoutLink.intent_id) invalid("Conflicting Square checkout provenance.");
    checkoutLink = actualLink ?? checkoutLink;
    const ids = list(subscription.invoice_ids);
    if (ids.length > 200) throw new CglSquareError("Square billing history requires manual batching.", 503, "square_history_limit");
    for (const id of ids) {
      if (typeof id !== "string") invalid("The Square subscription invoice identity is invalid.");
      const invoice = invoices.get(id) ?? await readInvoice(id);
      if (invoice.subscription_id !== subscription.id || invoice.customer_id !== subscription.customer_id) invalid("The Square invoice is outside this subscription.");
    }
    const expected = await checkoutExpectation(checkoutLink, subscription);
    const { variation } = await retrieveVariation(
      String(subscription.plan_variation_id),
      expected ? { plan_code: expected.planCode, amount_cents: expected.amountCents } : undefined,
    );
    const history = await subscriptionEvents(String(subscription.id));
    const coverage = deriveCglSquareCoverage(subscription, variation, [...invoices.values()].filter(invoice => invoice.subscription_id === subscription!.id), history.events, history.complete, expected ?? undefined);
    for (const payment of payments.values()) if (payment.subscription_id === subscription.id || (checkoutLink && payment.order_id === checkoutLink.order_id)) { payment.intent_id = checkoutLink?.intent_id ?? null; payment.subscription_id = String(subscription.id); }
    normalizedSubscription = { id: string(subscription.id), customer_id: string(subscription.customer_id), plan_variation_id: string(subscription.plan_variation_id), state: string(subscription.status), start_date: string(subscription.start_date), charged_through_date: string(subscription.charged_through_date), paid_until_date: string(subscription.paid_until_date), canceled_date: string(subscription.canceled_date), timezone: string(subscription.timezone), version: integer(subscription.version), actions: list(subscription.actions).map(action => ({ type: string(object(action).type), effective_date: string(object(action).effective_date) })), template_order_ids: templateIds(subscription), intent_id: checkoutLink?.intent_id ?? null, ...coverage };
  }
  const config = getConfig(false, false);
  return { environment: config.environment, merchant_id: config.merchantId, location_id: config.locationId, payments: [...payments.values()], subscription: normalizedSubscription, invoices: [...invoices.values()], checkout_link: checkoutLink, invoice_failed: /^invoice\.(scheduled_charge_failed|payment_failed)$/.test(kind), invoice_order_id: invoiceOrderId };
}
async function deadline<T>(promise: PromiseLike<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([Promise.resolve(promise), new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new CglSquareError("The Square event could not be saved yet. Square will retry safely.", 503, "square_queue_unavailable")), milliseconds); })]); } finally { clearTimeout(timer); }
}
/** Verify and durably enqueue only: no Square API reads before acknowledgement. */
export async function receiveCglSquareWebhook(rawBody: string, signature: string | null, environmentHeader: string | null) {
  const config = getConfig();
  if (!verifyCglSquareSignature(rawBody, signature, config.signatureKey, config.notificationUrl)) throw new CglSquareError("Invalid Square webhook signature.", 401, "square_invalid_signature");
  if (environmentHeader && environmentHeader.toLowerCase() !== config.environment) throw new CglSquareError(`Only Square ${config.environment} notifications are accepted.`, 400, "square_wrong_environment");
  let parsed: unknown;
  try { parsed = JSON.parse(rawBody); } catch { throw new CglSquareError("Invalid Square notification.", 400, "square_invalid_event"); }
  const event = object(parsed), data = object(event.data);
  if (!string(event.event_id) || String(event.event_id).length > 200 || !string(event.type) || !string(event.created_at) || !Number.isFinite(Date.parse(String(event.created_at)))) invalid("The Square event identity does not match.");
  // Square's signed subscription test uses a fixed US sample payment rather than
  // the connected seller. Acknowledge that exact fixture without storing it.
  if (event.merchant_id !== config.merchantId) {
    if (isSquareSubscriptionTestEvent(event)) return { event_id: String(event.event_id), eventId: String(event.event_id), test: true };
    invalid("The Square merchant or event identity does not match.");
  }
  const enqueueRpc = config.environment === "sandbox" ? "cgl_enqueue_square_event" : "cgl_enqueue_square_live_event";
  const { data: result, error } = await deadline(getSupabaseAdmin().rpc(enqueueRpc, { p_event_id: event.event_id, p_event_type: event.type, p_occurred_at: event.created_at, p_body_hash: createHash("sha256").update(rawBody).digest("hex"), p_event_data: { environment: config.environment, merchant_id: config.merchantId, object_id: string(data.id), object_type: string(data.type) } }), 6000);
  if (error || !result) throw new CglSquareError("The Square event could not be saved. Square will retry safely.", 503, "square_queue_unavailable");
  return { ...object(result), event_id: String(event.event_id), eventId: String(event.event_id) };
}
/** Run after the response, and from authenticated maintenance retries. */
export async function processQueuedCglSquareEvents({ eventId, limit = 1 }: { eventId?: string; limit?: number } = {}) {
  const startedAt = Date.now();
  getConfig();
  const connection = await verifyCglSquareConnection();
  const results: Data[] = [];
  const maximum = eventId ? 1 : Number.isFinite(limit) ? Math.min(10, Math.max(1, Math.trunc(limit))) : 1;
  // Lease only the event we are about to hydrate. Other queued events must not
  // lose their lease while this event's provider history is being retrieved.
  for (let attempt = 0; attempt < maximum && Date.now() - startedAt < 40_000; attempt += 1) {
    const claimRpc = connection.environment === "sandbox" ? "cgl_claim_square_events" : "cgl_claim_square_live_events";
    const claimArgs = connection.environment === "sandbox"
      ? { p_event_id: eventId ?? null, p_limit: 1 }
      : { p_event_id: eventId ?? null, p_limit: 1, p_environment: connection.environment };
    const { data: jobs, error } = await getSupabaseAdmin().rpc(claimRpc, claimArgs);
    if (error) throw new CglSquareError("The Square reconciliation queue is unavailable.", 503, "square_queue_unavailable");
    const item = list(jobs)[0];
    if (!item) break;
    const job = object(item), identity = object(job.event_data);
    try {
      if (identity.environment !== connection.environment || identity.merchant_id !== connection.merchantId || !string(job.lease_token)) invalid("The queued Square event identity does not match.");
      const normalized = await hydrateEvent(String(job.event_type), string(identity.object_id), connection.timezone);
      const reconcileRpc = connection.environment === "sandbox" ? "cgl_reconcile_square_event" : "cgl_reconcile_square_live_event";
      const { data: result, error: reconcileError } = await getSupabaseAdmin().rpc(reconcileRpc, { p_event_id: job.event_id, p_event_type: job.event_type, p_occurred_at: job.occurred_at, p_body_hash: job.body_hash, p_normalized: normalized, p_lease_token: job.lease_token });
      if (reconcileError) throw new CglSquareError("Square notification requires reconciliation retry.", 503, "square_reconciliation_failed");
      results.push({ event_id: job.event_id, ...object(result) });
    } catch (error) {
      const code = error instanceof CglSquareError ? error.code : "square_reconciliation_failed", retryable = ["square_unavailable", "square_queue_unavailable", "square_reconciliation_failed"].includes(code);
      const { error: queueError } = await getSupabaseAdmin().rpc("cgl_fail_square_event", { p_event_id: job.event_id, p_lease_token: job.lease_token, p_error_code: code, p_retryable: retryable });
      if (queueError) throw new CglSquareError("The Square retry state could not be saved. Its lease will expire safely.", 503, "square_queue_unavailable");
      results.push({ event_id: job.event_id, state: retryable ? "retry" : "review", error_code: code });
    }
  }
  return { processed: results.filter(result => result.state === "reconciled" || result.state === "ignored").length, results };
}
/** Compatibility for server callers. HTTP webhooks must use receive + after(). */
export async function processCglSquareWebhook(rawBody: string, signature: string | null, environmentHeader: string | null) {
  const received = await receiveCglSquareWebhook(rawBody, signature, environmentHeader), processed = await processQueuedCglSquareEvents({ eventId: received.event_id });
  return processed.results[0] ?? received;
}
/** The route supplies its authenticated member UUID; provider IDs are never client input. */
export async function syncCglSquareMember(memberId: string, checkoutId?: string) {
  if (!UUID.test(memberId) || (checkoutId && !UUID.test(checkoutId))) invalid("A verified CGL member and checkout are required.");
  const connection = await verifyCglSquareConnection(), db = getSupabaseAdmin();
  let query = db.from("cgl_square_checkout_intents").select("id,member_id,membership_id,square_order_id,recurring,state,environment").eq("member_id", memberId).eq("environment", connection.environment).order("created_at", { ascending: false }).limit(5);
  if (checkoutId) query = query.eq("id", checkoutId);
  const { data: intents, error } = await query;
  if (error) throw new CglSquareError("Your CGL billing history could not be checked.");
  const checkouts: { id: string; state: string }[] = [];
  for (const item of intents ?? []) {
    if (!item.square_order_id) { checkouts.push({ id: item.id, state: "pending" }); continue; }
    const order = object((await squareRequest(`/orders/${encodeURIComponent(item.square_order_id)}`)).order), proof = checkoutLinkFromOrder(order);
    if (!proof || proof.order_id !== item.square_order_id || proof.intent_id !== item.id || proof.member_id !== memberId || proof.membership_id !== item.membership_id) invalid("Your saved Square checkout identity needs review.");
    if (!item.recurring) {
      const paymentId = string(object(list(order.tenders)[0]).payment_id);
      if (!paymentId) { checkouts.push({ id: item.id, state: "pending" }); continue; }
      checkouts.push({ id: item.id, state: await enqueueMemberSync("payment.updated", paymentId, connection.merchantId) }); continue;
    }
    if (connection.environment === "production" && !getCglSquareReadiness().subscriptionActionsEnabled) {
      checkouts.push({ id: item.id, state: "review" });
      continue;
    }
    let found: Data | null = null;
    for (const candidate of await searchSubscriptions()) {
      if (!templateIds(candidate).includes(item.square_order_id)) continue;
      const subscription = await fetchSubscription(String(candidate.id)), link = await subscriptionLink(subscription);
      if (!link || link.intent_id !== item.id || link.member_id !== memberId || link.membership_id !== item.membership_id) invalid("Your Square subscription identity needs review.");
      if (found) invalid("More than one Square subscription needs reconciliation for this checkout.");
      found = subscription;
    }
    if (!found) { checkouts.push({ id: item.id, state: "pending" }); continue; }
    checkouts.push({ id: item.id, state: await enqueueMemberSync("subscription.updated", String(found.id), connection.merchantId) });
  }
  return {
    environment: connection.environment,
    status: checkouts.some(item => item.state === "review") ? "review" : "checked",
    message: connection.environment === "sandbox"
      ? "Square Sandbox billing was checked against your saved CGL checkouts. Test payments do not grant live competition access."
      : "Square billing was checked against your saved CGL checkouts. Completed payments are reflected in your membership history.",
    checkouts,
  };
}
async function enqueueMemberSync(kind: string, objectId: string, merchantId: string) {
  const eventId = `cgl-sync-${randomUUID()}`, occurred = new Date().toISOString();
  const environment = getCglSquareReadiness().environment;
  const enqueueRpc = environment === "sandbox" ? "cgl_enqueue_square_event" : "cgl_enqueue_square_live_event";
  const { error } = await getSupabaseAdmin().rpc(enqueueRpc, { p_event_id: eventId, p_event_type: kind, p_occurred_at: occurred, p_body_hash: createHash("sha256").update(`${eventId}:${kind}:${objectId}`).digest("hex"), p_event_data: { environment, merchant_id: merchantId, object_id: objectId, object_type: kind.split(".")[0] } });
  if (error) throw new CglSquareError("Your Square billing check could not be queued.");
  const result = await processQueuedCglSquareEvents({ eventId, limit: 1 });
  return String(result.results[0]?.state ?? "pending");
}
export function getCglSquareCancellationDate(value: string, squareTimezone: string) {
  if (squareTimezone !== "Australia/Brisbane") throw new CglSquareError("The Square location timezone needs cancellation review.", 409);
  const effective = new Date(value);
  if (!Number.isFinite(effective.getTime())) invalid("The cancellation boundary is invalid.");
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: squareTimezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(effective);
  if (clock !== "00:00:00" || effective.getUTCMilliseconds() !== 0) invalid("Square cancellation uses whole dates. The paid-term boundary must fall at Brisbane midnight.");
  return new Intl.DateTimeFormat("en-CA", { timeZone: squareTimezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(effective);
}
function shiftSquareDate(value: string, days: number) {
  const parsed = parseDate(value);
  if (!parsed) invalid("The Square cancellation date is invalid.");
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
/** Schedule the provider cancellation only after the member accepts the exact paid-through quote. */
export async function cancelCglSquareSubscription(
  memberId: string,
  membershipId: string,
  expectedEffectiveAt: string,
) {
  if (!UUID.test(memberId) || !UUID.test(membershipId)) invalid("A verified CGL member and membership are required.");
  const readiness = await getCglSquareOperationalReadiness();
  if (readiness.environment !== "production" || !readiness.subscriptionActionsEnabled) {
    throw new CglSquareError("Recurring membership cancellation is not available yet. No Square subscription was changed.", 409, "square_recurring_disabled");
  }
  const { data, error } = await getSupabaseAdmin()
    .from("cgl_memberships")
    .select("id,member_id,plan_code,state,paid_through,square_customer_id,square_subscription_id,metadata")
    .eq("id", membershipId)
    .eq("member_id", memberId)
    .maybeSingle();
  const membership = object(data), metadata = object(membership.metadata);
  if (error || membership.id !== membershipId || metadata.environment !== "production"
    || !string(membership.square_subscription_id) || !string(membership.square_customer_id)
    || !string(metadata.square_plan_variation_id) || !string(membership.paid_through)
    || !["active", "past_due", "cancel_scheduled"].includes(String(membership.state))) {
    throw new CglSquareError("This live recurring membership could not be verified for cancellation.", 409, "square_cancellation_unavailable");
  }
  const connection = await verifyCglSquareConnection();
  const expectedExclusiveDate = getCglSquareCancellationDate(expectedEffectiveAt, connection.timezone);
  if (getCglSquareCancellationDate(String(membership.paid_through), connection.timezone) !== expectedExclusiveDate) {
    throw new CglSquareError("The paid membership period changed. Review a fresh cancellation quote before continuing.", 409, "quote_changed");
  }
  const subscriptionId = String(membership.square_subscription_id);
  const verify = (value: Data, actions: unknown) => {
    assertLocation(value);
    if (value.id !== subscriptionId || value.customer_id !== membership.square_customer_id
      || value.plan_variation_id !== metadata.square_plan_variation_id) {
      invalid("The Square subscription differs from this CGL membership.");
    }
    const cancelAction = list(actions).map(object).find(action => action.type === "CANCEL")
      ?? list(value.actions).map(object).find(action => action.type === "CANCEL");
    const canceledDate = string(cancelAction?.effective_date) ?? string(value.canceled_date);
    if (!canceledDate || shiftSquareDate(canceledDate, 1) !== expectedExclusiveDate) {
      throw new CglSquareError("Square returned a different cancellation boundary. The subscription requires CGS billing review before another change.", 409, "square_cancellation_review");
    }
    return { canceledDate, version: integer(value.version) };
  };
  const current = await fetchSubscription(subscriptionId);
  const currentAction = list(current.actions).map(object).find(action => action.type === "CANCEL");
  let scheduled: { canceledDate: string; version: number | null };
  if (currentAction || current.canceled_date) {
    scheduled = verify(current, current.actions);
  } else {
    const response = await squareRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { method: "POST" });
    scheduled = verify(object(response.subscription), response.actions);
  }
  return {
    scheduled: true,
    alreadyScheduled: Boolean(currentAction || current.canceled_date),
    effectiveAt: expectedEffectiveAt,
    providerCanceledDate: scheduled.canceledDate,
    providerVersion: scheduled.version,
  };
}
/** Provider cancellation is scheduled immediately by the member action; this job remains a safe no-op. */
export async function processDueCglSquareCancellations() {
  return { processed: 0, scheduledAtRequest: true };
}
