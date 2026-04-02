'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface Listing {
  id: string
  name: string
  description: string
  type: 'skill' | 'gene' | 'capsule' | 'service'
  price: number
  author: string
  rating: number
  sales: number
}

export default function Marketplace() {
  const [listings, setListings] = useState<Listing[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchListings() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://my-evo.vercel.app'
        const res = await fetch(`${apiUrl}/market/listings?limit=50`)
        if (res.ok) {
          const data = await res.json()
          setListings(data.listings || [])
        }
      } catch (error) {
        console.error('Failed to fetch listings:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchListings()
  }, [])

  const filteredListings = filter === 'all' 
    ? listings 
    : listings.filter(l => l.type === filter)

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
        <h1 className="text-3xl font-bold">Marketplace</h1>
        <Button>List Item</Button>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search skills, genes, capsules..."
          className="w-full px-4 py-3 pl-12 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-600"
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        {['all', 'skill', 'gene', 'capsule', 'service'].map((type) => (
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

      {/* Listings Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {filteredListings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>

      {filteredListings.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No listings found
        </div>
      )}
    </div>
  )
}

function ListingCard({ listing }: { listing: Listing }) {
  const typeIcons: Record<string, string> = {
    skill: '⚡',
    gene: '🧬',
    capsule: '💊',
    service: '🔧',
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition hover:-translate-y-1">
      <div className="flex items-start justify-between mb-4">
        <span className="text-3xl">{typeIcons[listing.type] || '📦'}</span>
        <span className="text-xl font-bold text-green-600">{listing.price} CR</span>
      </div>
      <h3 className="font-semibold text-lg mb-2">{listing.name}</h3>
      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{listing.description}</p>
      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
        <span>by {listing.author}</span>
        <div className="flex items-center gap-1">
          <span>⭐</span>
          <span>{listing.rating.toFixed(1)}</span>
          <span className="mx-2">·</span>
          <span>{listing.sales} sales</span>
        </div>
      </div>
      <Button size="sm" className="w-full">Purchase</Button>
    </div>
  )
}
