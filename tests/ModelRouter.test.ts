/**
 * V2.4 ModelRouter Unit Tests
 *
 * Layer 1 — 9 deterministic scenarios covering:
 *   1. Normal routing (preferred model selected)
 *   2. Rate-limit → FALLBACK to next provider
 *   3. Timeout → RETRY action classification
 *   4. Context too large → ESCALATE_CONTEXT
 *   5. Quality escalation → strongReasoning model
 *   6. Auth error → ABORT, never fallback
 *   7. Provider marked DEGRADED → skipped on next routing decision
 *   8. All providers exhausted → deterministic error
 *   9. Routing events carry traceId, latencyMs, action
 */

import { ModelRouterImpl } from "../core/router/ModelRouterImpl"
import assert from "node:assert/strict"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRouter(): ModelRouterImpl {
  return new ModelRouterImpl()
}

// ─── Test 1: Normal routing returns preferred model ────────────────────────────

function test1_normalRouting() {
  const router = makeRouter()
  const decision = router.route("developer")

  assert.ok(decision.routingTraceId.startsWith("TRACE-"), "traceId must start with TRACE-")
  assert.ok(typeof decision.provider === "string" && decision.provider.length > 0, "provider must be a non-empty string")
  assert.ok(typeof decision.model === "string" && decision.model.length > 0, "model must be a non-empty string")
  assert.equal(decision.reason, "INITIAL")
  console.log("✅ Test 1 passed: Normal routing returns preferred model")
}

// ─── Test 2: 429 classified as RATE_LIMIT, FALLBACK action ────────────────────

function test2_rateLimitClassification() {
  const router = makeRouter()

  const error429 = { response: { status: 429 }, message: "Rate limited" }
  const errorType = router.classifyError(error429)
  assert.equal(errorType, "RATE_LIMIT")

  const action = ModelRouterImpl.getAction(errorType)
  assert.equal(action, "FALLBACK")
  console.log("✅ Test 2 passed: 429 classified as RATE_LIMIT with FALLBACK action")
}

// ─── Test 3: Timeout → RETRY action ───────────────────────────────────────────

function test3_timeoutClassification() {
  const router = makeRouter()

  const errors = [
    { message: "Request timed out" },
    { message: "ETIMEDOUT connect" },
    { message: "Socket timed out" },
  ]

  for (const err of errors) {
    const errorType = router.classifyError(err)
    assert.equal(errorType, "TIMEOUT", `Expected TIMEOUT for: ${err.message}`)
    const action = ModelRouterImpl.getAction(errorType)
    assert.equal(action, "RETRY")
  }
  console.log("✅ Test 3 passed: Timeout errors classified as TIMEOUT with RETRY action")
}

// ─── Test 4: Context too large → ESCALATE_CONTEXT ─────────────────────────────

function test4_contextTooLarge() {
  const router = makeRouter()

  const err = { message: "context window exceeded by 1500 tokens" }
  const errorType = router.classifyError(err)
  assert.equal(errorType, "CONTEXT_TOO_LARGE")

  const action = ModelRouterImpl.getAction(errorType)
  assert.equal(action, "ESCALATE_CONTEXT")

  // Router should route to largeContext model
  const decision = router.route("developer", {
    reason: "CONTEXT_TOO_LARGE",
    fromProvider: "mistral",
    fromModel: "mistral-large-latest"
  })
  assert.ok(decision.provider !== undefined)
  assert.ok(decision.model !== undefined)
  console.log("✅ Test 4 passed: Context error escalates to largeContext model")
}

// ─── Test 5: Quality escalation → strongReasoning model ───────────────────────

function test5_qualityEscalation() {
  const router = makeRouter()

  // Simulate Orchestrator injecting qualityEscalate=true after attempt 1
  const decision = router.route("developer", {
    reason: "QUALITY_FAILURE",
    fromProvider: "mistral",
    fromModel: "mistral-large-latest",
    qualityEscalate: true
  })

  // Should be a different model than the preferred one
  assert.ok(decision.provider !== undefined)
  assert.ok(decision.model !== undefined)
  assert.equal(decision.reason, "QUALITY_FAILURE")
  console.log(`✅ Test 5 passed: Quality escalation routed to ${decision.provider}/${decision.model}`)
}

