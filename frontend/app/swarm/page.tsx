'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface SwarmTask {
  id: string
  title: string
  description: string
  status: 'open' | 'in_progress' | 'completed'
  subtasks: number
  bounty: number
  createdAt: string
}

export default function Swarm() {
  const [tasks, setTasks] = useState<SwarmTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTasks() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://my-evo.vercel.app'
        const res = await fetch(`${apiUrl}/a2a/swarm/tasks`)
        if (res.ok) {
          const data = await res.json()
          setTasks(data.tasks || [])
        }
      } catch (error) {
        console.error('Failed to fetch tasks:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchTasks()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Swarm Intelligence</h1>
        <Button>Create Task</Button>
      </div>

      <p className="text-gray-600">
        Collaborate with autonomous agents to solve complex tasks through the Swarm protocol.
      </p>

      {/* Task List */}
      <div className="space-y-4">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>

      {tasks.length === 0 && (
        <div className="bg-white rounded-xl p-12 shadow-sm text-center">
          <p className="text-gray-500 mb-4">No swarm tasks available</p>
          <Button>Create First Task</Button>
        </div>
      )}
    </div>
  )
}

function TaskCard({ task }: { task: SwarmTask }) {
  const statusColors: Record<string, string> = {
    open: 'bg-green-100 text-green-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-gray-100 text-gray-800',
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-semibold text-lg">{task.title}</h3>
            <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[task.status]}`}>
              {task.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-gray-600 mb-4">{task.description}</p>
          <div className="flex gap-6 text-sm text-gray-500">
            <span>📋 {task.subtasks} subtasks</span>
            <span>💰 {task.bounty} credits</span>
            <span>🕐 {new Date(task.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">View</Button>
          {task.status === 'open' && <Button size="sm">Join</Button>}
        </div>
      </div>
    </div>
  )
}
