"use client";

import { FileText, Scale, AlertTriangle, ShieldCheck, Clock, Mail } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="evomap-display text-3xl font-bold text-[var(--color-foreground)] sm:text-4xl">
          Terms of Service
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-[var(--color-foreground-soft)]">
          Last updated: June 2026. By using EvoMap AI, you agree to these terms. Please read them carefully.
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
              <FileText className="h-4 w-4" style={{ color: "var(--color-gene-green)" }} />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-foreground)]">Open & Transparent</p>
              <p className="text-xs text-[var(--color-foreground-soft)]">Clear terms with no hidden clauses</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: "color-mix(in oklab, var(--color-agent-amber) 12%, transparent)" }}
            >
              <Scale className="h-4 w-4" style={{ color: "var(--color-agent-amber)" }} />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-foreground)]">Fair Use</p>
              <p className="text-xs text-[var(--color-foreground-soft)]">Reasonable terms for all users</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: "color-mix(in oklab, var(--color-capsule-cyan) 12%, transparent)" }}
            >
              <ShieldCheck className="h-4 w-4" style={{ color: "var(--color-capsule-cyan)" }} />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-foreground)]">IP Protected</p>
              <p className="text-xs text-[var(--color-foreground-soft)]">Your creations remain yours</p>
            </div>
          </div>
        </div>
      </section>

      {/* 1. Acceptance */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-gene-green)] text-xs font-bold text-white">1</span>
          <h2 className="text-xl font-semibold text-[var(--color-foreground)]">Acceptance of Terms</h2>
        </div>
        <div className="text-sm text-[var(--color-foreground-soft)] leading-6 space-y-2">
          <p>By accessing or using EvoMap AI (&quot;the Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, you must not use the Service.</p>
          <p>These Terms apply to all visitors, users, and others who access or use the Service. We may update these Terms from time to time. Continued use after changes constitutes acceptance of the revised Terms.</p>
        </div>
      </section>

      {/* 2. Account Terms */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-agent-amber)] text-xs font-bold text-white">2</span>
          <h2 className="text-xl font-semibold text-[var(--color-foreground)]">Account Terms</h2>
        </div>
        <div className="text-sm text-[var(--color-foreground-soft)] leading-6 space-y-2">
          <ul className="list-disc list-inside space-y-1">
            <li>You must be at least 13 years old to use this Service.</li>
            <li>You are responsible for maintaining the security of your account credentials.</li>
            <li>You must provide a valid email address and complete all required registration fields.</li>
            <li>You are responsible for all activity that occurs under your account.</li>
            <li>You must immediately notify us of any unauthorized use of your account.</li>
          </ul>
        </div>
      </section>

      {/* 3. Acceptable Use */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-capsule-cyan)] text-xs font-bold text-white">3</span>
          <h2 className="text-xl font-semibold text-[var(--color-foreground)]">Acceptable Use Policy</h2>
        </div>
        <div className="text-sm text-[var(--color-foreground-soft)] leading-6 space-y-2">
          <p>You agree <strong className="text-[var(--color-foreground)]">not</strong> to:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Use the Service for any illegal purpose or in violation of any applicable laws</li>
            <li>Submit content that is harmful, threatening, abusive, harassing, defamatory, or otherwise objectionable</li>
            <li>Attempt to gain unauthorized access to any portion of the Service or any related systems</li>
            <li>Interfere with or disrupt the integrity or performance of the Service</li>
            <li>Use automated scripts or bots without prior written consent</li>
            <li>Resell, sublicense, or redistribute the Service without authorization</li>
            <li>Reverse-engineer, decompile, or disassemble any part of the Service</li>
          </ul>
        </div>
      </section>

      {/* 4. Intellectual Property */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-gene-green)] text-xs font-bold text-white">4</span>
          <h2 className="text-xl font-semibold text-[var(--color-foreground)]">Intellectual Property</h2>
        </div>
        <div className="text-sm text-[var(--color-foreground-soft)] leading-6 space-y-2">
          <p><strong className="text-[var(--color-foreground)]">Your Content:</strong> You retain all rights to content you create using the Service. By using the Service, you grant us a limited, non-exclusive license to process and serve your content as part of providing the Service.</p>
          <p><strong className="text-[var(--color-foreground)]">Our Content:</strong> The Service itself, including its original content, features, and functionality, is owned by EvoMap AI and is protected by international copyright, trademark, and other intellectual property laws.</p>
          <p><strong className="text-[var(--color-foreground)]">Trademarks:</strong> &quot;EvoMap AI&quot;, the EvoMap logo, and related marks are trademarks of EvoMap AI. You may not use these marks without prior written permission.</p>
        </div>
      </section>

      {/* 5. Credits & Payment */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-agent-amber)] text-xs font-bold text-white">5</span>
          <h2 className="text-xl font-semibold text-[var(--color-foreground)]">Credits & Payment</h2>
        </div>
        <div className="text-sm text-[var(--color-foreground-soft)] leading-6 space-y-2">
          <ul className="list-disc list-inside space-y-1">
            <li>Credits are a virtual currency used within the Service to access premium features and AI agents.</li>
            <li>Credits are non-transferable and cannot be exchanged for cash.</li>
            <li>Unused credits expire 12 months after the date of purchase or last activity.</li>
            <li>We reserve the right to modify credit pricing with 30 days&apos; notice.</li>
            <li>All purchases are final. Refund requests are evaluated on a case-by-case basis.</li>
          </ul>
        </div>
      </section>

      {/* 6. Limitation of Liability */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" style={{ color: "var(--color-agent-amber)" }} />
          <h2 className="text-xl font-semibold text-[var(--color-foreground)]">Limitation of Liability</h2>
        </div>
        <div className="text-sm text-[var(--color-foreground-soft)] leading-6 space-y-2">
          <p>The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either express or implied. To the fullest extent permitted by law, EvoMap AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, profits, or goodwill.</p>
          <p>Our total liability for any claim arising from or related to the Service shall not exceed the amount you paid to us in the 12 months preceding the claim.</p>
        </div>
      </section>

      {/* 7. Termination */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5" style={{ color: "var(--color-capsule-cyan)" }} />
          <h2 className="text-xl font-semibold text-[var(--color-foreground)]">Termination</h2>
        </div>
        <div className="text-sm text-[var(--color-foreground-soft)] leading-6 space-y-2">
          <p>We may terminate or suspend your account at our sole discretion, without prior notice, for conduct that we determine violates these Terms or is harmful to other users, us, or third parties.</p>
          <p>You may terminate your account at any time by contacting us. Upon termination, your right to use the Service will immediately cease. Provisions that by their nature should survive termination shall remain in effect.</p>
        </div>
      </section>

      {/* 8. Governing Law */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5" style={{ color: "var(--color-gene-green)" }} />
          <h2 className="text-xl font-semibold text-[var(--color-foreground)]">Governing Law & Disputes</h2>
        </div>
        <div className="text-sm text-[var(--color-foreground-soft)] leading-6 space-y-2">
          <p>These Terms are governed by the laws of the jurisdiction in which EvoMap AI is incorporated. Any disputes arising from these Terms or the Service shall be resolved through binding arbitration, unless you opt out within 30 days of the dispute arising.</p>
          <p>You agree to resolve disputes with us individually — no class actions or representative proceedings.</p>
        </div>
      </section>

      {/* Contact */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 space-y-2">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" style={{ color: "var(--color-gene-green)" }} />
          <h2 className="text-xl font-semibold text-[var(--color-foreground)]">Contact</h2>
        </div>
        <p className="text-sm text-[var(--color-foreground-soft)] leading-6">
          For questions about these Terms, contact us at{" "}
          <a href="mailto:legal@evomap.ai" className="text-[var(--color-gene-green)] underline underline-offset-2">
            legal@evomap.ai
          </a>.
        </p>
      </section>
    </div>
  );
}
