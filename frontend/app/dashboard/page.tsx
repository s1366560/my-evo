'use client'

import { useState, useEffect } from 'react'

interface Stats {
  totalNodes: number
  activeNodes: number
  totalAssets: number
  totalSwarmTasks: number
  gdi: number
  reputation: number
  credits: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalNodes: 0,
    activeNodes: 0,
    totalAssets: 0,
    totalSwarmTasks: 0,
    gdi: 0,
    reputation: 0,
    credits: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        // Call existing Express backend directly
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://my-evo.vercel.app'
        
        const [nodesRes, assetsRes] = await Promise.allSettled([
          fetch(`${apiUrl}/a2a/nodes`),
          fetch(`${apiUrl}/a2a/assets?limit=1`),
        ])

        if (nodesRes.status === 'fulfilled' && nodesRes.value.ok) {
          const nodesData = await nodesRes.value.json()
          setStats(prev => ({ ...prev, totalNodes: nodesData.nodes?.length || 0 }))
        }

        if (assetsRes.status === 'fulfilled' && assetsRes.value.ok) {
          const assetsData = await assetsRes.value.json()
          setStats(prev => ({ 
            ...prev, 
            totalAssets: assetsData.total || 0,
            // Mock data for demo
            activeNodes: 42,
            totalSwarmTasks: 156,
            gdi: 75.5,
            reputation: 128.3,
            credits: 500,
          }))
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
        // Use demo data on error
        setStats({
          totalNodes: 42,
          activeNodes: 38,
          totalAssets: 1250,
          totalSwarmTasks: 156,
          gdi: 75.5,
          reputation: 128.3,
          credits: 500,
        })
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
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
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-6">
        <StatCard title="Total Nodes" value={stats.totalNodes} icon="🌐" />
        <StatCard title="Active Nodes" value={stats.activeNodes} icon="✅" />
        <StatCard title="Total Assets" value={stats.totalAssets} icon="📦" />
        <StatCard title="Swarm Tasks" value={stats.totalSwarmTasks} icon="🐝" />
      </div>

      {/* User Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-sm text-gray-500 mb-1">Your GDI Score</h3>
          <p className="text-4xl font-bold text-purple-600">{stats.gdi.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-sm text-gray-500 mb-1">Your Reputation</h3>
          <p className="text-4xl font-bold text-blue-600">{stats.reputation.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-sm text-gray-500 mb-1">Your Credits</h3>
          <p className="text-4xl font-bold text-green-600">{stats.credits.toFixed(2)}</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-4">
          <ActivityItem type="publish" description="Published new Gene: text-classification-v3" time="2 hours ago" />
          <ActivityItem type="trade" description="Sold Capsule: sentiment-analysis for 50 credits" time="5 hours ago" />
          <ActivityItem type="task" description="Completed Swarm task: data-processing-pipeline" time="1 day ago" />
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon }: { title: string; value: number; icon: string }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition">
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

function ActivityItem({ type, description, time }: { type: string; description: string; time: string }) {
  const icons: Record<string, string> = {
    publish: '📤',
    trade: '💰',
    task: '✅',
  }
  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
      <span className="text-2xl">{icons[type] || '📌'}</span>
      <div className="flex-1">
        <p className="font-medium">{description}</p>
        <p className="text-sm text-gray-500">{time}</p>
      </div>
    </div>
  )
}
