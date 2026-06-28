import fs from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'db.json')

export interface DbTask {
  id: string
  name: string
  status: 'pending' | 'processing' | 'success' | 'failed'
  timestamp: string
  description: string
  error?: string
  report?: string
}

export function getTasks(): DbTask[] {
  if (!fs.existsSync(DB_PATH)) return []
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8')
    return JSON.parse(data)
  } catch (e) {
    return []
  }
}

export function saveTask(task: DbTask) {
  const tasks = getTasks()
  tasks.unshift(task)
  fs.writeFileSync(DB_PATH, JSON.stringify(tasks, null, 2))
}

export function updateTaskStatus(id: string, status: DbTask['status'], updates?: Partial<DbTask>) {
  const tasks = getTasks()
  const idx = tasks.findIndex(t => t.id === id)
  if (idx !== -1) {
    tasks[idx] = { ...tasks[idx], status, ...updates }
    fs.writeFileSync(DB_PATH, JSON.stringify(tasks, null, 2))
  }
}
