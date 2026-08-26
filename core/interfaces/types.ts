export type ArtifactStatus = "Draft" | "Evaluating" | "Approved" | "Rejected" | "Archived";

export type TaskStatus = "Pending" | "Ready" | "Running" | "Blocked" | "Completed" | "Failed" | "Skipped";

export interface ExecutionMetrics {
  agent: string;
  model: string;
  provider: string;
  durationMs: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
  retryCount: number;
  qualityScore: number;
}

export interface ArtifactMetadata {
  artifactId: string;
  version: number;
  status: ArtifactStatus;
  createdBy: string;
  createdAt: string;
  projectId: string;
  parentArtifactId: string | null;
  schemaVersion: string;
  metrics?: ExecutionMetrics;
}

export interface ResearchArtifact {
  metadata: ArtifactMetadata;
  summary: string;
  marketOverview: string;
  competitors: Array<{
    name: string;
    strengths: string[];
    weaknesses: string[];
  }>;
  technology: Array<{
    recommendation: string;
    confidence: number;
    evidence: string[];
  }>;
  risks: Array<{
    description: string;
    impact: "low" | "medium" | "high";
    mitigation: string;
  }>;
  opportunities: string[];
  references: string[];
  confidenceScore: number;
}

export interface PlannerArtifact {
  metadata: ArtifactMetadata;
  requirements: string[];
  scope: string;
  roadmap: Array<{
    phaseName: string;
    tasks: string[];
  }>;
  milestones: Array<{
    name: string;
    dueDate: string;
  }>;
  acceptanceCriteria: string[];
}

export interface ArchitectArtifact {
  metadata: ArtifactMetadata;
  systemArchitecture: string;
  folderTree: Record<string, any>;
  databaseSchema: {
    tables: Array<{
      name: string;
      columns: Array<{ name: string; type: string; constraints?: string[] }>;
      relations?: Array<{ table: string; field: string; type: "one-to-many" | "many-to-one" | "one-to-one" }>;
    }>;
  };
  apiSchema: Array<{
    path: string;
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    description: string;
    requestBody?: Record<string, any>;
    responseBody?: Record<string, any>;
  }>;
  techStack: string[];
  securityArchitecture: string;
  deploymentArchitecture: string;
  integrations: string[];
  codingStandards: string[];
  constraints: string[];
  assumptions: string[];
  risks: string[];
  dependencyGraph: Array<{ from: string; to: string }>;
  erdMermaid: string;
  openapiYaml: string;
  architectureYaml: string;
  adrs: Array<{ title: string; filename: string; decision: string; status: string; context: string }>;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  complexity: "easy" | "medium" | "hard";
  status: TaskStatus;
  estimatedHours: number;
  estimatedTokens: number;
  dependencies: string[];
  requiredArtifacts: string[];
  requiredTools: string[];
  requiredModels: string[];
  acceptanceCriteria: string[];
  outputs: string[];
  reads: string[];
  writes: string[];
  deletes: string[];
  executionOrder: number;
  parallelGroup: number;
  blockingTasks: string[];
  successors: string[];
}

export interface ExecutionPackageV2 {
  schemaVersion: "2.0";
  projectId: string;
  taskId: string;
  packageVersion: number;

  workspace: {
    expectedWorkspaceVersion: number;
    readScopes: string[];
    writeScopes: string[];
    createScopes: string[];
    deleteScopes: string[];
    protectedScopes: string[];
  };

  permissions: {
    allowFileDiscovery: boolean;
    allowDependencyInstall: boolean;
    allowNetworkAccess: boolean;
    allowedCommands: string[];
  };

  context: {
    architectureRefs: string[];
    artifactRefs: string[];
    relevantFiles: string[];
    previousTasks: string[];
    decisions: string[];
  };

  execution: {
    modelProfile: string;
    maxRetries: number;
    timeoutMs: number;
  };

  acceptanceCriteria: string[];

  outputs: {
    expectedArtifacts: string[];
  };
}

export interface CapabilityRequest {
  requestId: string;
  projectId: string;
  taskId: string;

  packageVersion: number;
  workspaceVersion: number;

  operation:
    | "READ"
    | "CREATE"
    | "MODIFY"
    | "DELETE"
    | "EXECUTE"
    | "INSTALL"
    | "NETWORK";

  resource: string;
  reason: string;

  requestedAt: string;
}

export interface PolicyDecision {
  requestId: string;

  decision:
    | "AUTO_APPROVED"
    | "DENIED"
    | "REQUIRES_APPROVAL";

  reasonCode: string;
  explanation: string;

  grantedScope?: string;
  packageVersion?: number;
}



export interface PlanningMetrics {
  estimatedDuration: number;
  estimatedTokens: number;
  estimatedCost: number;
  parallelismScore: number;
  criticalPathLength: number;
  totalTasks: number;
}

