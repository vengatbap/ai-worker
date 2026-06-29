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

export interface ExecutionPackage {
  taskId: string;
  title: string;
  agent: string;
  reads: string[];
  writes: string[];
  deletes: string[];
  dependencies: string[];
  tools: string[];
  modelProfile: string;
  acceptanceCriteria: string[];
  buildCommand: string;
  testCommand: string;
  lintCommand: string;
  successCriteria: string[];
  context: {
    architecture: any;
    workspaceId: string;
    artifacts: string[];
    memory: any[];
    project: {
      projectId: string;
      prompt: string;
    };
    variables: Record<string, any>;
    configuration: Record<string, any>;
  };
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

export interface WorkspaceService {
  initializeWorkspace(projectId: string): Promise<string>;
  getContext(workspaceId: string): Promise<Record<string, any>>;
  saveContext(workspaceId: string, data: Record<string, any>): Promise<void>;
  getMemory(workspaceId: string): Promise<any[]>;
  addMemory(workspaceId: string, entry: any): Promise<void>;
}

export interface ProviderService {
  callAI(
    prompt: string,
    provider: string,
    model: string,
    systemPrompt?: string
  ): Promise<string>;
}

export interface ModelRouter {
  route(agentRole: string): { provider: string; model: string };
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
  payload: any;
}

export interface EventBus {
  publish(event: AppEvent): void;
  subscribe(eventType: string, handler: (event: AppEvent) => void): void;
}

export interface LearningService {
  onEvent(event: AppEvent): Promise<void>;
  exportDataset(projectId: string): Promise<string>;
}
