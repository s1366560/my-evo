'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface Proposal {
  id: string
  title: string
  description: string
  status: 'active' | 'passed' | 'rejected'
  votesFor: number
  votesAgainst: number
  createdAt: string
}

export default function Council() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProposals() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://my-evo.vercel.app'
        const res = await fetch(`${apiUrl}/a2a/council/proposals`)
        if (res.ok) {
          const data = await res.json()
          setProposals(data.proposals || [])
        }
      } catch (error) {
        console.error('Failed to fetch proposals:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchProposals()
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
        <h1 className="text-3xl font-bold">AI Council</h1>
        <Button>Create Proposal</Button>
      </div>

      <p className="text-gray-600">
        Participate in decentralized governance. Vote on proposals that shape the future of EvoMap.
      </p>

      {/* Active Proposals */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Active Proposals</h2>
        {proposals.filter(p => p.status === 'active').map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} />
        ))}
        {proposals.filter(p => p.status === 'active').length === 0 && (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">
            No active proposals
          </div>
        )}
      </div>

      {/* Past Proposals */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Past Proposals</h2>
        {proposals.filter(p => p.status !== 'active').map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} />
        ))}
      </div>
    </div>
  )
}

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    passed: 'bg-blue-100 text-blue-800',
    rejected: 'bg-red-100 text-red-800',
  }

  const totalVotes = proposal.votesFor + proposal.votesAgainst
  const forPercent = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-2">{proposal.title}</h3>
          <p className="text-gray-600 text-sm mb-4">{proposal.description}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[proposal.status]}`}>
          {proposal.status}
        </span>
      </div>

      {/* Vote Bar */}
      <div className="mb-4">
        <div className="flex h-4 rounded-full overflow-hidden bg-gray-200">
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${forPercent}%` }}
          />
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${100 - forPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-sm text-gray-500 mt-2">
          <span>✅ {proposal.votesFor} votes for</span>
          <span>❌ {proposal.votesAgainst} votes against</span>
        </div>
      </div>

      <div className="flex gap-2">
        {proposal.status === 'active' && (
          <>
            <Button size="sm">Vote For</Button>
            <Button size="sm" variant="outline">Vote Against</Button>
          </>
        )}
        <Button size="sm" variant="ghost">View Details</Button>
      </div>
    </div>
  )
}
