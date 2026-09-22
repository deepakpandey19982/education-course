'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { ImageUploadField } from './_components/ImageUploadField';
import { fetchAllSeriesWithMetrics } from './_components/testSeriesHelpers';
import type { TestSeries } from '@/types/supabase';

type SeriesWithMetrics = TestSeries & {
  subjectCount: number;
  testCount: number;
  questionCount: number;
  is_paid: boolean;
};

type SeriesModalForm = {
  id?: string;
  title: string;
  description: string;
  thumbnail_url: string;
  is_paid: boolean;
  is_published: boolean;
  order: number;
};

const emptySeriesModalForm = (isPaid = false): SeriesModalForm => ({
  title: '',
  description: '',
  thumbnail_url: '',
  is_paid: isPaid,
  is_published: true,
  order: 0,
});

export default function AdminTestSeriesCentralPage() {
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'all';

  const [seriesList, setSeriesList] = useState<SeriesWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'free' | 'paid'>(
    initialFilter === 'free' || initialFilter === 'paid' ? initialFilter : 'all'
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState<SeriesModalForm>(emptySeriesModalForm());
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAllSeriesWithMetrics();
      setSeriesList(data);
    } catch (error) {
      console.error('Failed to load test series:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredSeries = useMemo(() => {
    return seriesList.filter((item) => {
      // Type filter
      if (activeFilter === 'free' && item.is_paid) return false;
      if (activeFilter === 'paid' && !item.is_paid) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(query);
        const matchesDesc = item.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc) return false;
      }

      return true;
    });
  }, [activeFilter, searchQuery, seriesList]);

  const openCreateModal = () => {
    setModalForm(emptySeriesModalForm(activeFilter === 'paid'));
    setIsModalOpen(true);
  };

  const openEditModal = (item: SeriesWithMetrics) => {
    setModalForm({
      id: item.id,
      title: item.title,
      description: item.description || '',
      thumbnail_url: item.thumbnail_url || '',
      is_paid: item.is_paid,
      is_published: item.is_published,
      order: item.order,
    });
    setIsModalOpen(true);
  };

  const handleSaveSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.title.trim()) {
      alert('Please enter a Test Series Title.');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        title: modalForm.title.trim(),
        description: modalForm.description.trim() || null,
        thumbnail_url: modalForm.thumbnail_url || null,
        is_published: modalForm.is_published,
        order: Number(modalForm.order) || 0,
        updated_at: new Date().toISOString(),
      };

      // Attempt to include is_paid if supported
      payload.is_paid = modalForm.is_paid;

      if (modalForm.id) {
        let { error } = await supabase
          .from('test_series')
          .update(payload)
          .eq('id', modalForm.id);

        if (error && error.message?.includes('is_paid')) {
          delete payload.is_paid;
          const retry = await supabase
            .from('test_series')
            .update(payload)
            .eq('id', modalForm.id);
          error = retry.error;
        }

        if (error) throw error;
      } else {
        let { error } = await supabase.from('test_series').insert(payload);

        if (error && error.message?.includes('is_paid')) {
          delete payload.is_paid;
          const retry = await supabase.from('test_series').insert(payload);
          error = retry.error;
        }

        if (error) throw error;
      }

      setIsModalOpen(false);
      await loadData();
    } catch (error: any) {
      console.error('Error saving series:', error);
      alert(error.message || 'Could not save Test Series.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSeries = async (id: string, title: string) => {
    const msg = `Are you sure you want to delete "${title}"?\n\nThis will permanently delete the Test Series along with all its subjects, tests, and questions.`;
    if (!window.confirm(msg)) return;

    try {
      const { error } = await supabase.from('test_series').delete().eq('id', id);
      if (error) throw error;
      await loadData();
    } catch (error: any) {
      console.error('Delete series error:', error);
      alert(error.message || 'Could not delete Test Series.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Step Workflow Guide */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 soft-shadow p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📚</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                Test Series Management
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Create and manage all test series, subjects, tests, and questions in an organized hierarchy.
            </p>
          </div>
          <Button onClick={openCreateModal} variant="primary" className="shrink-0 shadow-md">
            + Create Test Series
          </Button>
        </div>

        {/* Step-by-Step Helper Box */}
        <div className="mt-5 p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
            How Test Series Management Works
          </p>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs text-blue-900 dark:text-blue-200 font-medium">
            <div className="flex items-center gap-2 bg-white/70 dark:bg-slate-900/60 p-2 rounded-lg border border-blue-100 dark:border-blue-950">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">1</span>
              <span>Create a Test Series first</span>
            </div>
            <div className="flex items-center gap-2 bg-white/70 dark:bg-slate-900/60 p-2 rounded-lg border border-blue-100 dark:border-blue-950">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">2</span>
              <span>Add Subjects to this series</span>
            </div>
            <div className="flex items-center gap-2 bg-white/70 dark:bg-slate-900/60 p-2 rounded-lg border border-blue-100 dark:border-blue-950">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">3</span>
              <span>Create Tests & select subjects</span>
            </div>
            <div className="flex items-center gap-2 bg-white/70 dark:bg-slate-900/60 p-2 rounded-lg border border-blue-100 dark:border-blue-950">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">4</span>
              <span>Add Questions by Subject</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 soft-shadow">
        {/* Type Filter Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-colors ${
              activeFilter === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Series ({seriesList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('free')}
            className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-colors ${
              activeFilter === 'free'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Free Series ({seriesList.filter((s) => !s.is_paid).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('paid')}
            className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-colors ${
              activeFilter === 'paid'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Paid Series ({seriesList.filter((s) => s.is_paid).length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search test series..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
          <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Series Cards Grid */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary" />
        </div>
      ) : filteredSeries.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <div className="text-4xl mb-3">📝</div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No test series found</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {searchQuery ? 'Try changing your search query or filter.' : 'Click "+ Create Test Series" to get started.'}
          </p>
          <div className="mt-5">
            <Button onClick={openCreateModal} variant="primary">
              + Create First Test Series
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSeries.map((series) => (
            <div
              key={series.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 soft-shadow flex flex-col overflow-hidden hover:border-brand-primary/50 transition-all duration-200"
            >
              {/* Card Header & Thumbnail */}
              <div className="h-44 bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                {series.thumbnail_url && !series.thumbnail_url.includes('Empty') && !series.thumbnail_url.includes('Temp') ? (
                  <img
                    src={series.thumbnail_url}
                    alt={series.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-800 dark:to-slate-900">
                    📚
                  </div>
                )}

                {/* Badges */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span
                    className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full shadow-xs ${
                      series.is_paid
                        ? 'bg-amber-500 text-white'
                        : 'bg-emerald-500 text-white'
                    }`}
                  >
                    {series.is_paid ? 'PAID' : 'FREE'}
                  </span>
                </div>

                <div className="absolute top-3 right-3">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-md shadow-xs ${
                      series.is_published
                        ? 'bg-emerald-600/90 text-white'
                        : 'bg-slate-700/90 text-white'
                    }`}
                  >
                    {series.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex flex-col flex-grow">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1">
                  {series.title}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {series.description || 'No description provided.'}
                </p>

                {/* Hierarchy Metrics Grid */}
                <div className="mt-4 grid grid-cols-3 gap-2 py-3 px-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                  <div>
                    <span className="block text-base font-extrabold text-slate-900 dark:text-white">
                      {series.subjectCount}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Subjects</span>
                  </div>
                  <div className="border-x border-slate-200 dark:border-slate-700">
                    <span className="block text-base font-extrabold text-slate-900 dark:text-white">
                      {series.testCount}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Tests</span>
                  </div>
                  <div>
                    <span className="block text-base font-extrabold text-slate-900 dark:text-white">
                      {series.questionCount}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Questions</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(series)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="Edit series info"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSeries(series.id, series.title)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                      title="Delete series"
                    >
                      🗑️ Delete
                    </button>
                  </div>

                  <Link href={`/admin/test-series/${series.id}`}>
                    <Button variant="primary" size="sm" className="font-semibold shadow-xs">
                      Manage Series →
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Series Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-hidden">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 soft-shadow w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {modalForm.id ? 'Edit Test Series' : 'Create New Test Series'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSeries} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Series Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UPP Computer Operator 2026, Bank PO, SSC CGL"
                    value={modalForm.title}
                    onChange={(e) => setModalForm({ ...modalForm, title: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Short Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe what students will practice in this series..."
                    value={modalForm.description}
                    onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary"
                  />
                </div>

                {/* Free vs Paid Toggle */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Series Type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        !modalForm.is_paid
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="seriesType"
                        checked={!modalForm.is_paid}
                        onChange={() => setModalForm({ ...modalForm, is_paid: false })}
                        className="accent-emerald-600"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Free Series</p>
                        <p className="text-xs text-slate-500">Accessible for free practice</p>
                      </div>
                    </label>

                    <label
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        modalForm.is_paid
                          ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="seriesType"
                        checked={modalForm.is_paid}
                        onChange={() => setModalForm({ ...modalForm, is_paid: true })}
                        className="accent-amber-600"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Paid Series</p>
                        <p className="text-xs text-slate-500">Includes premium test packages</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Thumbnail Image */}
                <ImageUploadField
                  label="Series Thumbnail Image"
                  buttonLabel="Upload Thumbnail"
                  folder="test-series"
                  existingUrl={modalForm.thumbnail_url}
                  onUrlChange={(url) => setModalForm({ ...modalForm, thumbnail_url: url })}
                />

                {/* Published Toggle and Order */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      value={modalForm.order}
                      onChange={(e) => setModalForm({ ...modalForm, order: Number(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Publication Status
                    </label>
                    <label className="flex items-center gap-2.5 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modalForm.is_published}
                        onChange={(e) => setModalForm({ ...modalForm, is_published: e.target.checked })}
                        className="h-4 w-4 accent-emerald-600 rounded"
                      />
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        Published (visible to students)
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xs">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Saving...' : modalForm.id ? 'Save Changes' : 'Create Series'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
