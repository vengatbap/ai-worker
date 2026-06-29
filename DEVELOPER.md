# AI Software Engineering OS: Developer Guide

Welcome to the developer documentation for the **AI Software Engineering Operating System (Version 1)**. This guide provides an overview of the core architecture, agent contracts, prompt registry, and how to operate the system locally.

---

## 🏗️ Architecture Overview

The platform uses a modular, contract-driven pipeline where specialized agents cooperate asynchronously by generating and consuming versioned machine-readable artifacts.

```text
                               Workflow Engine
                                      │
                                      ▼
                             Project Orchestrator
                                      │
 ─────────────────────────────────────────────────────────────────────────

  Research  ➡️  Planner  ➡️  Architect  ➡️  Task AI  ➡️  Developer AI
                                                             │
                                                             ▼
                                                         QA Engine
                                                             │
                                                             ▼
                                                        Reviewer AI
                                                             │
                                                             ▼
                                                      Documentation AI
                                                             │
                                                             ▼
                                                       Deployment AI
```

---

## 📂 Core Directory Structure

```text
├── core/
│   ├── interfaces/
│   │   └── types.ts             # Central TypeScript Type Definitions (Contracts)
│   ├── provider/
│   │   └── ProviderServiceImpl.ts # Unified LLM client with retries and backoff
│   └── router/
│       ├── ModelRouterImpl.ts   # Model routing registry service
│       └── profiles.json        # Profile maps matching roles to model sizes
│
├── worker/
│   ├── orchestrator.ts          # Main pipeline orchestrator coordinator
│   └── agents/
│       ├── BaseAgent.ts         # Abstract base agent class
│       ├── ResearchAgent.ts     # Competitors analysis & tech recommendation
│       ├── PlannerAgent.ts      # Requirements gathering & roadmap scope
│       ├── ArchitectAgent.ts    # Folder tree, DB, and API schema design
│       ├── TaskAgent.ts         # Task decomposition planning engine
│       ├── DeveloperAgent.ts    # Code changes generator with writes guards
│       ├── QAAgent.ts           # Quality testing, build & lint validator
│       ├── ReviewerAgent.ts     # PR reviewer checking naming & compliance
│       ├── DocAgent.ts          # Markdown documentation compiler
│       └── DeploymentAgent.ts   # Docker, CI/CD, and rollback configuration
│
├── prompts/                     # Versioned Prompts Library
│   ├── research/v1/
│   ├── planner/v1/
│   ├── architect/v1/
│   ├── planning/v1/
│   ├── qa/v1/
│   ├── reviewer/v1/
│   ├── documentation/v1/
│   └── deployment/v1/
│
├── dataset/                     # Output Knowledge Repository
│   └── {projectId}/             # Domain-oriented files generated during runs
│       ├── ProjectManifest.json # Operational Kernel single source of truth
│       ├── research.json
│       ├── project.json
│       ├── architecture/
│       ├── planning/
│       ├── quality/
│       ├── review/
│       ├── documentation/
│       └── deployment/
│
└── workspace/                   # Local application sandbox workspace area
```

---

## 📜 The Five Core Contracts

Every agent coordinates exclusively through predefined interface boundaries defined in `core/interfaces/types.ts`:

1.  **`ExecutionPlan`**: Formulated by `TaskAgent` containing epics, features, dependency paths, and task estimations.
2.  **`ExecutionPackage`**: Formulated by `TaskAgent` specifying allowed write files list, context, and dependencies for the Developer Agent.
3.  **`QualityReport`**: Formulated by `QAAgent` enclosing testing coverage, defect categories, and lint/compile statuses.
4.  **`ReviewReport`**: Formulated by `ReviewerAgent` including architecture compliance status and PR approval decisions.
5.  **`ProjectManifest`**: The master kernel state registry tracking stages, artifacts versions history, and deployment endpoints.

---

## 🚀 Running the Operating System Locally

### Prerequisites
Ensure Node.js and dependencies are installed:
```bash
npm install
```

### Local Development Server
To launch the developer dashboard portal:
```bash
npm run dev
```

### Triggering the Orchestrator Pipeline
Invoke the main orchestrator flow via API endpoints or scripting runners:
```typescript
import { Orchestrator } from "./worker/orchestrator";

const orchestrator = new Orchestrator();
orchestrator.runProjectWorkflow(
  "cmms-001",
  "Maintenance SaaS Portal",
  "Build a multi-tenant CMMS software application..."
).then((res) => {
  console.log("OS Workflow Execution Complete:", res.status);
});
```
