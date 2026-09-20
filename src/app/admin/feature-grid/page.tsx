'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, uploadSiteAsset, resolveStorageUrl } from '@/lib/supabase';
import { HomeOption } from '@/types/supabase';
import { Button } from '@/components/ui/Button';
import { DESTINATION_PRESETS, INITIAL_FEATURE_GRID_ITEMS } from '@/lib/feature-grid-presets';

export default function AdminFeatureGridPage() {
  const [items, setItems] = useState<HomeOption[]>([]);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<HomeOption | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [order, setOrder] = useState(0);
  const [isEnabled, setIsEnabled] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('home_options')
        .select('*')
        .order('order', { ascending: true });

      if (error) throw error;
      setItems(data || []);

      // Resolve signed URLs for storage previews
      const map: Record<string, string> = {};
      if (data) {
        await Promise.all(
          data.map(async (item) => {
            if (item.icon_url) {
              map[item.id] = await resolveStorageUrl(item.icon_url);
            }
          })
        );
      }
      setResolvedUrls(map);
    } catch (err: any) {
      console.error('Error fetching feature grid items:', err);
      setErrorMessage('Failed to load feature grid items: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openAddForm = () => {
    setEditingItem(null);
    setTitle('');
    setLink('/courses');
    setOrder(items.length);
    setIsEnabled(true);
    setImageFile(null);
    setPreviewUrl(null);
    setErrorMessage(null);
    setIsAdding(true);
  };

  const openEditForm = (item: HomeOption) => {
    setEditingItem(item);
    setTitle(item.title);
    setLink(item.link || '');
    setOrder(item.order ?? 0);
    setIsEnabled(item.is_enabled ?? true);
    setImageFile(null);
    setPreviewUrl(resolvedUrls[item.id] || item.icon_url || null);
    setErrorMessage(null);
    setIsAdding(true);
  };

  const closeForm = () => {
    setIsAdding(false);
    setEditingItem(null);
    setImageFile(null);
    setPreviewUrl(null);
    setErrorMessage(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      let finalIconUrl = editingItem ? editingItem.icon_url : null;

      if (imageFile) {
        try {
          finalIconUrl = await uploadSiteAsset(imageFile, 'features');
        } catch (uploadErr: any) {
          throw new Error('Image upload failed: ' + (uploadErr?.message || 'Storage error'));
        }
      }

      const payload = {
        title: title.trim(),
        link: link.trim() || null,
        icon_url: finalIconUrl,
        order: Number(order),
        is_enabled: isEnabled,
        updated_at: new Date().toISOString(),
      };

      if (editingItem) {
        const { error } = await supabase
          .from('home_options')
          .update(payload)
          .eq('id', editingItem.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('home_options')
          .insert([payload]);

        if (error) throw error;
      }

      closeForm();
      await fetchItems();
    } catch (err: any) {
      console.error('Save error:', err);
      setErrorMessage(err.message || 'Failed to save feature item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (item: HomeOption) => {
    try {
      const nextStatus = !item.is_enabled;
      const { error } = await supabase
        .from('home_options')
        .update({ is_enabled: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', item.id);

      if (error) throw error;

      setItems(items.map((i) => (i.id === item.id ? { ...i, is_enabled: nextStatus } : i)));
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const handleMoveOrder = async (item: HomeOption, direction: 'up' | 'down') => {
    const currentIndex = items.findIndex((i) => i.id === item.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const targetItem = items[targetIndex];

    try {
      const updatedItems = [...items];
      const currentOrder = item.order;
      const targetOrder = targetItem.order;

      // Swap orders
      await supabase.from('home_options').update({ order: targetOrder }).eq('id', item.id);
      await supabase.from('home_options').update({ order: currentOrder }).eq('id', targetItem.id);

      updatedItems[currentIndex] = { ...targetItem, order: currentOrder };
      updatedItems[targetIndex] = { ...item, order: targetOrder };

      // Sort by order
      updatedItems.sort((a, b) => a.order - b.order);
      setItems(updatedItems);
    } catch (err: any) {
      alert('Failed to update order: ' + err.message);
      fetchItems();
    }
  };

  const handleDelete = async (item: HomeOption) => {
    if (!confirm(`Are you sure you want to delete "${item.title}"?`)) return;

    try {
      const { error } = await supabase.from('home_options').delete().eq('id', item.id);
      if (error) throw error;

      setItems(items.filter((i) => i.id !== item.id));
    } catch (err: any) {
      alert('Failed to delete item: ' + err.message);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('This will seed the default 10 feature grid items (Paid/Free Courses, Test Series, PDFs, etc.). Continue?')) return;

    setIsLoading(true);
    try {
      const itemsToInsert = INITIAL_FEATURE_GRID_ITEMS.map((preset, idx) => ({
        title: preset.title,
        link: preset.link,
        icon_url: preset.icon_url,
        description: null,
        order: idx,
        is_enabled: true,
      }));

      const { error } = await supabase.from('home_options').insert(itemsToInsert);
      if (error) throw error;

      await fetchItems();
      alert('Default feature items seeded successfully!');
    } catch (err: any) {
      alert('Failed to seed defaults: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin" className="text-sm text-brand-primary hover:underline flex items-center gap-1">
              ← Admin Dashboard
            </Link>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Manage Feature Grid</h2>
          <p className="text-slate-500 text-sm">
            Control the dynamic compact feature icons that appear above Featured Courses on the homepage.
          </p>
        </div>

        <div className="flex gap-2">
          {items.length === 0 && (
            <Button variant="outline" onClick={handleResetDefaults}>
              Seed Default Items
            </Button>
          )}
          <Button variant="primary" onClick={openAddForm} className="bg-brand-primary text-white hover:bg-blue-800">
            ➕ Add Feature Item
          </Button>
        </div>
      </div>

      {/* Modal / Form */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900">
                {editingItem ? 'Edit Feature Item' : 'Add New Feature Item'}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 mb-4 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-5">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Paid Courses, Free Test Series"
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-brand-primary outline-none"
                />
              </div>

              {/* Click Destination Presets */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                  Click Destination Preset
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value) setLink(e.target.value);
                  }}
                  defaultValue=""
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-brand-primary outline-none bg-slate-50 text-sm"
                >
                  <option value="">-- Choose a preset route --</option>
                  {DESTINATION_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination URL */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                  Destination URL / Route
                </label>
                <input
                  type="text"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="/courses, /test-series, etc."
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-brand-primary outline-none"
                />
                <p className="text-xs text-slate-500">
                  Can be an internal route (e.g. <code className="bg-slate-100 px-1 py-0.5 rounded">/courses?access=free</code>) or external URL.
                </p>
              </div>

              {/* Image / Icon Upload */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Icon / Image
                </label>
                <div className="flex items-center gap-4 p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50">
                  <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-xs shrink-0">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-2xl text-slate-400">🖼️</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 transition-colors">
                      {previewUrl ? 'Change Image' : 'Upload Image'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </label>
                    <p className="text-xs text-slate-500">
                      {imageFile ? imageFile.name : 'Square PNG, SVG, or WebP recommended.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Order & Active Status */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={order}
                    onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                </div>

                <div className="space-y-1.5 flex flex-col justify-end">
                  <label className="inline-flex items-center gap-2 cursor-pointer p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-sm font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => setIsEnabled(e.target.checked)}
                      className="w-4 h-4 text-brand-primary rounded"
                    />
                    <span>Active / Visible</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button type="button" variant="ghost" onClick={closeForm}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSaving} className="bg-brand-primary text-white hover:bg-blue-800">
                  {isSaving ? 'Saving...' : editingItem ? 'Update Feature' : 'Create Feature'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="bg-white rounded-xl soft-shadow border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-slate-500">Loading feature grid items...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="text-5xl mb-3">⚡</div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">No Feature Grid Items Yet</h3>
            <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
              Add feature items or click the button below to seed the 10 standard educational items.
            </p>
            <Button variant="primary" onClick={handleResetDefaults} className="bg-brand-primary text-white">
              Seed Default 10 Items
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 w-20">Order</th>
                  <th className="py-3.5 px-4 w-20">Icon</th>
                  <th className="py-3.5 px-4">Title</th>
                  <th className="py-3.5 px-4">Destination Link</th>
                  <th className="py-3.5 px-4 w-28 text-center">Status</th>
                  <th className="py-3.5 px-4 w-36 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {items.map((item, index) => {
                  const iconSrc = resolvedUrls[item.id] || item.icon_url;
                  const isImage = iconSrc && (
                    iconSrc.startsWith('http') ||
                    iconSrc.startsWith('/') ||
                    iconSrc.startsWith('data:')
                  );

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Order + Move Buttons */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <span className="w-6 text-center">{item.order}</span>
                          <div className="flex flex-col">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveOrder(item, 'up')}
                              className="text-slate-400 hover:text-slate-800 disabled:opacity-20 leading-none text-xs p-0.5"
                              title="Move Up"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              disabled={index === items.length - 1}
                              onClick={() => handleMoveOrder(item, 'down')}
                              className="text-slate-400 hover:text-slate-800 disabled:opacity-20 leading-none text-xs p-0.5"
                              title="Move Down"
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Icon */}
                      <td className="py-3.5 px-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                          {isImage ? (
                            <img src={iconSrc} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-xl">{item.icon_url || '📘'}</span>
                          )}
                        </div>
                      </td>

                      {/* Title */}
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {item.title}
                      </td>

                      {/* Destination Link */}
                      <td className="py-3.5 px-4">
                        {item.link ? (
                          <span className="inline-block bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-mono">
                            {item.link}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-xs">No link configured</span>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleEnabled(item)}
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                            item.is_enabled
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {item.is_enabled ? '● Active' : '○ Inactive'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditForm(item)}
                            className="text-slate-700 hover:text-brand-primary"
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(item)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
