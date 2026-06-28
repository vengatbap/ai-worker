import { ToolService, PolicyService, ExecutionContext } from "../interfaces/types"
import { runTests } from "../../worker/test-runner"
import { commitAndPush } from "../../worker/git-manager"
import fs from "fs"
import path from "path"

export class ToolServiceImpl implements ToolService {
  private policyService: PolicyService

  constructor(policyService: PolicyService) {
    this.policyService = policyService
  }

  async executeTool(toolName: string, args: any, context: ExecutionContext): Promise<any> {
    // 1. Audit check against the Policy Service
    const check = await this.policyService.validate(toolName, args, context)
    if (!check.allowed) {
      throw new Error(check.reason || `Tool execution blocked by policy for tool: ${toolName}`)
    }

    context.logger(`Executing tool: ${toolName}`)

    // 2. Routing tool execution
    switch (toolName) {
      case "write_file": {
        const repo = process.env.REPO_PATH || "./repo"
        const fullPath = path.resolve(repo, args.filePath)
        
        fs.mkdirSync(path.dirname(fullPath), { recursive: true })
        fs.writeFileSync(fullPath, args.content)
        return { success: true, filePath: fullPath }
      }

      case "read_file": {
        const repo = process.env.REPO_PATH || "./repo"
        const fullPath = path.resolve(repo, args.filePath)
        if (!fs.existsSync(fullPath)) {
          throw new Error(`File not found: ${args.filePath}`)
        }
        return { success: true, content: fs.readFileSync(fullPath, "utf-8") }
      }

      case "run_validation": {
        const repo = process.env.REPO_PATH || "./repo"
        const result = runTests(repo)
        return result
      }

      case "git_deploy": {
        const repo = process.env.REPO_PATH || "./repo"
        await commitAndPush(repo, args.commitMessage || "AI auto-deployment commit")
        return { success: true }
      }

      default:
        throw new Error(`Unknown or unsupported tool registered: ${toolName}`)
    }
  }
}
