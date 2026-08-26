import {
  ModelRouter,
  RoutingDecision,
  RoutingEvent,
  ProviderErrorType,
  ProviderHealthState,
} from "../interfaces/types"
import fs from "fs"
import path from "path"
import { randomUUID } from "crypto"

// ─── Profile shape ────────────────────────────────────────────────────────────

interface ModelTarget {
  provider: string
  model: string
}

interface AgentProfile {
  preferred: ModelTarget[]
  fallback: ModelTarget[]
  largeContext?: ModelTarget
  strongReasoning?: ModelTarget
}

// ─── Provider health internal tracking ────────────────────────────────────────

const COOLDOWN_MS = 60_000          // 60 seconds
const DEGRADED_FAILURE_THRESHOLD = 2 // mark DEGRADED after this many failures

// ─── Error pattern tables ──────────────────────────────────────────────────────

const STATUS_CODE_MAP: Array<[number, ProviderErrorType]> = [
  [401, "AUTH_ERROR"],
  [403, "AUTH_ERROR"],
  [429, "RATE_LIMIT"],
  [500, "PROVIDER_UNAVAILABLE"],
  [502, "PROVIDER_UNAVAILABLE"],
  [503, "PROVIDER_UNAVAILABLE"],
  [504, "PROVIDER_UNAVAILABLE"],
]

const MESSAGE_PATTERN_MAP: Array<[RegExp, ProviderErrorType]> = [
  [/rate.?limit|too many requests|quota exceeded/i,         "RATE_LIMIT"],
  [/timeout|timed out|ETIMEDOUT|ESOCKETTIMEDOUT/i,          "TIMEOUT"],
  [/context.?window|context.?length|token.?limit|too long/i,"CONTEXT_TOO_LARGE"],
  [/unauthorized|invalid.?api.?key|api key/i,               "AUTH_ERROR"],
  [/content.?filter|safety.?policy|content.?policy/i,       "CONTENT_FILTER"],
  [/ENOTFOUND|ECONNREFUSED|network/i,                       "NETWORK_ERROR"],
]

// ─── Actions per error type ────────────────────────────────────────────────────

const ERROR_ACTIONS: Record<ProviderErrorType, "RETRY" | "FALLBACK" | "ESCALATE_CONTEXT" | "ESCALATE_QUALITY" | "ABORT"> = {
  RATE_LIMIT:          "FALLBACK",
  TIMEOUT:             "RETRY",
  CONTEXT_TOO_LARGE:   "ESCALATE_CONTEXT",
  QUALITY_FAILURE:     "ESCALATE_QUALITY",
  PROVIDER_UNAVAILABLE:"FALLBACK",
  AUTH_ERROR:          "ABORT",
  CONTENT_FILTER:      "ABORT",
  NETWORK_ERROR:       "FALLBACK",
  INVALID_RESPONSE:    "RETRY",
  UNKNOWN:             "FALLBACK",
}

// ─── Unrecoverable errors — these must propagate, never be swallowed ───────────

const ABORT_ERRORS = new Set<ProviderErrorType>(["AUTH_ERROR", "CONTENT_FILTER"])

// ─────────────────────────────────────────────────────────────────────────────

export class ModelRouterImpl implements ModelRouter {
  private tokenCount = 0
  private costUsd = 0
  private profiles: Record<string, AgentProfile>
  private healthMap = new Map<string, ProviderHealthState>()
  private routingEvents: RoutingEvent[] = []

  constructor() {
    this.profiles = this.loadProfiles()
  }

  // ── Profile loading ──────────────────────────────────────────────────────────

  private loadProfiles(): Record<string, AgentProfile> {
    try {
      const file1 = path.resolve(process.cwd(), "core/router/profiles.json")
      if (fs.existsSync(file1)) {
        return JSON.parse(fs.readFileSync(file1, "utf-8"))
      }
      const file2 = path.resolve(__dirname, "profiles.json")
      return JSON.parse(fs.readFileSync(file2, "utf-8"))
    } catch {
      return {}
    }
  }

  // ── Route ────────────────────────────────────────────────────────────────────

