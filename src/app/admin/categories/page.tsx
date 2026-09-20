'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Category } from '@/types/supabase';
import { Button } from '@/components/ui/Button';

export default function ManageCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', slug: '' });

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    if (!error && data) setCategories(data);
    setIsLoading(false);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        const { error } = await supabase
          .from('categories')
          .update({ name: formData.name, slug: formData.slug })
          .eq('id', isEditing);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('categories')
          .insert({ name: formData.name, slug: formData.slug });
        if (error) throw error;
      }
      setFormData({ name: '', slug: '' });
      setIsAdding(false);
      setIsEditing(null);
      await fetchCategories();
      alert('Category saved successfully!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"? Courses in this category will have their category removed.`)) {
      return;
    }
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      await fetchCategories();
      alert('Category deleted successfully!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const startEdit = (cat: Category) => {
    setIsEditing(cat.id);
    setFormData({ name: cat.name, slug: cat.slug });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Manage Categories</h2>
          <p className="text-slate-500 dark:text-slate-400">Organize your courses by categories for better discoverability.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setIsAdding(true);
            setFormData({ name: '', slug: '' });
          }}
          disabled={isAdding || isEditing !== null}
        >
          + Add Category
        </Button>
      </div>

      {/* Add/Edit Form */}
      {(isAdding || isEditing) && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl soft-shadow border border-slate-100 dark:border-slate-800 animate-in slide-in-from-top duration-300">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
            {isEditing ? 'Edit Category' : 'Add New Category'}
          </h3>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Category Name</label>
              <input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-primary text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder-slate-400"
                placeholder="e.g. Web Development"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Slug (URL friendly)</label>
              <input
                required
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-primary text-slate-900 dark:text-white bg-white dark:bg-slate-800 placeholder-slate-400"
                placeholder="e.g. web-development"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                type="submit"
                className="flex-grow"
              >
                {isEditing ? 'Update' : 'Create'}
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setIsEditing(null);
                  setFormData({ name: '', slug: '' });
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Categories Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl soft-shadow border border-slate-100 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700">
            <tr>
              <th className="p-4 text-sm font-bold text-slate-700 dark:text-slate-300">Category Name</th>
              <th className="p-4 text-sm font-bold text-slate-700 dark:text-slate-300">Slug</th>
              <th className="p-4 text-sm font-bold text-slate-700 dark:text-slate-300 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {categories.map((cat) => (
              <tr key={cat.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                <td className="p-4 text-sm text-slate-900 dark:text-white font-medium">{cat.name}</td>
                <td className="p-4 text-sm text-slate-500 dark:text-slate-400">{cat.slug}</td>
                <td className="p-4 text-right space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(cat)}
                    disabled={isAdding || isEditing !== null}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
                    onClick={() => handleDelete(cat.id, cat.name)}
                    disabled={isAdding || isEditing !== null}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={3} className="p-12 text-center text-slate-500">
                  No categories found. Add your first category to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
