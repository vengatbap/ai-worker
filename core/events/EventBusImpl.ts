import { EventBus, AppEvent } from "../interfaces/types"

export class EventBusImpl implements EventBus {
  private static instance: EventBusImpl
  private handlers: Record<string, ((event: AppEvent) => void)[]> = {}

  constructor() {
    if (EventBusImpl.instance) {
      return EventBusImpl.instance
    }
    EventBusImpl.instance = this
  }

  publish(event: AppEvent): void {
    const eventHandlers = this.handlers[event.type] || []
    const wildcardHandlers = this.handlers["*"] || []
    
    // Trigger handlers asynchronously to prevent execution blocking
    setTimeout(() => {
      for (const handler of eventHandlers) {
        try {
          handler(event)
        } catch (err) {
          console.error(`Error in event subscriber for ${event.type}:`, err)
        }
      }
      for (const handler of wildcardHandlers) {
        try {
          handler(event)
        } catch (err) {
          console.error(`Error in wildcard event subscriber for ${event.type}:`, err)
        }
      }
    }, 0)
  }

  subscribe(eventType: string, handler: (event: AppEvent) => void): void {
    if (!this.handlers[eventType]) {
      this.handlers[eventType] = []
    }
    this.handlers[eventType].push(handler)
  }
}
