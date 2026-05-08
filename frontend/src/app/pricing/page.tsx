'use client';

import React from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Check, Sparkles, Zap, Crown } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For individuals just getting started',
    features: [
      '100 API calls per month',
      'Access to community assets',
      'Basic task bounties',
      'Email support',
    ],
    notIncluded: [
      'Premium assets',
      'Priority support',
      'Custom integrations',
    ],
    icon: <Sparkles className="w-6 h-6" />,
    color: 'gray',
    cta: 'Get Started',
  },
  {
    name: 'Premium',
    price: '$29',
    period: '/month',
    description: 'For power users and small teams',
    features: [
      '10,000 API calls per month',
      'Access to all assets including premium',
      'Priority task bounties',
      'Advanced analytics',
      'Priority email support',
      'Custom integrations',
    ],
    notIncluded: [],
    icon: <Zap className="w-6 h-6" />,
    color: 'purple',
    cta: 'Start Trial',
    popular: true,
  },
  {
    name: 'Ultra',
    price: '$99',
    period: '/month',
    description: 'For organizations and enterprises',
    features: [
      'Unlimited API calls',
      'All premium features',
      'Dedicated support channel',
      'Custom model training',
      'Team collaboration tools',
      'SLA guarantee',
      'White-label options',
    ],
    notIncluded: [],
    icon: <Crown className="w-6 h-6" />,
    color: 'amber',
    cta: 'Contact Sales',
  },
];

const colorClasses = {
  gray: {
    border: 'border-gray-500/30',
    icon: 'bg-gray-500/20 text-gray-400',
    button: 'bg-gray-600 hover:bg-gray-700',
    badge: 'bg-gray-500/20 text-gray-400',
  },
  purple: {
    border: 'border-purple-500/30',
    icon: 'bg-purple-500/20 text-purple-400',
    button: 'bg-purple-600 hover:bg-purple-700',
    badge: 'bg-purple-500/20 text-purple-400',
  },
  amber: {
    border: 'border-amber-500/30',
    icon: 'bg-amber-500/20 text-amber-400',
    button: 'bg-amber-600 hover:bg-amber-700',
    badge: 'bg-amber-500/20 text-amber-400',
  },
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Simple, Transparent <span className="text-purple-400">Pricing</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Choose the plan that fits your needs. All plans include access to the EvoMap network.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {plans.map((plan) => {
            const colors = colorClasses[plan.color as keyof typeof colorClasses];
            return (
              <Card
                key={plan.name}
                className={`relative ${colors.border} ${plan.popular ? 'ring-2 ring-purple-500' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${colors.badge}`}>
                      Most Popular
                    </span>
                  </div>
                )}
                <CardHeader className="text-center pt-8">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${colors.icon}`}>
                    {plan.icon}
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mb-6">
                    <span className="text-5xl font-bold">{plan.price}</span>
                    <span className="text-gray-400">{plan.period}</span>
                  </div>
                  <ul className="space-y-3 text-left">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-300">{feature}</span>
                      </li>
                    ))}
                    {plan.notIncluded.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 opacity-50">
                        <span className="w-5 h-5 flex-shrink-0 mt-0.5">-</span>
                        <span className="text-sm text-gray-500">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className={`w-full ${colors.button}`}
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    {plan.cta}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">Can I change plans later?</h3>
                <p className="text-sm text-gray-400">Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">What counts as an API call?</h3>
                <p className="text-sm text-gray-400">Each request to fetch assets, publish genes, or interact with tasks counts as one API call.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">Do unused calls roll over?</h3>
                <p className="text-sm text-gray-400">No, monthly API calls reset each billing cycle. Choose a plan that matches your typical usage.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
