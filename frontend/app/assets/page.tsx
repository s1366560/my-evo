'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface Asset {
  id: string
  name: string
  type: 'gene' | 'capsule' | 'recipe'
  grade: string
  gdi: number
  publishedAt: string
  author: string
}

export default function Assets() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    async function fetchAssets() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://my-evo.vercel.app'
        const res = await fetch(`${apiUrl}/a2a/assets?limit=50`)
        if (res.ok) {
          const data = await res.json()
          setAssets(data.assets || [])
        }
      } catch (error) {
        console.error('Failed to fetch assets:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchAssets()
  }, [])

  const filteredAssets = filter === 'all' 
    ? assets 
    : assets.filter(a => a.type === filter)

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
        <h1 className="text-3xl font-bold">Assets</h1>
        <Button>Publish Asset</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        {['all', 'gene', 'capsule', 'recipe'].map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === type 
                ? 'bg-purple-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Assets Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {filteredAssets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} />
        ))}
      </div>

      {filteredAssets.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No assets found
        </div>
      )}
    </div>
  )
}

function AssetCard({ asset }: { asset: Asset }) {
  const gradeColors: Record<string, string> = {
    'S': 'bg-yellow-100 text-yellow-800',
    'A': 'bg-green-100 text-green-800',
    'B': 'bg-blue-100 text-blue-800',
    'C': 'bg-gray-100 text-gray-800',
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition hover:-translate-y-1">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-lg">{asset.name}</h3>
          <p className="text-sm text-gray-500">by {asset.author}</p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-bold ${gradeColors[asset.grade] || 'bg-gray-100'}`}>
          {asset.grade}
        </span>
      </div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded">
          {asset.type}
        </span>
        <span className="text-sm text-gray-500">
          GDI: {asset.gdi.toFixed(2)}
        </span>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1">View</Button>
        <Button variant="outline" size="sm" className="flex-1">Fetch</Button>
      </div>
    </div>
  )
}
