import { NextResponse } from 'next/server'
import { saveTask, updateTaskStatus } from '@/lib/db'
import { Orchestrator } from '../../../../worker/orchestrator'

export async function POST(req: Request) {
  try {
    const { taskContent, taskName } = await req.json()

    if (!taskContent) {
      return NextResponse.json({ success: false, error: 'Task content is required' }, { status: 400 })
    }

    const taskId = Date.now().toString()
    
    // Save initial task state as pending
    const newTask = {
      id: taskId,
      name: taskName || 'SaaS Generation Task',
      status: 'pending' as const,
      timestamp: new Date().toLocaleTimeString(),
      description: taskContent
    }
    
    saveTask(newTask)

    // Trigger the Orchestrator asynchronously in the background.
    const orchestrator = new Orchestrator()
    
    orchestrator.runProjectWorkflow(taskId, taskName || 'SaaS Task', taskContent)
      .then((result) => {
        if (result.status === "success") {
          updateTaskStatus(taskId, 'success', { report: result.logs.join('\n') })
        } else {
          updateTaskStatus(taskId, 'failed', { error: result.logs.join('\n') })
        }
      })
      .catch((err) => {
        updateTaskStatus(taskId, 'failed', { error: err.message })
      })

    // Return immediately to keep the UI responsive and polling
    return NextResponse.json({ success: true, taskId })

  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
