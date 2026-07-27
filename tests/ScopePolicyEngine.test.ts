import { ScopePolicyEngine } from "../core/policy/ScopePolicyEngine"
import { ExecutionPackageV2, CapabilityRequest } from "../core/interfaces/types"
import { WorkspaceServiceImpl } from "../core/workspace/WorkspaceServiceImpl"
import { EventBusImpl } from "../core/events/EventBusImpl"
import assert from "assert"
import fs from "fs"
import path from "path"

async function runTests() {
  console.log("====================================================================")
  console.log("             RUNNING SCOPE POLICY ENGINE TEST SUITE                 ")
  console.log("====================================================================")

  const projectId = "test-project-policy-v2"
  const taskId = "TASK-014"
  const service = new WorkspaceServiceImpl()
  const eventBus = new EventBusImpl()

  // Clean up workspace and dataset
  const projectDir = path.resolve(process.cwd(), "workspace", projectId)
  if (fs.existsSync(projectDir)) {
    fs.rmSync(projectDir, { recursive: true, force: true })
  }
  const datasetPkgDir = path.resolve(process.cwd(), "dataset", projectId, "planning/execution-packages", taskId)
  if (fs.existsSync(datasetPkgDir)) {
    fs.rmSync(datasetPkgDir, { recursive: true, force: true })
  }

  await service.initializeWorkspace(projectId)
  fs.mkdirSync(datasetPkgDir, { recursive: true })

  const mockPkg: ExecutionPackageV2 = {
    schemaVersion: "2.0",
    projectId,
    taskId,
    packageVersion: 1,
    workspace: {
      expectedWorkspaceVersion: 0,
      readScopes: ["src/components/*"],
      writeScopes: ["src/components/*"],
      createScopes: ["src/components/*"],
      deleteScopes: [],
      protectedScopes: []
    },
    permissions: {
      allowFileDiscovery: true,
      allowDependencyInstall: false,
      allowNetworkAccess: false,
      allowedCommands: []
    },
    context: {
      architectureRefs: [],
      artifactRefs: [],
      relevantFiles: [],
      previousTasks: [],
      decisions: []
    },
    execution: {
      modelProfile: "medium",
      maxRetries: 3,
      timeoutMs: 1000
    },
    acceptanceCriteria: [],
    outputs: {
      expectedArtifacts: []
    }
  }

  // Save v1 package initial baseline
  fs.writeFileSync(path.join(datasetPkgDir, "execution-package-v1.json"), JSON.stringify(mockPkg, null, 2))
  fs.writeFileSync(path.join(datasetPkgDir, "v1.json"), JSON.stringify(mockPkg, null, 2))

  // Track EventBus events
  let scopeExpansionEventEmitted = false
  eventBus.subscribe("scope_expansion", (event) => {
    scopeExpansionEventEmitted = true
  })

  // Test 1: Safe project-local CREATE -> auto-approved and package revised
  console.log("Test 1: Safe project-local CREATE...")
  const request1: CapabilityRequest = {
    requestId: "req-1",
    projectId,
    taskId,
    packageVersion: 1,
    workspaceVersion: 0,
    operation: "CREATE",
    resource: "src/lib/auth/session.ts",
    reason: "Need session helper component",
    requestedAt: new Date().toISOString()
  }

  const decision1 = await ScopePolicyEngine.evaluateRequest(request1, mockPkg)
  assert.strictEqual(decision1.decision, "AUTO_APPROVED", "Should auto-approve safe CREATE in src/lib")
  assert.strictEqual(decision1.packageVersion, 2, "Package version should increment to 2")
  assert.strictEqual(decision1.grantedScope, "src/lib/auth/**", "Granted scope should match parent wildcard")

  // Wait for async EventBus handlers to fire
  await new Promise(resolve => setTimeout(resolve, 50))

  // Verify lineage files written
  assert.ok(fs.existsSync(path.join(datasetPkgDir, "execution-package-v2.json")), "v2 package file should be written")
  assert.ok(fs.existsSync(path.join(datasetPkgDir, "history.json")), "history.json file should be written")
  
  const history = JSON.parse(fs.readFileSync(path.join(datasetPkgDir, "history.json"), "utf-8"))
  assert.strictEqual(history[0].fromVersion, 1, "History log tracks version progression")
  assert.ok(scopeExpansionEventEmitted, "Scope expansion audit event must be published to EventBus")
  console.log("✅ Test 1 Passed: Safe CREATE auto-approved and revisions versioned.")

  // Test 2: Safe MODIFY outside original scope
  console.log("\nTest 2: Safe MODIFY outside scope...")
  const request2: CapabilityRequest = {
    ...request1,
    requestId: "req-2",
    operation: "MODIFY",
    resource: "src/utils/logger.ts"
  }
  const decision2 = await ScopePolicyEngine.evaluateRequest(request2, mockPkg)
  assert.strictEqual(decision2.decision, "AUTO_APPROVED", "Should auto-approve safe MODIFY in src/utils")
  console.log("✅ Test 2 Passed: Safe MODIFY verified.")

  // Test 3: Protected paths -> DENIED
  console.log("\nTest 3: Protected metadata paths...")
  const request3: CapabilityRequest = {
    ...request1,
    requestId: "req-3",
    resource: ".ai/state/status.json"
  }
  const decision3 = await ScopePolicyEngine.evaluateRequest(request3, mockPkg)
  assert.strictEqual(decision3.decision, "DENIED", "Access to metadata files should be denied")
  assert.strictEqual(decision3.reasonCode, "PROTECTED_METADATA_PATH", "Error reasonCode should indicate protected metadata")
  console.log("✅ Test 3 Passed: Protected metadata paths blocked.")

  // Test 4: .env modification -> DENIED
  console.log("\nTest 4: .env modification...")
  const request4: CapabilityRequest = {
    ...request1,
    requestId: "req-4",
    resource: ".env.local"
  }
  const decision4 = await ScopePolicyEngine.evaluateRequest(request4, mockPkg)
  assert.strictEqual(decision4.decision, "DENIED", ".env updates should be blocked")
  console.log("✅ Test 4 Passed: Env files protected.")

  // Test 5: Path traversal escape -> DENIED
  console.log("\nTest 5: Traversal checks...")
  const request5: CapabilityRequest = {
    ...request1,
    requestId: "req-5",
    resource: "src/../../worker/orchestrator.ts"
  }
  const decision5 = await ScopePolicyEngine.evaluateRequest(request5, mockPkg)
  assert.strictEqual(decision5.decision, "DENIED", "Relative traversals outside repo should be blocked")
  console.log("✅ Test 5 Passed: Traversals blocked.")

  // Test 6: DELETE outside scope -> REQUIRES_APPROVAL
  console.log("\nTest 6: DELETE checks...")
  const request6: CapabilityRequest = {
    ...request1,
    requestId: "req-6",
    operation: "DELETE",
    resource: "src/components/Header.tsx"
  }
  const decision6 = await ScopePolicyEngine.evaluateRequest(request6, mockPkg)
  assert.strictEqual(decision6.decision, "REQUIRES_APPROVAL", "Deletions must escalate and require supervisor approval")
  console.log("✅ Test 6 Passed: Deletes escalated correctly.")

  // Test 7: Circuit Breaker - Limit revisions
  console.log("\nTest 7: Revision limit checks (Circuit Breaker)...")
  // Write mock packages to exhaust revisions limit (max 5)
  for (let i = 3; i <= 6; i++) {
    fs.writeFileSync(path.join(datasetPkgDir, `execution-package-v${i}.json`), JSON.stringify(mockPkg, null, 2))
  }
  const request7: CapabilityRequest = {
    ...request1,
    requestId: "req-7",
    packageVersion: 6
  }
  const decision7 = await ScopePolicyEngine.evaluateRequest(request7, mockPkg)
  assert.strictEqual(decision7.decision, "DENIED", "Should block requests after exceeding maximum revisions limit")
  assert.strictEqual(decision7.reasonCode, "MAX_REVISIONS_EXCEEDED", "Error should indicate revisions limit reached")
  console.log("✅ Test 7 Passed: Circuit breaker locks down scope expansion loops.")

  console.log("\n====================================================================")
  console.log("          ALL DYNAMIC SCOPE POLICY ENGINE TESTS PASSED!             ")
  console.log("====================================================================")
}

runTests().catch(err => {
  console.error("❌ Test Suite failed:", err)
  process.exit(1)
})
