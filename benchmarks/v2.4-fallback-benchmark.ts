/**
 * V2.4 Integration Benchmark — Provider Fallback
 *
 * Proves that the full routing fallback path works end-to-end through
 * ProviderService without exposing the failure to the calling agent.
 *
 * Three assertions:
 *   A1. RoutingEvent[0]: provider=preferred, status=RATE_LIMIT, action=FALLBACK
 *   A2. RoutingEvent[1]: provider=fallback,  status=SUCCESS
 *   A3. Agent receives a valid response string — never sees Provider A's error
 *
 * No real API calls are made.  The injected callAIFn controls all responses.
 */

import { ProviderServiceImpl } from "../core/provider/ProviderServiceImpl"
import { ModelRouterImpl } from "../core/router/ModelRouterImpl"
import assert from "node:assert/strict"

// ─── Benchmark configuration ─────────────────────────────────────────────────

const PREFERRED_PROVIDER = "mistral"
const FALLBACK_PROVIDER  = "groq"
const AGENT_ROLE         = "developer"
const TASK_ID            = "benchmark-task-fallback-001"
const FAKE_RESPONSE      = '{"changePlan":{"create":[],"modify":[],"delete":[]},"files":[]}'

// ─── Controlled callAIFn ──────────────────────────────────────────────────────

/**
 * First call to the preferred provider throws a synthetic 429.
 * All subsequent calls (to any provider) return FAKE_RESPONSE.
 */
function makeControlledCallAI() {
  let firstCallDone = false

  return async function controlledCallAI(
    _prompt: string,
    provider: string,
    _model: string,
    _systemPrompt?: string
  ): Promise<string | null> {
    if (provider === PREFERRED_PROVIDER && !firstCallDone) {
      firstCallDone = true
      // Simulate a real Groq/Mistral 429 response shape
      const err: any = new Error("Too many requests — rate limit exceeded")
      err.response = { status: 429 }
      throw err
    }
    // All other calls succeed
    return FAKE_RESPONSE
  }
}

// ─── Benchmark runner ─────────────────────────────────────────────────────────