export interface ExecutionPlan {
  epics: Array<{ id: string; name: string; description: string }>;
  features: Array<{ id: string; epicId: string; name: string; description: string }>;
  stories: Array<{ id: string; featureId: string; title: string; storyText: string }>;
  tasks: Task[];
  criticalPath: string[];
  risks: Array<{ description: string; impact: string; mitigation: string }>;
  metrics: PlanningMetrics;
}

export interface PlanningArtifact {
  metadata: ArtifactMetadata;
  plan: ExecutionPlan;
}

export interface ExecutionReport {
  taskId: string;
  title: string;
  status: "success" | "failed";
  filesCreated: string[];
  filesModified: string[];
  retries: number;
  compilerErrors: string[];
  buildTimeMs: number;
  testsPassedCount: number;
  lintPassed: boolean;
  qualityScore: number;
}

export interface Defect {
  id: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  category: "Build" | "Lint" | "Test" | "Security" | "Performance" | "Accessibility";
  description: string;
  suggestedFix: string;
  status: "Open" | "Resolved";
  source: string;
  affectedFiles: string[];
  taskId: string;
  createdAt: string;
  resolvedAt: string | null;
  rootCause?: "TypeError" | "MissingImport" | "WrongInterface" | "DependencyError" | "Unknown";
}

export interface ValidationResult {
  build: { passed: boolean; logs: string[] };
  lint: { passed: boolean; warnings: number; errors: number };
  tests: { passed: number; failed: number; coveragePercent: number };
  security: { issuesFound: number; severityBreakdown: Record<string, number> };
  performance: { passed: boolean; recommendations: string[] };
  accessibility: { passed: boolean; ARIAIssues: number };
}

export interface QualityMetrics {
  buildTimeMs: number;
  testTimeMs: number;
  coveragePercent: number;
  complexity: "easy" | "medium" | "hard";
  technicalDebtHours: number;
  maintainabilityScore: number;
  securityScore: number;
  performanceScore: number;
  overallScore: number;
}

export interface QualityReport {
  taskId: string;
  validation: ValidationResult;
  defects: Defect[];
  metrics: QualityMetrics;
  recommendations: string[];
}

export interface QualityArtifact {
  metadata: ArtifactMetadata;
  report: QualityReport;
}

export interface ReviewFinding {
  id: string;
  category: "Architecture" | "CodingStandards" | "DesignPattern" | "Security" | "Maintainability";
  severity: "Low" | "Medium" | "High" | "Critical";
  file: string;
  line: number;
  description: string;
  recommendation: string;
  status: "Open" | "Resolved";
}

export interface ReviewReport {
  taskId: string;
  architectureCompliance: { passed: boolean; details: string };
  codingStandards: { passed: boolean; details: string };
  designPatterns: { passed: boolean; details: string };
  maintainability: { passed: boolean; details: string };
  securityGovernance: { passed: boolean; details: string };
  technicalDebtHours: number;
  recommendations: string[];
  findings: ReviewFinding[];
  decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
  overallScore: number;
}

export interface ReviewArtifact {
  metadata: ArtifactMetadata;
  report: ReviewReport;
}

export interface DocumentationMetrics {
  coverage: number;
  brokenLinks: number;
  missingSections: number;
  apiCoverage: number;
  exampleCoverage: number;
  readability: number;
  overallScore: number;
}

export interface DocumentationReport {
  projectDocs: { README: boolean; ARCHITECTURE: boolean; CHANGELOG: boolean };
  developerDocs: { folderStructure: boolean; extensionGuide: boolean };
  apiDocs: { endpointsDocs: boolean; sdkExamples: boolean };
  userDocs: { userManual: boolean; troubleshooting: boolean };
  releaseDocs: { releaseNotes: boolean; breakingChanges: boolean };
  knowledgeBase: { faq: boolean; bestPractices: boolean };
  metrics: DocumentationMetrics;
  recommendations: string[];
}

export interface KnowledgeBase {
  documents: string[];
  api: string[];
  architecture: string[];
  faq: Array<{ question: string; answer: string }>;
  guides: string[];
  examples: string[];
  references: string[];
}

export interface EnvironmentProfile {
  name: string;
  envVariables: Record<string, string>;
  buildCommand: string;
  healthEndpoint: string;
  resourceLimits: { cpu: string; memory: string };
}

export interface DeploymentMetrics {
  buildTimeMs: number;
  deploymentTimeMs: number;
  rollbackTimeMs: number;
  startupTimeMs: number;
  imageSizeMb: number;
  cpuEstimate: string;
  memoryEstimate: string;
  healthScore: number;
}

