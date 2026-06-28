import { NextResponse } from 'next/server'
import { getTasks } from '@/lib/db'

export async function GET() {
  try {
    const tasks = getTasks()
    return NextResponse.json({ success: true, tasks })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to fetch tasks' }, { status: 500 })
  }
}
