'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CheckCircle, AlertCircle, X, Save, RotateCcw } from 'lucide-react';
import { GDIScorePreview } from '@/components/publish/GDIScorePreview';

interface FormErrors {
  name?: string;
  description?: string;
  content?: string;
}

interface FormData {
  type: 'gene' | 'capsule';
  name: string;
  description: string;
  content: string;
  tags: string[];
  license: string;
  parentId?: string;
}

const STORAGE_KEY = 'myevo_publish_draft';

export default function PublishPage() {
  const [activeTab, setActiveTab] = useState<'gene' | 'capsule'>('gene');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [form, setForm] = useState<FormData>({
    type: 'gene',
    name: '',
    description: '',
    content: '',
    tags: [],
    license: 'MIT',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [tagInput, setTagInput] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm(parsed);
        setLastSaved(new Date(parsed.savedAt));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (!isDirty) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...form, savedAt: new Date().toISOString() }));
        setLastSaved(new Date());
        setIsDirty(false);
      } catch {
        // Ignore localStorage errors
      }
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [form, isDirty]);

  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };

  // Validation logic
  const validateField = (name: string, value: string): string | undefined => {
    switch (name) {
      case 'name':
        if (!value.trim()) return 'Name is required';
        if (value.length < 3) return 'Name must be at least 3 characters';
        if (value.length > 100) return 'Name must be less than 100 characters';
        return undefined;
      case 'description':
        if (!value.trim()) return 'Description is required';
        if (value.length < 10) return 'Description must be at least 10 characters';
        if (value.length > 500) return 'Description must be less than 500 characters';
        return undefined;
      case 'content':
        if (!value.trim()) return 'Content is required';
        if (value.length < 20) return 'Content must be at least 20 characters';
        return undefined;
      default:
        return undefined;
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    newErrors.name = validateField('name', form.name);
    newErrors.description = validateField('description', form.description);
    newErrors.content = validateField('content', form.content);
    setErrors(newErrors);
    return !Object.values(newErrors).some(e => e !== undefined);
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const value = form[field as keyof FormData] as string;
    const error = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      setForm(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
      markDirty();
    }
  };

  const handleRemoveTag = (tag: string) => {
    setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
    markDirty();
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to clear the form? This cannot be undone.')) {
      setForm({ type: activeTab, name: '', description: '', content: '', tags: [], license: 'MIT' });
      setTouched({});
      setErrors({});
      setResult(null);
      setIsDirty(false);
      localStorage.removeItem(STORAGE_KEY);
      setLastSaved(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, description: true, content: true });

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch('/api/frontend/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: form.type,
          name: form.name,
          description: form.description,
          content: { dna: form.content, prompt: '', model: '', tools: [] },
          tags: form.tags,
          license: form.license,
          parent_id: form.parentId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({ success: true, message: `${form.type} "${data.name}" published! ID: ${data.asset_id}` });
        setForm({ type: form.type, name: '', description: '', content: '', tags: [], license: 'MIT' });
        setTouched({});
        setErrors({});
        setIsDirty(false);
        localStorage.removeItem(STORAGE_KEY);
        setLastSaved(null);
      } else {
        setResult({ success: false, message: data.error || 'Failed to publish' });
      }
    } catch {
      setResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900">Publish Asset</h1>
          <p className="mt-2 text-gray-600">Share your Gene or Capsule with the EvoMap community</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form Column */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <Card className="p-4 border-l-4 border-blue-500">
                <h3 className="font-semibold text-gray-900">Gene (基因)</h3>
                <p className="mt-1 text-sm text-gray-600">A reusable strategy, pattern, or best practice.</p>
              </Card>
              <Card className="p-4 border-l-4 border-purple-500">
                <h3 className="font-semibold text-gray-900">Capsule (胶囊)</h3>
                <p className="mt-1 text-sm text-gray-600">Validation results or execution evidence linked to a Gene.</p>
              </Card>
            </div>

            <div className="flex gap-4 mb-6">
              <button
                type="button"
                onClick={() => { setActiveTab('gene'); setForm(prev => ({ ...prev, type: 'gene' })); markDirty(); }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'gene'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Publish Gene
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('capsule'); setForm(prev => ({ ...prev, type: 'capsule' })); markDirty(); }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'capsule'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Publish Capsule
              </button>
              {/* Auto-save indicator */}
              <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
                {lastSaved && (
                  <span className="flex items-center gap-1">
                    <Save className="w-4 h-4" />
                    {isDirty ? 'Unsaved changes' : `Saved ${lastSaved.toLocaleTimeString()}`}
                  </span>
                )}
              </div>
            </div>

            <Card className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {activeTab === 'gene' ? 'Gene' : 'Capsule'} Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => { setForm(prev => ({ ...prev, name: e.target.value })); markDirty(); }}
                  onBlur={() => handleBlur('name')}
                  placeholder={activeTab === 'gene' ? 'e.g., Optimized Data Pipeline' : 'e.g., Benchmark Results'}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 ${
                    touched.name && errors.name
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                      : touched.name && !errors.name && form.name
                      ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                {touched.name && form.name && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {errors.name ? (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                )}
              </div>
              {touched.name && errors.name && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {errors.name}
                </p>
              )}
              {touched.name && !errors.name && form.name && (
                <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Looks good!
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Description <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => { setForm(prev => ({ ...prev, description: e.target.value })); markDirty(); }}
                  onBlur={() => handleBlur('description')}
                  placeholder="Describe what this asset does"
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 ${
                    touched.description && errors.description
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                      : touched.description && !errors.description && form.description
                      ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                {touched.description && form.description && (
                  <div className="absolute right-3 top-3">
                    {errors.description ? (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                )}
              </div>
              {touched.description && errors.description && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {errors.description}
                </p>
              )}
              {touched.description && !errors.description && form.description && (
                <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Looks good!
                </p>
              )}
            </div>

            {activeTab === 'capsule' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Linked Gene ID (Optional)
                </label>
                <input
                  type="text"
                  value={form.parentId || ''}
                  onChange={(e) => { setForm(prev => ({ ...prev, parentId: e.target.value })); markDirty(); }}
                  placeholder="e.g., gene_abc123"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">
                {activeTab === 'gene' ? 'DNA / Core Logic' : 'Evidence / Validation Results'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <textarea
                  rows={8}
                  value={form.content}
                  onChange={(e) => { setForm(prev => ({ ...prev, content: e.target.value })); markDirty(); }}
                  onBlur={() => handleBlur('content')}
                  placeholder={activeTab === 'gene' ? 'The core implementation or strategy definition' : 'Document your validation results'}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm font-mono text-sm focus:outline-none focus:ring-2 ${
                    touched.content && errors.content
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                      : touched.content && !errors.content && form.content
                      ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                {touched.content && form.content && (
                  <div className="absolute right-3 top-3">
                    {errors.content ? (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                )}
              </div>
              {touched.content && errors.content && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {errors.content}
                </p>
              )}
              {touched.content && !errors.content && form.content && (
                <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Looks good!
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">License</label>
                <select
                  value={form.license}
                  onChange={(e) => { setForm(prev => ({ ...prev, license: e.target.value })); markDirty(); }}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="MIT">MIT</option>
                  <option value="Apache-2.0">Apache 2.0</option>
                  <option value="GPL-3.0">GPL 3.0</option>
                  <option value="BSD-3-Clause">BSD 3-Clause</option>
                  <option value="CC0-1.0">CC0 (Public Domain)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Tags</label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                    placeholder="Add tag"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <Button type="button" variant="secondary" onClick={handleAddTag}>Add</Button>
                </div>
              </div>
            </div>

            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {tag}
                    <button type="button" onClick={() => handleRemoveTag(tag)} className="ml-1 text-blue-600 hover:text-blue-800">×</button>
                  </span>
                ))}
              </div>
            )}

            {result && (
              <div className={`p-4 rounded-md ${result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {result.message}
              </div>
            )}

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleReset} className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
              <Button type="submit" variant="default" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? 'Publishing...' : `Publish ${activeTab === 'gene' ? 'Gene' : 'Capsule'}`}
              </Button>
            </div>
          </form>
        </Card>
          </div>

          {/* GDI Score Preview Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <GDIScorePreview
                name={form.name}
                description={form.description}
                content={form.content}
                tags={form.tags}
                license={form.license}
                type={form.type}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
