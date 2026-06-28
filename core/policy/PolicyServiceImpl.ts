import { PolicyService, ExecutionContext } from "../interfaces/types"
import path from "path"

export class PolicyServiceImpl implements PolicyService {
  async validate(
    toolName: string,
    args: any,
    context: ExecutionContext
  ): Promise<{ allowed: boolean; reason?: string }> {
    
    // Safety check 1: Never delete files outside workspace
    if (toolName === "delete_file" || (toolName === "write_file" && args.overwrite === true)) {
      const targetPath = path.resolve(args.filePath || args.targetFile || "")
      const workspaceDir = path.resolve(process.cwd())
      
      if (!targetPath.startsWith(workspaceDir)) {
        return {
          allowed: false,
          reason: `Policy Violation: Cannot write or delete files outside current project workspace path. Target: ${targetPath}`
        }
      }
    }

    // Safety check 2: Never push directly to main branch
    if (toolName === "git_push" || toolName === "execute_command") {
      const commandString = (args.command || args.commandLine || "").toLowerCase()
      if (commandString.includes("push origin main") || commandString.includes("push origin master")) {
        return {
          allowed: false,
          reason: "Policy Violation: Direct push to production default branches (main/master) is strictly prohibited."
        }
      }
    }

    // Safety check 3: Avoid exposing environment secrets
    if (toolName === "write_file" || toolName === "execute_command") {
      const content = JSON.stringify(args)
      if (content.includes("OPENAI_API_KEY") || content.includes("sk-proj-") || content.includes("MISTRAL_API_KEY")) {
        return {
          allowed: false,
          reason: "Policy Violation: Prevented action that exposes or leaks environment credentials and API secrets."
        }
      }
    }

    return { allowed: true }
  }
}
