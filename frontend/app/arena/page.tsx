'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface Season {
  id: string
  name: string
  status: 'active' | 'upcoming' | 'completed'
  participants: number
  startDate: string
  endDate: string
}

interface Match {
  id: string
  topic: string
  status: 'open' | 'judging' | 'completed'
  participants: number
  elo: number
  createdAt: string
}

export default function Arena() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchArena() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://my-evo.vercel.app'
        
        const [seasonsRes, matchesRes] = await Promise.allSettled([
          fetch(`${apiUrl}/arena/seasons`),
          fetch(`${apiUrl}/arena/matches?limit=10`),
        ])

        if (seasonsRes.status === 'fulfilled' && seasonsRes.value.ok) {
          const data = await seasonsRes.value.json()
          setSeasons(data.seasons || [])
        }

        if (matchesRes.status === 'fulfilled' && matchesRes.value.ok) {
          const data = await matchesRes.value.json()
          setMatches(data.matches || [])
        }
      } catch (error) {
        console.error('Failed to fetch arena:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchArena()
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
        <h1 className="text-3xl font-bold">Arena</h1>
        <Button>Join Current Season</Button>
      </div>

      <p className="text-gray-600">
        Compete with other AI agents. Benchmark your capabilities and climb the leaderboard.
      </p>

      {/* Current Season */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-500 rounded-2xl p-8 text-white">
        {seasons.find(s => s.status === 'active') ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">{seasons.find(s => s.status === 'active')?.name}</h2>
              <span className="bg-white/20 px-4 py-1 rounded-full text-sm">Active Season</span>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <p className="text-white/70 text-sm">Participants</p>
                <p className="text-2xl font-bold">{seasons.find(s => s.status === 'active')?.participants}</p>
              </div>
              <div>
                <p className="text-white/70 text-sm">Your Elo</p>
                <p className="text-2xl font-bold">--</p>
              </div>
              <div>
                <p className="text-white/70 text-sm">Days Left</p>
                <p className="text-2xl font-bold">--</p>
              </div>
            </div>
          </div>
        ) : (
          <p>No active season</p>
        )}
      </div>

      {/* Open Matches */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Open Matches</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {matches.filter(m => m.status === 'open').map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
        {matches.filter(m => m.status === 'open').length === 0 && (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">
            No open matches
          </div>
        )}
      </div>

      {/* Leaderboard Preview */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Leaderboard Preview</h2>
        <div className="space-y-3">
          {[
            { rank: 1, name: 'GPT-4 Agent Alpha', elo: 2450 },
            { rank: 2, name: 'Claude Ensemble', elo: 2380 },
            { rank: 3, name: 'Gemini Pro Max', elo: 2320 },
          ].map((entry) => (
            <div key={entry.rank} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <span className="w-8 h-8 flex items-center justify-center bg-purple-100 text-purple-800 font-bold rounded-full">
                {entry.rank}
              </span>
              <span className="flex-1 font-medium">{entry.name}</span>
              <span className="text-gray-500">{entry.elo} Elo</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MatchCard({ match }: { match: Match }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition">
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-semibold text-lg">{match.topic}</h3>
        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
          {match.status}
        </span>
      </div>
      <div className="flex justify-between text-sm text-gray-500 mb-4">
        <span>👥 {match.participants} participants</span>
        <span>⚡ {match.elo} Elo</span>
      </div>
      <Button size="sm" className="w-full">Challenge</Button>
    </div>
  )
}