export interface ReleaseReport {
  deployment: { status: "success" | "failed"; imageTag: string };
  verification: { healthCheckPassed: boolean; smokeTestsPassed: boolean };
  health: { score: number; status: string };
  rollback: { rollbackVersion: string; rollbackSteps: string[] };
  metrics: DeploymentMetrics;
  releaseNotes: string;
  status: string;
}

export interface ProjectManifest {
  projectId: string;
  currentStage: "research" | "planning" | "architecture" | "execution" | "quality" | "review" | "documentation" | "deployment";
  metadata: {
    projectName: string;
    createdAt: string;
    updatedAt: string;
    version: string;
  };
  workflow: {
    stages: string[];
    activeStage: string;
  };
  artifacts: {
    research?: string;
    planning?: string;
    architecture?: string;
    execution?: string;
    quality?: string;
    review?: string;
    documentation?: string;
    deployment?: string;
  };
  versions: Record<string, { current: string; history: string[] }>;
  metrics: {
    estimatedCostUsd: number;
    actualCostUsd: number;
    durationMs: number;
    totalTasks: number;
  };
  approvals: Array<{ stage: string; status: ArtifactStatus; approvedAt: string; approver: string }>;
  dataset: {
    logsDir: string;
    trainingSamplesCount: number;
  };
  deployment?: {
    currentVersion: string;
    environment: string;
    endpoint: string;
    healthStatus: string;
    lastDeployment: string;
    rollbackVersion: string;
  };
}

export interface DocumentationArtifact {
  metadata: ArtifactMetadata;
  report: DocumentationReport;
}

export interface DeploymentArtifact {
  metadata: ArtifactMetadata;
  report: ReleaseReport;
}

export interface ExecutionContext {
  projectId: string;
  workspaceId: string;
  variables: Record<string, any>;
  metrics: {
    tokenCount: number;
    costUsd: number;
    durationMs: number;
  };
  settings: Record<string, any>;
  logger: (message: string, level?: "info" | "warn" | "error") => void;
}

export interface AgentRequest {
  id: string;
  projectId: string;
  workspaceId: string;
  taskId: string;
  goal: string;
  context: ExecutionContext;
}

export interface AgentResponse {
  status: "success" | "failed";
  generatedArtifacts: string[];
  logs: string[];
  metrics: {
    tokenCount: number;
    durationMs: number;
  };
  nextAction?: string;
  qualityScore?: number;
}

export interface Agent {
  initialize(): Promise<void>;
  prepare(req: AgentRequest): Promise<void>;
  execute(req: AgentRequest): Promise<AgentResponse>;
  evaluate(res: AgentResponse): Promise<boolean>;
  retry(req: AgentRequest, err: Error): Promise<AgentResponse>;
  finalize(): Promise<void>;
}

export type WorkspaceState =
  | "READY"
  | "LOCKED"
  | "SNAPSHOTTING"
  | "EXECUTING"
  | "VALIDATING"
  | "COMMITTING"
  | "ROLLING_BACK"
  | "RECOVERY_REQUIRED"
  | "CORRUPTED";

export interface SnapshotMetadata {
  projectId: string;
  taskId: string;
  createdAt: string;
  reason: string;
  previousTask: string;
  workspaceVersion: number;
  status: "valid" | "invalid";
}

export interface WorkspaceStatus {
  projectId: string;
  state: WorkspaceState;
  currentVersion: number;
  lockedByTask?: string;
  lastUpdated: string;
}

export interface WorkspaceService {
  initializeWorkspace(projectId: string): Promise<string>;
  getContext(workspaceId: string): Promise<Record<string, any>>;
  saveContext(workspaceId: string, data: Record<string, any>): Promise<void>;
  getMemory(workspaceId: string): Promise<any[]>;
  addMemory(workspaceId: string, entry: any): Promise<void>;
  
  // OS-owned transactional workspace manager methods
  getWorkspaceStatus(projectId: string): Promise<WorkspaceStatus>;
  updateWorkspaceState(projectId: string, state: WorkspaceState, lockedByTask?: string): Promise<void>;
  incrementWorkspaceVersion(projectId: string): Promise<number>;
  createSnapshot(projectId: string, taskId: string, reason: string): Promise<string>;
  restoreSnapshot(projectId: string, taskId: string): Promise<void>;
  verifyWorkspace(projectId: string): Promise<boolean>;
  acquireLock(projectId: string, taskId: string): Promise<boolean>;
  releaseLock(projectId: string, taskId: string): Promise<void>;
}


// ─────────────────────────────────────────────
// V2.4 Resilient Router Types
// ─────────────────────────────────────────────

/** All recognized failure categories the Router can classify */
export type ProviderErrorType =
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "CONTEXT_TOO_LARGE"
  | "QUALITY_FAILURE"
  | "PROVIDER_UNAVAILABLE"
  | "AUTH_ERROR"
  | "CONTENT_FILTER"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE"
  | "UNKNOWN";

