"use client";

import { Shield, Lock, Eye, Database, Bell, UserCheck } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="evomap-display text-3xl font-bold text-[var(--color-foreground)] sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-[var(--color-foreground-soft)]">
          Last updated: June 2026. This policy describes how EvoMap AI collects, uses, and protects your personal information.
        </p>
      </div>

      {/* Overview Cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: "color-mix(in oklab, var(--color-gene-green) 12%, transparent)" }}
            >
              <Shield className="h-4 w-4" style={{ color: "var(--color-gene-green)" }} />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-foreground)]">Data Protection</p>
              <p className="text-xs text-[var(--color-foreground-soft)]">Enterprise-grade encryption at rest and in transit</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: "color-mix(in oklab, var(--color-agent-amber) 12%, transparent)" }}
            >
              <Lock className="h-4 w-4" style={{ color: "var(--color-agent-amber)" }} />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-foreground)]">GDPR Compliant</p>
              <p className="text-xs text-[var(--color-foreground-soft)]">Full compliance with EU data protection regulations</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: "color-mix(in oklab, var(--color-capsule-cyan) 12%, transparent)" }}
            >
              <UserCheck className="h-4 w-4" style={{ color: "var(--color-capsule-cyan)" }} />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-foreground)]">Your Rights</p>
              <p className="text-xs text-[var(--color-foreground-soft)]">Access, correct, delete, or export your data anytime</p>
            </div>
          </div>
        </div>
      </section>

      {/* Data We Collect */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5" style={{ color: "var(--color-gene-green)" }} />
          <h2 className="text-xl font-semibold text-[var(--color-foreground)]">Data We Collect</h2>
        </div>
        <div className="space-y-3 text-sm text-[var(--color-foreground-soft)] leading-6">
          <div>
            <h3 className="font-medium text-[var(--color-foreground)]">Account Information</h3>
            <p>Email address, display name, profile avatar. We use OAuth providers (Google, GitHub) for authentication — we never see or store your password.</p>
          </div>
          <div>
            <h3 className="font-medium text-[var(--color-foreground)]">Usage Data</h3>
            <p>Assets created, agents configured, credits balance, dashboard interactions. This data is essential for providing the EvoMap AI service.</p>
          </div>
          <div>
            <h3 className="font-medium text-[var(--color-foreground)]">Technical Data</h3>
            <p>Browser type, IP address, device identifiers, log data. Used for security, performance monitoring, and abuse prevention.</p>
          </div>
          <div>
            <h3 className="font-medium text-[var(--color-foreground)]">Cookies & Local Storage</h3>
            <p>Session tokens (HTTP-only cookies), theme preferences, UI state. No third-party tracking cookies are used.</p>
          </div>
        </div>
      </section>

      {/* How We Use Data */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5" style={{ color: "var(--color-agent-amber)" }} />
          <h2 className="text-xl font-semibold text-[var(--color-foreground)]">How We Use Your Data</h2>
        </div>
        <ul className="list-disc list-inside space-y-2 text-sm text-[var(--color-foreground-soft)] leading-6">
          <li>Provide, maintain, and improve the EvoMap AI platform</li>
          <li>Process transactions and manage credit balances</li>
          <li>Send service-related notifications (security alerts, billing updates)</li>
          <li>Analyze usage patterns to improve user experience</li>
          <li>Detect, investigate, and prevent fraudulent or unauthorized activity</li>
          <li>Comply with legal obligations</li>
        </ul>
      </section>

      {/* Data Sharing */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5" style={{ color: "var(--color-capsule-cyan)" }} />
          <h2 className="text-xl font-semibold text-[var(--color-foreground)]">Data Sharing & Third Parties</h2>
        </div>
        <div className="text-sm text-[var(--color-foreground-soft)] leading-6 space-y-2">
          <p>We do <strong className="text-[var(--color-foreground)]">not</strong> sell, rent, or trade your personal data to third parties.</p>
          <p>We may share data with:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong className="text-[var(--color-foreground)]">OAuth providers</strong> (Google, GitHub) — for authentication only</li>
            <li><strong className="text-[var(--color-foreground)]">Infrastructure providers</strong> — hosting, database, CDN (all under data processing agreements)</li>
            <li><strong className="text-[var(--color-foreground)]">Law enforcement</strong> — only when required by valid legal process</li>
          </ul>
        </div>
      </section>

      {/* Your Rights */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" style={{ color: "var(--color-gene-green)" }} />
          <h2 className="text-xl font-semibold text-[var(--color-foreground)]">Your Rights (GDPR)</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { title: "Right to Access", desc: "Request a copy of all personal data we hold about you." },
            { title: "Right to Rectification", desc: "Correct inaccurate or incomplete personal data." },
            { title: "Right to Erasure", desc: "Request deletion of your personal data (\"right to be forgotten\")." },
            { title: "Right to Portability", desc: "Export your data in a structured, machine-readable format." },
            { title: "Right to Object", desc: "Object to processing of your data for specific purposes." },
            { title: "Right to Restrict", desc: "Request limitation of processing in certain circumstances." },
          ].map((right) => (
            <div key={right.title} className="rounded-xl border border-[var(--color-border)] p-3">
              <h3 className="text-sm font-medium text-[var(--color-foreground)]">{right.title}</h3>
              <p className="text-xs text-[var(--color-foreground-soft)] mt-1">{right.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Data Retention */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" style={{ color: "var(--color-agent-amber)" }} />
          <h2 className="text-xl font-semibold text-[var(--color-foreground)]">Data Retention & Security</h2>
        </div>
        <div className="text-sm text-[var(--color-foreground-soft)] leading-6 space-y-2">
          <p><strong className="text-[var(--color-foreground)]">Retention:</strong> We retain your data for as long as your account is active or as needed to provide services. Upon account deletion, personal data is removed within 30 days, except where retention is required by law.</p>
          <p><strong className="text-[var(--color-foreground)]">Security:</strong> All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We conduct regular security audits and penetration testing.</p>
          <p><strong className="text-[var(--color-foreground)]">Breach Notification:</strong> In the event of a data breach affecting your personal data, we will notify you within 72 hours as required by GDPR Article 33.</p>
        </div>
      </section>

      {/* Contact */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 space-y-2">
        <h2 className="text-xl font-semibold text-[var(--color-foreground)]">Contact Us</h2>
        <p className="text-sm text-[var(--color-foreground-soft)] leading-6">
          For privacy inquiries, data access requests, or to exercise your rights, contact us at{" "}
          <a href="mailto:privacy@evomap.ai" className="text-[var(--color-gene-green)] underline underline-offset-2">
            privacy@evomap.ai
          </a>.
          We will respond to verified requests within 30 days.
        </p>
      </section>
    </div>
  );
}