  route(
    agentRole: string,
    hint?: {
      reason?: ProviderErrorType | "INITIAL"
      fromProvider?: string
      fromModel?: string
      qualityEscalate?: boolean
    }
  ): RoutingDecision {
    const routingTraceId = this.buildTraceId(agentRole)
    const roleLower = agentRole.toLowerCase()
    const profile = this.profiles[roleLower]

    const reason = hint?.reason ?? "INITIAL"

    // Quality escalation → strongReasoning model
    if (hint?.qualityEscalate && profile?.strongReasoning) {
      const target = profile.strongReasoning
      if (!this.isDegraded(target.provider)) {
        return { routingTraceId, provider: target.provider, model: target.model, reason }
      }
    }

    // Context escalation → largeContext model
    if (reason === "CONTEXT_TOO_LARGE" && profile?.largeContext) {
      const target = profile.largeContext
      if (!this.isDegraded(target.provider)) {
        return { routingTraceId, provider: target.provider, model: target.model, reason }
      }
    }

    // On fallback, skip the provider that just failed
    const excluded = hint?.fromProvider && reason !== "INITIAL"
      ? hint.fromProvider
      : null

    // Try preferred list first (skip any excluded or degraded providers)
    if (profile?.preferred) {
      for (const target of profile.preferred) {
        if (excluded && target.provider === excluded) continue
        if (this.isDegraded(target.provider)) continue
        return { routingTraceId, provider: target.provider, model: target.model, reason }
      }
    }

    // Try fallback list (skip excluded/degraded)
    if (profile?.fallback) {
      for (const target of profile.fallback) {
        if (excluded && target.provider === excluded) continue
        if (this.isDegraded(target.provider)) continue
        return { routingTraceId, provider: target.provider, model: target.model, reason }
      }
    }

    // If everything is excluded or degraded, try ANY fallback regardless of exclusion
    if (profile?.fallback?.length) {
      const any = profile.fallback.find(t => !this.isDegraded(t.provider))
      if (any) {
        return { routingTraceId, provider: any.provider, model: any.model, reason }
      }
    }

    // Absolute last resort from env (signals NO_PROVIDER_AVAILABLE to executor)
    const provider = process.env.AI_PROVIDER || "groq"
    const model    = process.env.AI_MODEL    || "llama-3.3-70b-versatile"
    return { routingTraceId, provider, model, reason }
  }

  // ── Error classification ─────────────────────────────────────────────────────

  classifyError(error: any): ProviderErrorType {
    // HTTP status code match
    const status: number | undefined =
      error?.response?.status ?? error?.status ?? error?.statusCode
    if (status !== undefined) {
      for (const [code, type] of STATUS_CODE_MAP) {
        if (status === code) return type
      }
    }

    // Message pattern match
    const message: string = error?.message ?? error?.response?.data?.error?.message ?? ""
    for (const [pattern, type] of MESSAGE_PATTERN_MAP) {
      if (pattern.test(message)) return type
    }

    // UNKNOWN for everything else
    return "UNKNOWN"
  }

  // ── Provider health ──────────────────────────────────────────────────────────

  getProviderHealth(provider: string): ProviderHealthState {
    if (!this.healthMap.has(provider)) {
      this.healthMap.set(provider, { status: "HEALTHY", failures: 0 })
    }
    return this.healthMap.get(provider)!
  }

  markProviderFailure(provider: string, errorType: ProviderErrorType): void {
    // Auth / content errors are configuration problems — don't degrade the provider
    if (ABORT_ERRORS.has(errorType)) return

    const health = this.getProviderHealth(provider)
    health.failures++
    health.lastFailureAt = new Date().toISOString()

    if (health.failures >= DEGRADED_FAILURE_THRESHOLD) {
      health.status = "DEGRADED"
      health.cooldownUntil = new Date(Date.now() + COOLDOWN_MS).toISOString()
      console.warn(
        `[Router] Provider "${provider}" marked DEGRADED after ${health.failures} failures. ` +
        `Cooldown until: ${health.cooldownUntil}`
      )
    }

    this.healthMap.set(provider, health)
  }

  private isDegraded(provider: string): boolean {
    const health = this.getProviderHealth(provider)
    if (health.status !== "DEGRADED") return false

    // Auto-heal after cooldown expires
    if (health.cooldownUntil && new Date() > new Date(health.cooldownUntil)) {
      health.status = "HEALTHY"
      health.failures = 0
      health.cooldownUntil = undefined
      this.healthMap.set(provider, health)
      console.info(`[Router] Provider "${provider}" auto-healed after cooldown.`)
      return false
    }

    return true
  }

  // ── Telemetry ────────────────────────────────────────────────────────────────

  emitEvent(event: RoutingEvent): void {
    this.routingEvents.push(event)
    // Structured log for observability
    console.info(
      `[RoutingEvent] traceId=${event.routingTraceId} ` +
      `agent=${event.agentRole} attempt=${event.attempt} ` +
      `${event.provider}/${event.model} ` +
      `status=${event.status} ` +
      (event.action ? `action=${event.action} ` : "") +
      (event.fallbackFrom ? `fallbackFrom=${event.fallbackFrom} ` : "") +
      (event.fallbackTo   ? `fallbackTo=${event.fallbackTo} ` : "") +
      `latency=${event.latencyMs}ms`
    )
  }

  getRoutingEvents(): RoutingEvent[] {
    return [...this.routingEvents]
  }

  // ── Budget/metrics ───────────────────────────────────────────────────────────

  trackUsage(tokens: number, cost: number): void {
    this.tokenCount += tokens
    this.costUsd += cost
  }

  getMetrics(): { tokenCount: number; costUsd: number } {
    return { tokenCount: this.tokenCount, costUsd: this.costUsd }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /** Extract the recommended action for a given error type */
  static getAction(errorType: ProviderErrorType): "RETRY" | "FALLBACK" | "ESCALATE_CONTEXT" | "ESCALATE_QUALITY" | "ABORT" {
    return ERROR_ACTIONS[errorType] ?? "FALLBACK"
  }

  static isAbort(errorType: ProviderErrorType): boolean {
    return ABORT_ERRORS.has(errorType)
  }

  private buildTraceId(agentRole: string): string {
    return `TRACE-${agentRole.toUpperCase().slice(0, 4)}-${randomUUID().split("-")[0].toUpperCase()}`
  }
}
