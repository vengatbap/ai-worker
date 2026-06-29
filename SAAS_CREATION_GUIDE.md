# Step-by-Step Guide: Building a SaaS Product with AI Software Engineering OS

This guide walks you through the step-by-step procedure to orchestrate and build a custom SaaS product (like a CMMS, CRM, or custom application) using the **AI Software Engineering Operating System (V1)**.

---

## 🛠️ Step 1: Define Your SaaS Product Goal

To start, you need a high-level description of your SaaS application. For example, to build a **Computerized Maintenance Management System (CMMS)**:
*   **Goal Description**: "A multi-tenant CMMS application that supports work order creation, maintenance scheduling, and real-time technician dashboard logs."

---

## 🚀 Step 2: Trigger the OS Pipeline

You can trigger the pipeline either by sending an HTTP POST request to the local API endpoint or by executing the Orchestrator coordinator.

### Option A: Trigger via Local Dashboard API
Send a JSON payload to `http://localhost:3000/api/worker` (or use the Dashboard UI):
```json
{
  "projectId": "cmms-001",
  "taskName": "CMMS Maintenance Portal",
  "prompt": "Build a multi-tenant CMMS software application that handles work order logs, asset status charts, and technician shifts."
}
```

### Option B: Trigger via script runner
Create a runner script in your workspace:
```typescript
import { Orchestrator } from "./worker/orchestrator";

const orchestrator = new Orchestrator();
orchestrator.runProjectWorkflow(
  "cmms-001",
  "CMMS Maintenance Portal",
  "Build a multi-tenant CMMS software application..."
);
```

---

## 🔄 Step 3: Pipeline Stages Flow

Once triggered, the Orchestrator automatically coordinates the 9 specialized agents in the following sequence:

### 1. Research Phase (`ResearchAgent`)
*   **Action**: Analyzes technical recommendations, competitor landscapes, and potential project risks.
*   **Output**: Generates `dataset/cmms-001/research.json`.
*   **Gate**: Automatically evaluates the research artifact. Requires a minimum quality score of **85** before continuing.

### 2. Planning Phase (`PlannerAgent`)
*   **Action**: Breaks down requirements, defines the MVP scope boundaries, and plots milestone roadmaps.
*   **Output**: Generates `dataset/cmms-001/project.json`.
*   **Gate**: Evaluates requirements list and milestones. Requires a minimum quality score of **90**.

### 3. Architecture Design Phase (`ArchitectAgent`)
*   **Action**: Models system folder structures, SQL/NoSQL schema designs, and OpenAPI specifications.
*   **Output**: Generates `dataset/cmms-001/architecture/architecture.json` and `openapi.yaml`.
*   **Gate**: Checks folder trees and API parameters consistency. Requires a quality score of **85**.

### 4. Backlog Planning Phase (`TaskAgent` / Task AI)
*   **Action**: Deconstructs the architecture schemas into separate executable developer tickets.
*   **Output**: Generates `dataset/cmms-001/planning/tasks.json` containing the order of operations, writes files guards list, and commands.

### 5. Developer AI Phase (`DeveloperAgent`)
*   **Action**: Takes the first execution package ticket, validates file writes permissions, and writes the code inside `workspace/cmms-001/`.

### 6. Quality Assurance Phase (`QAAgent`)
*   **Action**: Runs `npm run build`, lint checks, and testing suites.
*   **Output**: Generates domain decomposed JSONs under `dataset/cmms-001/quality/` (`build-report.json`, `lint-report.json`, etc.).
*   **Gate**: Requires a compiler verification pass and a minimum overall quality score of **85**. If failed, rolls back the workspace using snapshots and retries.

### 7. Governance Review Phase (`ReviewerAgent`)
*   **Action**: Reviews the generated code against project architecture standards and SOLID design principles.
*   **Output**: Generates `dataset/cmms-001/review/review-report.json` and `approval.json`.
*   **Gate**: Requires the reviewer's decision status to be **`APPROVED`**.

### 8. Documentation Publishing Phase (`DocAgent`)
*   **Action**: Compiles development records and schemas into a unified document suite.
*   **Output**: Publishes `README.md`, `ARCHITECTURE.md`, `API.md`, and `docs-report.json` under `dataset/cmms-001/documentation/`.

### 9. Deployment Packaging Phase (`DeploymentAgent`)
*   **Action**: Produces Docker specifications, CI/CD Actions, and rollback scripts.
*   **Output**: Publishes `Dockerfile`, `docker-compose.yml`, `ci-cd-workflow.yml`, and `deployment-report.json` under `dataset/cmms-001/deployment/`.

---

## 📈 Step 4: Inspecting Outputs in the Dashboard

1.  Open [http://localhost:3000](http://localhost:3000) in your web browser.
2.  Navigate to the **Dashboard** view.
3.  Monitor active task logs, duration metrics, and agent tokens.
4.  Check `dataset/cmms-001/ProjectManifest.json` in your local directory. It acts as the master Operational Kernel dashboard, showing paths, stage approvals, versions, and deployment endpoints:
```json
{
  "projectId": "cmms-001",
  "currentStage": "deployment",
  "deployment": {
    "currentVersion": "1.0.0",
    "environment": "production",
    "endpoint": "http://localhost:3000",
    "healthStatus": "healthy",
    "lastDeployment": "2026-06-29T..."
  }
}
```
