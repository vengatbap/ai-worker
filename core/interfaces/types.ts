export type ArtifactStatus = "Draft" | "Evaluating" | "Approved" | "Rejected" | "Archived";

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
