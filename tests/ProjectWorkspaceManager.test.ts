import { WorkspaceServiceImpl } from "../core/workspace/WorkspaceServiceImpl"
import assert from "assert"
import fs from "fs"
import path from "path"

async function runTests() {
  console.log("====================================================================")
  console.log("         RUNNING PROJECT WORKSPACE MANAGER TEST SUITE V2            ")
  console.log("====================================================================")

  const projectId = "test-project-workspace-v2"
  const service = new WorkspaceServiceImpl()

  // Clean up any existing test workspace first
  const projectDir = path.resolve(process.cwd(), "workspace", projectId)
  if (fs.existsSync(projectDir)) {
    fs.rmSync(projectDir, { recursive: true, force: true })
  }

  // Test 1: Initialize project workspace
  console.log("Test 1: Initializing Workspace...")
  await service.initializeWorkspace(projectId)

  assert.ok(fs.existsSync(path.join(projectDir, "repository")), "Repository directory should be created")
  assert.ok(fs.existsSync(path.join(projectDir, ".ai")), ".ai metadata directory should be created")
  
  const subdirs = ["state", "tasks", "snapshots", "memory", "decisions", "permissions", "recovery"]
  for (const sub of subdirs) {
    assert.ok(fs.existsSync(path.join(projectDir, ".ai", sub)), `Subdirectory .ai/${sub} should be created`)
  }

  const status = await service.getWorkspaceStatus(projectId)
  assert.strictEqual(status.state, "READY", "Initial state should be READY")
  assert.strictEqual(status.currentVersion, 0, "Initial version should be 0")
  console.log("✅ Test 1 Passed: Directory structures and initial status validated successfully.")

  // Test 2: Workspace locking and concurrency protection
  console.log("\nTest 2: Verifying Locks...")
  const lock1 = await service.acquireLock(projectId, "TASK-001")
  assert.ok(lock1, "Should successfully acquire lock for TASK-001")

  const statusLocked = await service.getWorkspaceStatus(projectId)
  assert.strictEqual(statusLocked.state, "LOCKED", "Workspace status state should update to LOCKED")
  assert.strictEqual(statusLocked.lockedByTask, "TASK-001", "Workspace lockedByTask should be TASK-001")

  // Try concurrent lock request
  const lock2 = await service.acquireLock(projectId, "TASK-002")
  assert.strictEqual(lock2, false, "Should block lock request for concurrent task TASK-002")

  // Release lock
  await service.releaseLock(projectId, "TASK-001")
  const statusReleased = await service.getWorkspaceStatus(projectId)
  assert.strictEqual(statusReleased.state, "READY", "State should return to READY")
  assert.strictEqual(statusReleased.lockedByTask, "", "lockedByTask should be cleared")

  // Now TASK-002 should succeed
  const lock3 = await service.acquireLock(projectId, "TASK-002")
  assert.ok(lock3, "TASK-002 should now successfully acquire lock")
  await service.releaseLock(projectId, "TASK-002")
  console.log("✅ Test 2 Passed: Lock exclusivity and release handlers validated.")

  // Test 3: Snapshot creation and transaction Rollbacks
  console.log("\nTest 3: Snapshot & Rollback Verification...")
  const repoDir = path.join(projectDir, "repository")
  
  // Write initial V1 files
  fs.writeFileSync(path.join(repoDir, "todo.txt"), "Version 1 content")
  
  await service.acquireLock(projectId, "TASK-003")
  await service.updateWorkspaceState(projectId, "SNAPSHOTTING")
  await service.createSnapshot(projectId, "TASK-003", "Pre-task state")
  
  const snapshotJsonPath = path.join(projectDir, ".ai/snapshots/TASK-003/snapshot.json")
  assert.ok(fs.existsSync(snapshotJsonPath), "Snapshot metadata file snapshot.json should exist")
  const snapshotMeta = JSON.parse(fs.readFileSync(snapshotJsonPath, "utf-8"))
  assert.strictEqual(snapshotMeta.taskId, "TASK-003", "Metadata should track correct taskId")
  assert.strictEqual(snapshotMeta.workspaceVersion, 0, "Metadata version should match pre-task version")

  // Simulate Developer modifying files and adding new files (TASK-003 edits)
  fs.writeFileSync(path.join(repoDir, "todo.txt"), "Version 2 modified content")
  fs.writeFileSync(path.join(repoDir, "newfile.txt"), "New task file content")

  // Trigger rollback due to simulated QA failure
  await service.updateWorkspaceState(projectId, "ROLLING_BACK")
  await service.restoreSnapshot(projectId, "TASK-003")

  // Verify repository state restored precisely
  const todoContent = fs.readFileSync(path.join(repoDir, "todo.txt"), "utf-8")
  assert.strictEqual(todoContent, "Version 1 content", "todo.txt content should be rolled back to version 1")
  assert.ok(!fs.existsSync(path.join(repoDir, "newfile.txt")), "newfile.txt created during task should be deleted on rollback")
  
  await service.releaseLock(projectId, "TASK-003")
  console.log("✅ Test 3 Passed: Snapshot rollback matches repository baseline perfectly.")

  // Test 4: Workspace version increments
  console.log("\nTest 4: Verifying Version Increments...")
  const currentVer = await service.incrementWorkspaceVersion(projectId)
  assert.strictEqual(currentVer, 1, "Workspace version should increment to 1")
  const currentStatus = await service.getWorkspaceStatus(projectId)
  assert.strictEqual(currentStatus.currentVersion, 1, "Version in state status.json should be 1")
  console.log("✅ Test 4 Passed: Workspace version increment confirmed.")

  // Test 5: State Machine Integrity (Corrupted states)
  console.log("\nTest 5: State Machine & Corruption Checks...")
  await service.updateWorkspaceState(projectId, "CORRUPTED")
  const stateStatus = await service.getWorkspaceStatus(projectId)
  assert.strictEqual(stateStatus.state, "CORRUPTED", "Workspace state should match CORRUPTED")
  console.log("✅ Test 5 Passed: CORRUPTED states registered properly.")

  console.log("\n====================================================================")
  console.log("          ALL WORKSPACE MANAGER TRANSACTION TESTS PASSED!           ")
  console.log("====================================================================")
}

runTests().catch(err => {
  console.error("❌ Test Suite failed:", err)
  process.exit(1)
})
