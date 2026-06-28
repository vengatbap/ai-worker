import { NextResponse } from 'next/server'
import { saveTask, updateTaskStatus } from '@/lib/db'
import { processTask } from '../../../../worker/engine'

export async function POST(req: Request) {
  try {
    const { taskContent, taskName } = await req.json()

    if (!taskContent) {
      return NextResponse.json({ success: false, error: 'Task content is required' }, { status: 400 })
    }

    const taskId = Date.now().toString()
    
    // Save initial task state as processing since we launch it immediately
    const newTask = {
      id: taskId,
      name: taskName || 'SaaS Generation Task',
      status: 'processing' as const,
      timestamp: new Date().toLocaleTimeString(),
      description: taskContent
    }
    
    saveTask(newTask)

    // Trigger the task asynchronously in the background.
    // The promise will resolve after specs, generation, tests, and self-correction.
    processTask(taskContent, taskName)
      .then((result) => {
        if (result.success) {
          updateTaskStatus(taskId, 'success', { report: result.report })
        } else {
          updateTaskStatus(taskId, 'failed', { error: result.error })
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
