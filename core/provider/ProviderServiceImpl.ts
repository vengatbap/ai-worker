import {
  ProviderService,
  RoutingBudget,
  RoutingEvent,
  ProviderErrorType,
} from "../interfaces/types"
import { ModelRouterImpl } from "../router/ModelRouterImpl"
import { callAI } from "../../worker/ai-service"

// Default routing budget — agents can override via callAI options
const DEFAULT_BUDGET: RoutingBudget = {
  maxAttempts: 4,
  maxFallbacks: 2,
}

// ─────────────────────────────────────────────────────────────────────────────

export class ProviderServiceImpl implements ProviderService {
  /**
   * The executor holds its own router instance per agent lifecycle.
   * This ensures health state is local to a single task run; we don't want
   * one degraded provider from yesterday's task to block today's run.
   */
  private router: ModelRouterImpl

  constructor(router?: ModelRouterImpl) {
    this.router = router ?? new ModelRouterImpl()
  }

  /**
   * Execute an AI prompt with full routing, retry, and fallback logic.
   *
   * The caller (agent) never knows which provider was used or whether a
   * fallback occurred.  All that information is captured in RoutingEvents
   * that can be read via router.getRoutingEvents().
   */
  async callAI(
    prompt: string,
    agentRole: string,
    taskId: string,
    systemPrompt?: string,
    budget: RoutingBudget = DEFAULT_BUDGET,
    qualityEscalate = false
  ): Promise<string> {
    let attempts = 0
    let fallbacks = 0
    let lastErrorType: ProviderErrorType = "UNKNOWN"
    let lastProvider: string | undefined
    let lastModel: string | undefined
    let traceId: string | undefined

    while (attempts < budget.maxAttempts) {
      // Ask the router for the next routing decision
      const decision = this.router.route(agentRole, {
        reason: attempts === 0 ? "INITIAL" : lastErrorType,
        fromProvider: lastProvider,
        fromModel: lastModel,
        qualityEscalate: qualityEscalate && attempts > 0,
      })

      traceId = decision.routingTraceId
      const { provider, model } = decision

      // Budget: too many fallbacks?
      if (fallbacks >= budget.maxFallbacks && attempts > 0 && provider !== lastProvider) {
        const msg =
          `[Router] Routing budget exhausted: maxFallbacks=${budget.maxFallbacks} reached. ` +
          `traceId=${traceId} agent=${agentRole} taskId=${taskId}`
        console.error(msg)
        throw new Error(`BUDGET_EXHAUSTED: ${msg}`)
      }

      const attemptStart = Date.now()
      attempts++

      try {
        const result = await callAI(prompt, provider, model, systemPrompt)

        if (!result) {
          // Empty response — treat as INVALID_RESPONSE
          throw new Error("AI call returned empty response")
        }

        const latencyMs = Date.now() - attemptStart

        // Emit SUCCESS event
        const event: RoutingEvent = {
          routingTraceId: traceId,
          agentRole,
          taskId,
          attempt: attempts,
          provider,
          model,
          status: "SUCCESS",
          latencyMs,
          timestamp: new Date().toISOString(),
        }
        this.router.emitEvent(event)

        return result

      } catch (err: any) {
        const latencyMs = Date.now() - attemptStart
        const errorType = this.router.classifyError(err)
        const action = ModelRouterImpl.getAction(errorType)

        // Record the failure on the provider health tracker
        this.router.markProviderFailure(provider, errorType)

        // Emit FAILURE event
        const event: RoutingEvent = {
          routingTraceId: traceId,
          agentRole,
          taskId,
          attempt: attempts,
          provider,
          model,
          status: errorType,
          errorType,
          action,
          latencyMs,
          timestamp: new Date().toISOString(),
        }

        // Annotate with fallback route info when we're about to fall over
        if (action === "FALLBACK" || action === "ESCALATE_CONTEXT" || action === "ESCALATE_QUALITY") {
          event.fallbackFrom = `${provider}/${model}`
        }

        this.router.emitEvent(event)

        console.warn(
          `[Executor] Attempt ${attempts}/${budget.maxAttempts} ` +
          `failed on ${provider}/${model}: [${errorType}] ${err.message}. ` +
          `Action: ${action}`
        )

        // Deterministic abort for unrecoverable errors — never retry
        if (ModelRouterImpl.isAbort(errorType)) {
          throw new Error(
            `UNRECOVERABLE_FAILURE [${errorType}]: ${err.message}. ` +
            `traceId=${traceId}`
          )
        }

        // Check attempts budget before looping
        if (attempts >= budget.maxAttempts) {
          break
        }

        // Track state for next iteration
        lastErrorType = errorType
        lastProvider  = provider
        lastModel     = model

        if (action === "FALLBACK" || action === "ESCALATE_CONTEXT" || action === "ESCALATE_QUALITY") {
          fallbacks++
        }

        // Brief back-off before retry (only for RETRY action — fallbacks are immediate)
        if (action === "RETRY") {
          const backoffMs = Math.min(1000 * attempts, 5000)
          await new Promise(r => setTimeout(r, backoffMs))
        }
      }
    }

    // All attempts exhausted
    throw new Error(
      `NO_PROVIDER_AVAILABLE: All ${budget.maxAttempts} routing attempts failed ` +
      `for agent="${agentRole}" taskId="${taskId}" traceId="${traceId}". ` +
      `Use router.getRoutingEvents() for the full trace.`
    )
  }

  /** Expose router for telemetry access (e.g. Orchestrator collecting routing events) */
  getRouter(): ModelRouterImpl {
    return this.router
  }
}
