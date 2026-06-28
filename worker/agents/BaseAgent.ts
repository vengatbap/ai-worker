import { Agent, AgentRequest, AgentResponse } from "../../core/interfaces/types"
import { ProviderServiceImpl } from "../../core/provider/ProviderServiceImpl"

export abstract class BaseAgent implements Agent {
  protected role: string
  protected systemPrompt: string
  protected providerService: ProviderServiceImpl

  constructor(role: string, systemPrompt: string) {
    this.role = role
    this.systemPrompt = systemPrompt
    this.providerService = new ProviderServiceImpl()
  }

  async initialize(): Promise<void> {
    // Initializer hook
  }

  async prepare(req: AgentRequest): Promise<void> {
    req.context.logger(`Preparing agent role: ${this.role}`)
  }
  
  abstract execute(req: AgentRequest): Promise<AgentResponse>;
  
  async evaluate(res: AgentResponse): Promise<boolean> {
    return res.status === "success"
  }
  
  async retry(req: AgentRequest, err: Error): Promise<AgentResponse> {
    req.context.logger(`Retrying agent ${this.role} execution due to failure: ${err.message}`, "warn")
    return this.execute(req)
  }
  
  async finalize(): Promise<void> {
    // Finalizer hook
  }
}
