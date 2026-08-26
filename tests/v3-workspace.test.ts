/**
 * V3 AI Engineering Workspace Verification Test
 *
 * Tests:
 * 1. TelemetryStore append, retrieve, and filter
 * 2. EventBusImpl dual-path emission (TelemetryStore + SSE writer)
 * 3. Event retrieval across restart/fresh instances
 */

import { TelemetryStore } from "../core/events/TelemetryStore"
import { EventBusImpl } from "../core/events/EventBusImpl"
import { AppEvent } from "../core/interfaces/types"
import assert from "node:assert/strict"
import fs from "fs"
import path from "path"

const TEST_PROJECT_ID = "v3-test-project-001"

async function runV3Tests() {
  console.log("\n🧪 Running V3 AI Engineering Workspace Tests...\n")

  // Cleanup old test data if any
  const testDir = path.resolve(process.cwd(), "dataset", TEST_PROJECT_ID)
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true })
  }

  // 1. TelemetryStore tests
  console.log("1. Testing TelemetryStore...")
  const store = new TelemetryStore()
  
  const sampleEvent1: AppEvent = {
    id: "ev-1",
    type: "agent.started",
    projectId: TEST_PROJECT_ID,
    timestamp: "2026-08-26T12:00:00.000Z",
    payload: { agentRole: "Research" }
  }
  
  const sampleEvent2: AppEvent = {
    id: "ev-2",
    type: "agent.completed",
    projectId: TEST_PROJECT_ID,
    timestamp: "2026-08-26T12:00:05.000Z",
    payload: { agentRole: "Research", status: "success" }
  }

  store.append(TEST_PROJECT_ID, sampleEvent1)
  store.append(TEST_PROJECT_ID, sampleEvent2)

  const allEvents = store.getAll(TEST_PROJECT_ID)
  assert.equal(allEvents.length, 2, "Should read 2 appended events")
  assert.equal(allEvents[0].id, "ev-1")
  assert.equal(allEvents[1].id, "ev-2")
  console.log("   ✅ TelemetryStore append & getAll passed")

  const filteredEvents = store.getByType(TEST_PROJECT_ID, "agent.completed")
  assert.equal(filteredEvents.length, 1)
  assert.equal(filteredEvents[0].type, "agent.completed")
  console.log("   ✅ TelemetryStore getByType passed")

  // 2. EventBus dual-path tests
  console.log("2. Testing EventBus Dual-Path (Persistence + SSE)...")
  const eventBus = new EventBusImpl()

  let receivedSSEData: string | null = null
  const unsubscribe = eventBus.subscribeSSE(TEST_PROJECT_ID, (data: string) => {
    receivedSSEData = data
  })

  const liveEvent: AppEvent = {
    id: "ev-3",
    type: "qa.scored",
    projectId: TEST_PROJECT_ID,
    timestamp: "2026-08-26T12:00:10.000Z",
    payload: { score: 92 }
  }

  eventBus.publish(liveEvent)

  assert.ok(typeof receivedSSEData === "string", "SSE subscriber should receive published event")
  assert.ok((receivedSSEData as string).includes("qa.scored"), "SSE data should include event type")
  assert.ok((receivedSSEData as string).includes("92"), "SSE data should include payload")
  console.log("   ✅ SSE live streaming delivery passed")

  // Verify persistence path
  const persisted = eventBus.getHistory(TEST_PROJECT_ID)
  assert.equal(persisted.length, 3, "TelemetryStore should contain 3 events now")
  assert.equal(persisted[2].id, "ev-3")
  console.log("   ✅ EventBus persistence to TelemetryStore passed")

  unsubscribe()

  // Clean up test data
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true })
  }

  console.log("\n🎉 All V3 Backend & EventBus Tests Passed Successfully!\n")
}

runV3Tests().catch(err => {
  console.error("❌ Test failed:", err)
  process.exit(1)
})