async function runBenchmark() {
  console.log("\n🔬 V2.4 Integration Benchmark — Provider Fallback\n")
  console.log(`   Preferred provider: ${PREFERRED_PROVIDER}`)
  console.log(`   Expected fallback:  ${FALLBACK_PROVIDER}`)
  console.log(`   Agent role:        ${AGENT_ROLE}\n`)

  const router = new ModelRouterImpl()
  const controlledCallAI = makeControlledCallAI()
  const providerService = new ProviderServiceImpl(router, controlledCallAI)

  let agentResponse: string | null = null
  let agentError: Error | null = null

  // Simulate what an agent does — call ProviderService and expect a string back
  const start = Date.now()
  try {
    agentResponse = await providerService.callAI(
      "Generate code for authentication",
      AGENT_ROLE,
      TASK_ID,
      "You are a Developer AI. Return JSON only.",
      { maxAttempts: 4, maxFallbacks: 2 }
    )
  } catch (err: any) {
    agentError = err
  }
  const durationMs = Date.now() - start

  // ─── Assertions ──────────────────────────────────────────────────────────────

  const events = router.getRoutingEvents()

  console.log("─── Routing Events ────────────────────────────────────────────")
  for (const ev of events) {
    console.log(
      `  [${ev.attempt}] ${ev.provider}/${ev.model}` +
      `  status=${ev.status}` +
      (ev.action ? `  action=${ev.action}` : "") +
      (ev.fallbackFrom ? `  fallbackFrom=${ev.fallbackFrom}` : "") +
      `  latency=${ev.latencyMs}ms`
    )
  }
  console.log()

  let passed = 0
  let failed = 0

  function check(label: string, fn: () => void) {
    try {
      fn()
      console.log(`  ✅ ${label}`)
      passed++
    } catch (err: any) {
      console.error(`  ❌ ${label}: ${err.message}`)
      failed++
    }
  }

  console.log("─── Assertion Results ─────────────────────────────────────────")

  // A1: First routing event is a RATE_LIMIT fallback from the preferred provider
  check("A1: Attempt 1 → preferred provider rate-limited, action=FALLBACK", () => {
    assert.ok(events.length >= 2, `Expected at least 2 routing events, got ${events.length}`)
    const ev1 = events[0]
    assert.equal(ev1.provider, PREFERRED_PROVIDER,
      `Expected provider="${PREFERRED_PROVIDER}" on attempt 1, got "${ev1.provider}"`)
    assert.equal(ev1.status, "RATE_LIMIT",
      `Expected status=RATE_LIMIT on attempt 1, got "${ev1.status}"`)
    assert.equal(ev1.action, "FALLBACK",
      `Expected action=FALLBACK on attempt 1, got "${ev1.action}"`)
  })

  // A2: Second routing event is a SUCCESS from the fallback provider
  check("A2: Attempt 2 → fallback provider succeeds", () => {
    const ev2 = events[1]
    assert.notEqual(ev2.provider, PREFERRED_PROVIDER,
      `Expected fallback provider on attempt 2, but still got "${ev2.provider}"`)
    assert.equal(ev2.status, "SUCCESS",
      `Expected status=SUCCESS on attempt 2, got "${ev2.status}"`)
  })

  // A3: Agent receives a valid response — Provider A failure is NOT visible
  check("A3: Agent receives valid response (failure invisible to agent)", () => {
    assert.equal(agentError, null,
      `Agent should not have received an error, but got: ${agentError?.message}`)
    assert.ok(agentResponse !== null && agentResponse.length > 0,
      "Agent response must be a non-empty string")
    assert.doesNotThrow(() => JSON.parse(agentResponse!),
      "Agent response must be parseable JSON (same format as normal execution)")
  })

  // A4: Provider health — preferred provider failure count incremented
  check("A4: Preferred provider failure recorded (failures=1 after one 429)", () => {
    const health = router.getProviderHealth(PREFERRED_PROVIDER)
    assert.ok(health.failures >= 1,
      `Expected ${PREFERRED_PROVIDER} to have at least 1 failure recorded, got ${health.failures}`)
    // Note: DEGRADED threshold is 2 failures. One failure increments the counter
    // but does not yet degrade the provider (by design — one transient 429 should not
    // immediately mark a provider unhealthy). A second failure would trigger DEGRADED.
  })

  // A5 (bonus): Workspace equivalence — the response content is identical to
  //             what would be returned from normal execution (no corruption).
  check("A5: Response content identical to normal-path response", () => {
    assert.equal(agentResponse, FAKE_RESPONSE,
      "Response after fallback must equal the response a normal call would return")
  })

  // A6 (bonus): Two consecutive failures on same provider → DEGRADED
  check("A6: Two failures on same provider triggers DEGRADED + cooldown", () => {
    const router2 = new ModelRouterImpl()
    router2.markProviderFailure(PREFERRED_PROVIDER, "RATE_LIMIT")
    router2.markProviderFailure(PREFERRED_PROVIDER, "RATE_LIMIT")
    const health2 = router2.getProviderHealth(PREFERRED_PROVIDER)
    assert.equal(health2.status, "DEGRADED",
      `Expected DEGRADED after 2 failures, got "${health2.status}"`)
    assert.ok(health2.cooldownUntil !== undefined,
      "cooldownUntil must be set when provider is DEGRADED")
  })

  // ─── Summary ─────────────────────────────────────────────────────────────────

  console.log()
  console.log(`─── Summary ────────────────────────────────────────────────────`)
  console.log(`  Duration:    ${durationMs}ms`)
  console.log(`  Routing events: ${events.length}`)
  console.log(`  Assertions:  ${passed} passed, ${failed} failed`)
  console.log()

  if (failed === 0) {
    console.log("🎉 BENCHMARK PASSED — V2.4 fallback routing is production-ready.")
    console.log("   V2.1–V2.4 backend can now be frozen.")
    console.log("   Next: V3 AI Engineering Workspace.\n")
  } else {
    console.error("💥 BENCHMARK FAILED — Review failures above before proceeding to V3.\n")
    process.exit(1)
  }
}

runBenchmark()