/** Actions the Router can return for a given failure */
export type RoutingAction =
  | "RETRY"
  | "FALLBACK"
  | "ESCALATE_CONTEXT"
  | "ESCALATE_QUALITY"
  | "ABORT";

/** One routing event emitted per attempt to the EventBus */
export interface RoutingEvent {
  routingTraceId: string;
  agentRole: string;
  taskId: string;
  attempt: number;
  provider: string;
  model: string;
  status: "SUCCESS" | ProviderErrorType;
  errorType?: ProviderErrorType;
  action?: RoutingAction;
  /** "provider/model" string of the source before a fallback, e.g. "mistral/mistral-large-latest" */
  fallbackFrom?: string;
  /** "provider/model" string of the destination after a fallback */
  fallbackTo?: string;
  latencyMs: number;
  estimatedTokens?: number;
  estimatedCost?: number;
  timestamp: string;
}

/** Hard caps that prevent runaway token spend in a single agent call */
export interface RoutingBudget {
  maxAttempts: number;
  maxFallbacks: number;
  maxLatencyMs?: number;
  maxEstimatedCost?: number;
}

/** Health state of a provider tracked by the Router */
export interface ProviderHealthState {
  status: "HEALTHY" | "DEGRADED" | "UNAVAILABLE";
  failures: number;
  lastFailureAt?: string;
  /** ISO timestamp; provider is skipped until this time passes */
  cooldownUntil?: string;
}

/**
 * A routing decision produced by ModelRouter and consumed by ProviderService.
 * The executor never makes routing decisions — it only acts on these.
 */
export interface RoutingDecision {
  routingTraceId: string;
  provider: string;
  model: string;
  /** Why this decision was made */
  reason: ProviderErrorType | "INITIAL";
}

export interface ProviderService {
  /**
   * Execute an AI call with automatic retry/fallback handled internally.
   * Agents must NOT pass provider or model — the Router selects them.
   */
  callAI(
    prompt: string,
    agentRole: string,
    taskId: string,
    systemPrompt?: string,
    budget?: RoutingBudget,
    qualityEscalate?: boolean
  ): Promise<string>;
}

export interface ModelRouter {
  /**
   * Produce the next routing decision for an agent role.
   * @param agentRole  Logical role name (e.g. "developer", "planner")
   * @param hint       Optional context about why we are re-routing
   */
  route(
    agentRole: string,
    hint?: { reason?: ProviderErrorType | "INITIAL"; fromProvider?: string; fromModel?: string; qualityEscalate?: boolean }
  ): RoutingDecision;

  /** Classify a raw thrown error into a typed ProviderErrorType */
  classifyError(error: any): ProviderErrorType;

  /** Return the current health state for a provider */
  getProviderHealth(provider: string): ProviderHealthState;

  /**
   * Record a provider failure.  May transition provider to DEGRADED and start cooldown.
   */
  markProviderFailure(provider: string, errorType: ProviderErrorType): void;

  /** Return a copy of all routing events emitted this session */
  getRoutingEvents(): RoutingEvent[];

  trackUsage(tokens: number, cost: number): void;
  getMetrics(): { tokenCount: number; costUsd: number };
}

export interface ToolService {
  executeTool(toolName: string, args: any, context: ExecutionContext): Promise<any>;
}

export interface PolicyService {
  validate(toolName: string, args: any, context: ExecutionContext): Promise<{ allowed: boolean; reason?: string }>;
}

export interface Artifact {
  id: string;
  name: string;
  version: number;
  content: string;
  timestamp: string;
  metadata: ArtifactMetadata;
}

export interface ArtifactService {
  saveArtifact(projectId: string, name: string, content: string, metadata: ArtifactMetadata): Promise<Artifact>;
  getArtifact(projectId: string, name: string, version?: number): Promise<Artifact | null>;
  listArtifacts(projectId: string): Promise<Artifact[]>;
  updateArtifactStatus(projectId: string, name: string, version: number, status: ArtifactStatus): Promise<void>;
}

export interface EvaluationService {
  evaluateArtifact(artifact: Artifact, criteria: string): Promise<{ passed: boolean; score: number; feedback: string }>;
}

export interface AppEvent {
  id: string;
  type: string;
  timestamp: string;
  /** projectId is required for TelemetryStore scoping and SSE fan-out */
  projectId?: string;
  payload: any;
}

export interface EventBus {
  publish(event: AppEvent): void;
  subscribe(eventType: string, handler: (event: AppEvent) => void): void;
  /** Register an SSE response writer for a project. Returns an unsubscribe fn. */
  subscribeSSE(projectId: string, writer: (data: string) => void): () => void;
}

export interface LearningService {
  onEvent(event: AppEvent): Promise<void>;
  exportDataset(projectId: string): Promise<string>;
}
