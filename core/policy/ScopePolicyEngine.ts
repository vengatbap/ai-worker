import fs from "fs"
import path from "path"
import { CapabilityRequest, PolicyDecision, ExecutionPackageV2 } from "../interfaces/types"
import { ScopeMatcher } from "./ScopeMatcher"
import { EventBusImpl } from "../events/EventBusImpl"

export class ScopePolicyEngine {
  private static eventBus = new EventBusImpl()
  private static maxPackageRevisions = 5

  /**
   * Evaluates a dynamic permission request against deterministic security rules.
   */
  public static async evaluateRequest(request: CapabilityRequest, pkg: ExecutionPackageV2): Promise<PolicyDecision> {
    const { projectId, taskId, operation, resource, reason } = request
    const requestId = request.requestId

    // Ensure Developer cannot directly modify protected scopes or escape workspace
    let relPath = ""
    try {
      relPath = ScopeMatcher.canonicalize(projectId, resource)
    } catch (err: any) {
      return {
        requestId,
        decision: "DENIED",
        reasonCode: "PATH_TRAVERSAL_ESCAPE",
        explanation: `Path traversal escape detected: ${err.message}`
      }
    }

    // Deny access if target resource matches protected scopes always
    const isProtected = relPath.startsWith(".ai/") || relPath.startsWith(".git/") || relPath === "ProjectManifest.json" || relPath.startsWith(".env")
    if (isProtected) {
      return {
        requestId,
        decision: "DENIED",
        reasonCode: "PROTECTED_METADATA_PATH",
        explanation: `Modification of OS-protected metadata path is prohibited: ${resource}`
      }
    }

    // Circuit Breaker: Enforce maximum package revisions limit
    const pkgFolder = path.resolve(process.cwd(), "dataset", projectId, `planning/execution-packages/${taskId}`)
    const files = fs.existsSync(pkgFolder) ? fs.readdirSync(pkgFolder) : []
    const packageFilesCount = files.filter(f => f.startsWith("execution-package-v") && f.endsWith(".json")).length
    
    if (packageFilesCount >= this.maxPackageRevisions) {
      return {
        requestId,
        decision: "DENIED",
        reasonCode: "MAX_REVISIONS_EXCEEDED",
        explanation: `Dynamic scope requests blocked: Maximum revisions limit of ${this.maxPackageRevisions} reached.`
      }
    }

    // Evaluate risk based on operation type
    if (operation === "CREATE" || operation === "MODIFY") {
      // Allow local components, pages, utils, lib code updates
      const isAllowedDir = relPath.startsWith("src/") || relPath.startsWith("app/") || relPath.startsWith("components/") || relPath.startsWith("pages/")
      const isSourceCodeFile = /\.(ts|tsx|js|jsx|css|json)$/.test(relPath) && !relPath.endsWith("package.json")

      if (isAllowedDir && isSourceCodeFile) {
        // Auto-approve local directory creation / writes
        const parentDir = path.dirname(relPath).replace(/\\/g, "/")
        const grantedScope = parentDir === "." ? "*" : `${parentDir}/**`
        const nextVersion = pkg.packageVersion + 1

        const decision: PolicyDecision = {
          requestId,
          decision: "AUTO_APPROVED",
          reasonCode: "SAFE_PROJECT_LOCAL_WRITE",
          explanation: `Ordinary source file update inside local workspace auto-approved.`,
          grantedScope,
          packageVersion: nextVersion
        }

        // Commit revised package version to preserve lineage history
        await this.commitRevisedPackage(pkg, decision, pkgFolder)
        return decision
      } else {
        return {
          requestId,
          decision: "REQUIRES_APPROVAL",
          reasonCode: "CRITICAL_PATH_WRITE",
          explanation: `Writing to config files or root directory requires manual approval: ${resource}`
        }
      }
    }

    if (operation === "DELETE") {
      return {
        requestId,
        decision: "REQUIRES_APPROVAL",
        reasonCode: "DESTRUCTIVE_OPERATION",
        explanation: `File deletions require manual verification gate approval.`
      }
    }

    return {
      requestId,
      decision: "DENIED",
      reasonCode: "UNSUPPORTED_CAPABILITY_REQUEST",
      explanation: `Capability requests for ${operation} are denied on this engine profile.`
    }
  }

  /**
   * Commits the expanded package version, updates history, and emits EventBus audits.
   */
  private static async commitRevisedPackage(pkg: ExecutionPackageV2, decision: PolicyDecision, pkgFolder: string) {
    const nextVersion = decision.packageVersion || (pkg.packageVersion + 1)
    
    // Revise the package scopes
    const revisedPkg: ExecutionPackageV2 = {
      ...pkg,
      packageVersion: nextVersion,
      workspace: {
        ...pkg.workspace,
        readScopes: Array.from(new Set([...pkg.workspace.readScopes, decision.grantedScope || ""])),
        writeScopes: Array.from(new Set([...pkg.workspace.writeScopes, decision.grantedScope || ""])),
        createScopes: Array.from(new Set([...pkg.workspace.createScopes, decision.grantedScope || ""]))
      }
    }

    // Save package revision
    const targetFilename = `execution-package-v${nextVersion}.json`
    fs.writeFileSync(path.join(pkgFolder, targetFilename), JSON.stringify(revisedPkg, null, 2))
    
    // Also overwrite v1.json since this is the primary pointer read by DeveloperAgent
    fs.writeFileSync(path.join(pkgFolder, "v1.json"), JSON.stringify(revisedPkg, null, 2))

    // Update history.json audit log
    const historyPath = path.join(pkgFolder, "history.json")
    const history = fs.existsSync(historyPath) ? JSON.parse(fs.readFileSync(historyPath, "utf-8")) : []
    
    const auditEntry = {
      timestamp: new Date().toISOString(),
      fromVersion: pkg.packageVersion,
      toVersion: nextVersion,
      decision: decision.decision,
      reasonCode: decision.reasonCode,
      grantedScope: decision.grantedScope,
      explanation: decision.explanation
    }
    history.push(auditEntry)
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2))

    // Emit event audit to EventBus
    this.eventBus.publish({
      id: `scope-expansion-${Date.now()}`,
      type: "scope_expansion",
      timestamp: new Date().toISOString(),
      payload: {
        projectId: pkg.projectId,
        taskId: pkg.taskId,
        fromPackageVersion: pkg.packageVersion,
        toPackageVersion: nextVersion,
        grantedScope: decision.grantedScope,
        decision: decision.decision,
        reasonCode: decision.reasonCode
      }
    })
  }
}