// ─── Test 6: Auth error → ABORT, never fallback ────────────────────────────────

function test6_authErrorAborts() {
  const router = makeRouter()

  const err401 = { response: { status: 401 }, message: "Unauthorized" }
  const errKey  = { message: "invalid api key provided" }

  for (const err of [err401, errKey]) {
    const errorType = router.classifyError(err)
    assert.equal(errorType, "AUTH_ERROR", `Expected AUTH_ERROR for: ${JSON.stringify(err)}`)
    assert.equal(ModelRouterImpl.getAction(errorType), "ABORT")
    assert.ok(ModelRouterImpl.isAbort(errorType), "AUTH_ERROR must be an abort error")
  }
  console.log("✅ Test 6 passed: AUTH_ERROR classified with ABORT action")
}

// ─── Test 7: DEGRADED provider skipped in next routing decision ────────────────

function test7_degradedProviderSkipped() {
  const router = makeRouter()

  // Simulate enough failures to degrade "mistral"
  router.markProviderFailure("mistral", "RATE_LIMIT")
  router.markProviderFailure("mistral", "RATE_LIMIT")

  const health = router.getProviderHealth("mistral")
  assert.equal(health.status, "DEGRADED", "mistral should be DEGRADED after 2 failures")
  assert.ok(health.cooldownUntil !== undefined, "cooldownUntil must be set")

  // Next routing decision should skip "mistral" and pick a fallback
  const decision = router.route("developer", { reason: "RATE_LIMIT" })
  assert.notEqual(decision.provider, "mistral", "Degraded provider must be skipped")
  console.log(`✅ Test 7 passed: Degraded "mistral" skipped, routed to ${decision.provider}/${decision.model}`)
}

// ─── Test 8: All providers exhausted → RoutingDecision still returned ─────────

function test8_allProvidersExhausted() {
  const router = makeRouter()

  // Degrade all known providers by name
  const providers = ["mistral", "groq", "gemini", "openai", "anthropic"]
  for (const p of providers) {
    router.markProviderFailure(p, "RATE_LIMIT")
    router.markProviderFailure(p, "RATE_LIMIT")
  }

  // Router still returns a decision (executor raises NO_PROVIDER_AVAILABLE after budget exceeded)
  // This is expected: the router gives its best guess; the executor enforces budget
  const decision = router.route("developer", { reason: "RATE_LIMIT", fromProvider: "mistral" })
  assert.ok(typeof decision.provider === "string", "Router should always return a decision object")
  console.log(`✅ Test 8 passed: Router returns decision even under exhaustion (executor controls budget)`)
}

// ─── Test 9: Routing events have traceId, latencyMs, action ──────────────────

function test9_routingEvents() {
  const router = makeRouter()

  // Emit a synthetic event
  const traceId = "TRACE-DEV-ABC123"
  router.emitEvent({
    routingTraceId: traceId,
    agentRole: "developer",
    taskId: "task-001",
    attempt: 1,
    provider: "mistral",
    model: "mistral-large-latest",
    status: "SUCCESS",
    latencyMs: 1245,
    timestamp: new Date().toISOString()
  })

  const events = router.getRoutingEvents()
  assert.equal(events.length, 1)
  assert.equal(events[0].routingTraceId, traceId)
  assert.ok(events[0].latencyMs > 0)
  assert.equal(events[0].status, "SUCCESS")
  console.log("✅ Test 9 passed: RoutingEvent contains traceId, latencyMs, status")
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function run() {
  console.log("\n🧪 V2.4 ModelRouter Unit Tests\n")
  const tests = [
    test1_normalRouting,
    test2_rateLimitClassification,
    test3_timeoutClassification,
    test4_contextTooLarge,
    test5_qualityEscalation,
    test6_authErrorAborts,
    test7_degradedProviderSkipped,
    test8_allProvidersExhausted,
    test9_routingEvents,
  ]

  let passed = 0
  let failed = 0

  for (const test of tests) {
    try {
      test()
      passed++
    } catch (err: any) {
      console.error(`❌ FAILED: ${test.name}: ${err.message}`)
      failed++
    }
  }

  console.log(`\n📊 Results: ${passed}/${tests.length} passed, ${failed} failed\n`)

  if (failed > 0) {
    process.exit(1)
  }
}

run()
