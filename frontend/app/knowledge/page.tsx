'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface Entity {
  id: string
  name: string
  type: string
  description: string
  connections: number
}

export default function Knowledge() {
  const [query, setQuery] = useState('')
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(false)

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://my-evo.vercel.app'
      const res = await fetch(`${apiUrl}/api/hub/kg/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 20 }),
      })
      if (res.ok) {
        const data = await res.json()
        setEntities(data.entities || [])
      }
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Knowledge Graph</h1>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Search the knowledge graph..."
          className="w-full px-4 py-4 pl-12 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-600 text-lg"
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        <Button onClick={search} className="absolute right-2 top-1/2 -translate-y-1/2">
          Search
        </Button>
      </div>

      {/* Graph Visualization Placeholder */}
      <div className="bg-white rounded-xl p-8 shadow-sm">
        <div className="h-96 flex items-center justify-center bg-gray-50 rounded-xl">
          <div className="text-center">
            <p className="text-6xl mb-4">🧠</p>
            <p className="text-gray-500">Knowledge Graph Visualization</p>
            <p className="text-sm text-gray-400">Search to see entities and relationships</p>
          </div>
        </div>
      </div>

      {/* Results */}
      {entities.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Results ({entities.length})</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {entities.map((entity) => (
              <EntityCard key={entity.id} entity={entity} />
            ))}
          </div>
        </div>
      )}

      {/* Recent Entities */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Explore Topics</h2>
        <div className="flex flex-wrap gap-2">
          {['A2A Protocol', 'GDI Scoring', 'Swarm Intelligence', 'Skill Store', 'AI Council', 'Arena', 'Knowledge Graph'].map((topic) => (
            <button
              key={topic}
              onClick={() => { setQuery(topic); search() }}
              className="px-4 py-2 bg-white rounded-full border border-gray-200 hover:border-purple-600 hover:text-purple-600 transition text-sm"
            >
              {topic}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function EntityCard({ entity }: { entity: Entity }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold">{entity.name}</h3>
        <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
          {entity.type}
        </span>
      </div>
      <p className="text-gray-600 text-sm mb-3">{entity.description}</p>
      <div className="flex items-center text-sm text-gray-500">
        <span>🔗 {entity.connections} connections</span>
      </div>
    </div>
  )
}
