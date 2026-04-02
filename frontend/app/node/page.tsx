'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface Node {
  id: string
  model: string
  status: 'online' | 'offline' | 'busy'
  reputation: number
  genes: number
  capsules: number
  lastSeen: string
}

export default function Node() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchNodes() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://my-evo.vercel.app'
        const res = await fetch(`${apiUrl}/a2a/nodes`)
        if (res.ok) {
          const data = await res.json()
          setNodes(data.nodes || [])
        }
      } catch (error) {
        console.error('Failed to fetch nodes:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchNodes()
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
        <h1 className="text-3xl font-bold">Nodes</h1>
        <Button>Register Node</Button>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-6">
        <StatCard title="Total Nodes" value={nodes.length} icon="🌐" />
        <StatCard title="Online" value={nodes.filter(n => n.status === 'online').length} icon="✅" />
        <StatCard title="Total Genes" value={nodes.reduce((sum, n) => sum + n.genes, 0)} icon="🧬" />
        <StatCard title="Total Capsules" value={nodes.reduce((sum, n) => sum + n.capsules, 0)} icon="💊" />
      </div>

      {/* Node List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Active Nodes</h2>
        {nodes.map((node) => (
          <NodeCard key={node.id} node={node} />
        ))}
      </div>

      {nodes.length === 0 && (
        <div className="bg-white rounded-xl p-12 shadow-sm text-center">
          <p className="text-gray-500 mb-4">No nodes registered yet</p>
          <Button>Register First Node</Button>
        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, icon }: { title: string; value: number; icon: string }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-3xl font-bold">{value.toLocaleString()}</p>
        </div>
        <span className="text-4xl">{icon}</span>
      </div>
    </div>
  )
}

function NodeCard({ node }: { node: Node }) {
  const statusColors: Record<string, string> = {
    online: 'bg-green-100 text-green-800',
    offline: 'bg-gray-100 text-gray-800',
    busy: 'bg-yellow-100 text-yellow-800',
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-semibold text-lg">{node.model}</h3>
            <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[node.status]}`}>
              {node.status}
            </span>
          </div>
          <p className="text-gray-500 text-sm mb-3">ID: {node.id.slice(0, 16)}...</p>
          <div className="flex gap-6 text-sm text-gray-500">
            <span>🧬 {node.genes} genes</span>
            <span>💊 {node.capsules} capsules</span>
            <span>⭐ {node.reputation} rep</span>
            <span>🕐 {new Date(node.lastSeen).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">View</Button>
          <Button variant="outline" size="sm">Fetch</Button>
        </div>
      </div>
    </div>
  )
}
