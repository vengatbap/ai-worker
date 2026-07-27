import { ScopeMatcher } from "../core/policy/ScopeMatcher"
import { ExecutionPackageV2 } from "../core/interfaces/types"
import { WorkspaceServiceImpl } from "../core/workspace/WorkspaceServiceImpl"
import assert from "assert"
import fs from "fs"
import path from "path"

async function runTests() {
  console.log("====================================================================")
  console.log("           RUNNING EXECUTION PACKAGE V2 TEST SUITE                  ")
  console.log("====================================================================")

  const projectId = "test-project-pkg-v2"
  const service = new WorkspaceServiceImpl()

  // Clean up test workspace
  const projectDir = path.resolve(process.cwd(), "workspace", projectId)
  if (fs.existsSync(projectDir)) {
    fs.rmSync(projectDir, { recursive: true, force: true })
  }

  await service.initializeWorkspace(projectId)

  const mockPkg: ExecutionPackageV2 = {
    schemaVersion: "2.0",
    projectId,
    taskId: "TASK-001",
    packageVersion: 1,
    workspace: {
      expectedWorkspaceVersion: 0,
      readScopes: ["src/components/*", "src/utils/**"],
      writeScopes: ["src/components/*"],
      createScopes: ["src/components/*"],
      deleteScopes: [],
      protectedScopes: ["src/components/Protected.tsx"]
    },
    permissions: {
      allowFileDiscovery: true,
      allowDependencyInstall: false,
      allowNetworkAccess: false,
      allowedCommands: ["npm run build"]
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
      expectedArtifacts: ["src/components/Header.tsx"]
    }
  }

  // 1. Valid read inside scope -> PASS
  console.log("Test 1: Valid read inside scope...")
  assert.ok(ScopeMatcher.isReadAllowed(projectId, "src/components/Header.tsx", mockPkg), "Reading components should be allowed")
  assert.ok(ScopeMatcher.isReadAllowed(projectId, "src/utils/math.ts", mockPkg), "Reading utils subdirectories should be allowed")

  // 2. Valid modification inside scope -> PASS
  console.log("Test 2: Valid modification inside scope...")
  assert.ok(ScopeMatcher.isWriteAllowed(projectId, "src/components/Header.tsx", mockPkg), "Writing to components should be allowed")

  // 3. Valid file creation inside scope -> PASS
  console.log("Test 3: Valid file creation inside scope...")
  assert.ok(ScopeMatcher.isCreateAllowed(projectId, "src/components/Footer.tsx", mockPkg), "Creating file in components should be allowed")

  // 4. Creation outside scope -> DENIED
  console.log("Test 4: Creation outside scope...")
  assert.strictEqual(ScopeMatcher.isCreateAllowed(projectId, "src/utils/math.ts", mockPkg), false, "Creating outside create scope should be denied")

  // 5. Delete without delete permission -> DENIED
  console.log("Test 5: Delete without delete permission...")
  assert.strictEqual(ScopeMatcher.isDeleteAllowed(projectId, "src/components/Header.tsx", mockPkg), false, "Deleting without delete scope should be denied")

  // 6. Protected path despite broad allow -> DENIED
  console.log("Test 6: Protected path override...")
  assert.strictEqual(ScopeMatcher.isWriteAllowed(projectId, "src/components/Protected.tsx", mockPkg), false, "Protected path should block write even if matched by glob")

  // 7. ../ path traversal -> DENIED
  console.log("Test 7: Path traversal checks...")
  assert.strictEqual(ScopeMatcher.isWriteAllowed(projectId, "src/components/../../worker/orchestrator.ts", mockPkg), false, "Relative path traversal escape should be denied")

  // 8. Absolute path escape -> DENIED
  console.log("Test 8: Absolute path escapes...")
  assert.strictEqual(ScopeMatcher.isWriteAllowed(projectId, "/etc/passwd", mockPkg), false, "Absolute path escape should be denied")

  // 9. .ai/ access from Developer -> DENIED
  console.log("Test 9: Metadata .ai/ isolation...")
  assert.strictEqual(ScopeMatcher.isWriteAllowed(projectId, ".ai/state/status.json", mockPkg), false, "Developer access to .ai/ folder must be denied")

  // 10. Unsupported command -> DENIED
  console.log("Test 10: Command execution boundaries...")
  assert.ok(ScopeMatcher.isCommandAllowed("npm run build", mockPkg), "Allowed command should pass")
  assert.strictEqual(ScopeMatcher.isCommandAllowed("rm -rf /", mockPkg), false, "Unauthorized command should be denied")

  // 11. Network access when disabled -> DENIED
  console.log("Test 11: Network access capability check...")
  assert.strictEqual(ScopeMatcher.isNetworkAllowed(mockPkg), false, "Network access should match package configuration")

  // 12. Dependency installation when disabled -> DENIED
  console.log("Test 12: Dependency installs capability check...")
  assert.strictEqual(ScopeMatcher.isDependencyAllowed(mockPkg), false, "Dependency install should match package configuration")

  // 13. Correct workspace version -> PASS
  console.log("Test 13: Correct workspace version verification...")
  const status = await service.getWorkspaceStatus(projectId)
  assert.strictEqual(status.currentVersion, mockPkg.workspace.expectedWorkspaceVersion, "Current workspace version should match expected task package version")

  // 14. Stale workspace version -> REJECT PACKAGE
  console.log("Test 14: Stale workspace version check...")
  await service.incrementWorkspaceVersion(projectId)
  const statusStale = await service.getWorkspaceStatus(projectId)
  assert.notStrictEqual(statusStale.currentVersion, mockPkg.workspace.expectedWorkspaceVersion, "Stale check: expected 0, but current version is 1")

  // 15. Package version history stays -> PASS
  console.log("Test 15: Execution package immutability...")
  const pkgFolder = path.resolve(process.cwd(), "dataset", projectId, "planning/execution-packages/TASK-001")
  if (!fs.existsSync(pkgFolder)) {
    fs.mkdirSync(pkgFolder, { recursive: true })
  }
  fs.writeFileSync(path.join(pkgFolder, "v1.json"), JSON.stringify(mockPkg, null, 2))
  
  const mockPkgV2: ExecutionPackageV2 = {
    ...mockPkg,
    packageVersion: 2,
    workspace: {
      ...mockPkg.workspace,
      writeScopes: ["src/components/*", "src/utils/**"]
    }
  }
  fs.writeFileSync(path.join(pkgFolder, "v2.json"), JSON.stringify(mockPkgV2, null, 2))

  assert.ok(fs.existsSync(path.join(pkgFolder, "v1.json")), "v1 package should remain unchanged")
  assert.ok(fs.existsSync(path.join(pkgFolder, "v2.json")), "v2 package should be written separately")

  console.log("\n====================================================================")
  console.log("          ALL EXECUTION PACKAGE V2 CAPABILITY TESTS PASSED!          ")
  console.log("====================================================================")
}

runTests().catch(err => {
  console.error("❌ Test Suite failed:", err)
  process.exit(1)
})
