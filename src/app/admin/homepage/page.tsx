'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase, uploadSiteAsset, resolveStorageUrl } from '@/lib/supabase';
import { HomeBanner, HomeOption } from '@/types/supabase';
import { Button } from '@/components/ui/Button';

// ---------------- Banner Form ----------------

function BannerForm({ banner, onDone }: { banner?: HomeBanner; onDone: () => void }) {
  const [title, setTitle] = useState(banner?.title || '');
  const [subtitle, setSubtitle] = useState(banner?.subtitle || '');
  const [link, setLink] = useState(banner?.link || '');
  const [intervalSeconds, setIntervalSeconds] = useState(banner?.interval_seconds ?? 3);
  const [imageUrl, setImageUrl] = useState(banner?.image_url || '');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let finalImageUrl = imageUrl;
      if (file) {
        finalImageUrl = await uploadSiteAsset(file, 'banners');
      }
      if (!finalImageUrl) throw new Error('Please provide a banner image.');

      const payload = {
        title: title || null,
        subtitle: subtitle || null,
        link: link || null,
        interval_seconds: intervalSeconds,
        image_url: finalImageUrl,
      };

      if (banner) {
        const { error } = await supabase.from('home_banners').update(payload).eq('id', banner.id);
        if (error) throw error;
      } else {
        const { data: countData } = await supabase.from('home_banners').select('id', { count: 'exact' });
        const count = countData?.length || 0;
        const { error } = await supabase.from('home_banners').insert([{ ...payload, is_enabled: true, order: count }]);
        if (error) throw error;
      }

      onDone();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600">Title (optional)</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600">Subtitle (optional)</label>
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600">Click Destination Link (optional)</label>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/courses" className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600">Slide Interval (seconds)</label>
          <input type="number" min={2} value={intervalSeconds} onChange={(e) => setIntervalSeconds(parseInt(e.target.value) || 5)} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-600">Banner Image</label>
        
        <div className="flex flex-col gap-3">
          <div className="relative">
            <input 
              type="file" 
              accept="image/*" 
              onChange={(e) => setFile(e.target.files?.[0] || null)} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              id="banner-image-upload"
            />
            <label 
              htmlFor="banner-image-upload" 
              className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <svg className="w-5 h-5 mr-2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Upload Banner Image
            </label>
            {file && <span className="ml-3 text-sm text-slate-600">{file.name}</span>}
          </div>
          
          <p className="text-[11px] text-slate-500">Recommended: wide landscape banner, ideally around 1920×600 px.</p>
          
          {file ? (
            <div className="mt-2">
              <p className="text-xs text-slate-500 mb-1">Preview of new image:</p>
              <img src={URL.createObjectURL(file)} className="h-32 rounded-lg object-contain bg-slate-200 border border-slate-300" alt="Preview" />
            </div>
          ) : imageUrl ? (
            <div className="mt-2">
              <p className="text-xs text-slate-500 mb-1">Current image:</p>
              <img src={imageUrl} className="h-32 rounded-lg object-contain bg-slate-200 border border-slate-300" alt="Current" />
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 mt-4">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving || (!file && !imageUrl)} className="bg-brand-primary text-white hover:bg-blue-700">
          {saving ? 'Saving...' : 'Save Banner'}
        </Button>
      </div>
    </form>
  );
}

// ---------------- Image Only Form ----------------
function ChangeImageForm({ id, type, currentUrl, onDone }: { id: string, type: 'banner' | 'option', currentUrl: string, onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setSaving(true);
    try {
      const folder = type === 'banner' ? 'banners' : 'options';
      const finalUrl = await uploadSiteAsset(file, folder);
      
      const table = type === 'banner' ? 'home_banners' : 'home_options';
      const field = type === 'banner' ? 'image_url' : 'icon_url';
      
      const { error } = await supabase.from(table).update({ [field]: finalUrl }).eq('id', id);
      if (error) throw error;
      onDone();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="relative inline-block">
          <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => setFile(e.target.files?.[0] || null)} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            id={`change-img-${id}`}
          />
          <label 
            htmlFor={`change-img-${id}`}
            className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
          >
            <svg className="w-5 h-5 mr-2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Choose New Image
          </label>
        </div>
        {file && <span className="text-sm text-slate-600 block">{file.name}</span>}
        
        {file ? (
           <img src={URL.createObjectURL(file)} className="h-24 object-contain bg-slate-100 rounded border border-slate-200" alt="Preview" />
        ) : (
           <img src={currentUrl} className="h-24 object-contain bg-slate-100 rounded border border-slate-200" alt="Current" />
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" disabled={!file || saving} className="bg-brand-primary text-white hover:bg-blue-700">
          {saving ? 'Saving...' : 'Upload & Replace'}
        </Button>
      </div>
    </form>
  );
}

// ---------------- Option Form ----------------

function OptionForm({ option, onDone }: { option?: HomeOption; onDone: () => void }) {
  const [title, setTitle] = useState(option?.title || '');
  const [description, setDescription] = useState(option?.description || '');
  const [link, setLink] = useState(option?.link || '');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let finalIcon = option?.icon_url || null;
      if (file) finalIcon = await uploadSiteAsset(file, 'options');

      const payload = {
        title,
        description: description || null,
        link: link || null,
        icon_url: finalIcon || null,
      };

      if (option) {
        const { error } = await supabase.from('home_options').update(payload).eq('id', option.id);
        if (error) throw error;
      } else {
        const { data: countData } = await supabase.from('home_options').select('id', { count: 'exact' });
        const count = countData?.length || 0;
        const { error } = await supabase.from('home_options').insert([{ ...payload, is_enabled: true, order: count }]);
        if (error) throw error;
      }

      onDone();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600">Title</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600">Link / Route</label>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/test-series" className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-bold text-slate-600">Description (optional)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg text-sm" />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-600">Icon Image</label>
        <div className="flex flex-col gap-3">
          <div className="relative inline-block">
            <input 
              type="file" 
              accept="image/*" 
              onChange={(e) => setFile(e.target.files?.[0] || null)} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              id="option-icon-upload"
            />
            <label 
              htmlFor="option-icon-upload"
              className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
            >
              <svg className="w-5 h-5 mr-2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Upload Icon
            </label>
          </div>
          {file && <span className="text-sm text-slate-600">{file.name}</span>}
          
          <p className="text-[11px] text-slate-500">Upload an icon image for this quick-link card.</p>
          
          <div className="flex gap-4">
            {file ? (
              <img src={URL.createObjectURL(file)} className="h-12 w-12 rounded-lg object-cover border border-slate-200" alt="Preview" />
            ) : option?.icon_url ? (
              <img src={option.icon_url} className="h-12 w-12 rounded-lg object-cover border border-slate-200" alt="Current" />
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 mt-4">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving} className="bg-brand-primary text-white hover:bg-blue-700">{saving ? 'Saving...' : 'Save Option'}</Button>
      </div>
    </form>
  );
}

// ---------------- Main Page ----------------

export default function HomepageManager() {
  const [activeTab, setActiveTab] = useState<'banners' | 'options'>('banners');
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [options, setOptions] = useState<HomeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [editingBanner, setEditingBanner] = useState<HomeBanner | 'new' | null>(null);
  const [changingImageBannerId, setChangingImageBannerId] = useState<string | null>(null);
  
  const [editingOption, setEditingOption] = useState<HomeOption | 'new' | null>(null);
  const [changingImageOptionId, setChangingImageOptionId] = useState<string | null>(null);

  // Drag and drop state
  const [draggedItemIdx, setDraggedItemIdx] = useState<number | null>(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setIsLoading(true);
    try {
      const { data: bannerData } = await supabase.from('home_banners').select('*').order('order');
      const { data: optionData } = await supabase.from('home_options').select('*').order('order');
      
      // Auto-fix any ordering gaps just in case
      let bannerUpdates = [];
      if (bannerData) {
        for (let i = 0; i < bannerData.length; i++) {
          if (bannerData[i].order !== i) {
            bannerData[i].order = i;
            bannerUpdates.push(supabase.from('home_banners').update({ order: i }).eq('id', bannerData[i].id));
          }
        }
      }
      
      let optionUpdates = [];
      if (optionData) {
        for (let i = 0; i < optionData.length; i++) {
          if (optionData[i].order !== i) {
            optionData[i].order = i;
            optionUpdates.push(supabase.from('home_options').update({ order: i }).eq('id', optionData[i].id));
          }
        }
      }
      
      await Promise.all([...bannerUpdates, ...optionUpdates]);
      
      let resolvedBanners = bannerData || [];
      if (resolvedBanners.length > 0) {
        resolvedBanners = await Promise.all(
          resolvedBanners.map(async (b) => ({
            ...b,
            image_url: await resolveStorageUrl(b.image_url),
          }))
        );
      }
      setBanners(resolvedBanners);
      if (optionData) setOptions(optionData);
    } catch (error) {
      console.error('Error fetching homepage data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteBanner(id: string) {
    if (!confirm('Are you sure you want to delete this banner?')) return;
    try {
      await supabase.from('home_banners').delete().eq('id', id);
      // Fetch data will auto-fix gaps
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDeleteOption(id: string) {
    if (!confirm('Are you sure you want to delete this option?')) return;
    try {
      await supabase.from('home_options').delete().eq('id', id);
      // Fetch data will auto-fix gaps
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  // --- HTML5 Drag and Drop ---
  
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    // Small delay to prevent hiding the element being dragged immediately
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.style.opacity = '0.4';
      }
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number, listType: 'banners' | 'options') => {
    e.preventDefault();
    if (draggedItemIdx === null || draggedItemIdx === index) return;
    
    // Reorder locally while dragging
    if (listType === 'banners') {
      const items = [...banners];
      const draggedItem = items[draggedItemIdx];
      items.splice(draggedItemIdx, 1);
      items.splice(index, 0, draggedItem);
      setDraggedItemIdx(index);
      setBanners(items);
    } else {
      const items = [...options];
      const draggedItem = items[draggedItemIdx];
      items.splice(draggedItemIdx, 1);
      items.splice(index, 0, draggedItem);
      setDraggedItemIdx(index);
      setOptions(items);
    }
  };

  const handleDragEnd = async (e: React.DragEvent, listType: 'banners' | 'options') => {
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '1';
    }
    setDraggedItemIdx(null);
    
    // Persist new order
    try {
      const items = listType === 'banners' ? banners : options;
      const table = listType === 'banners' ? 'home_banners' : 'home_options';
      
      const promises = items.map((item, index) => {
        if (item.order !== index) {
          item.order = index; // Update local state
          return supabase.from(table).update({ order: index }).eq('id', item.id);
        }
        return Promise.resolve();
      });
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Error saving order', error);
      fetchData(); // Reset on error
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading Homepage Manager...</div>;

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Homepage Content Manager</h2>
      </div>

      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800">
        {(['banners', 'options'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium capitalize transition-colors ${
              activeTab === tab ? 'text-brand-primary dark:text-blue-400 border-b-2 border-brand-primary dark:border-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'banners' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Manage Banners</h3>
            {editingBanner === null && <Button size="sm" onClick={() => setEditingBanner('new')} className="bg-brand-primary text-white hover:bg-blue-700">Add New Banner</Button>}
          </div>

          {editingBanner === 'new' && (
            <BannerForm onDone={() => { setEditingBanner(null); fetchData(); }} />
          )}

          <div className="flex flex-col gap-4">
            {banners.map((banner, idx) => (
              <div 
                key={banner.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx, 'banners')}
                onDragEnd={(e) => handleDragEnd(e, 'banners')}
                className={`bg-white dark:bg-slate-900 rounded-xl border ${draggedItemIdx === idx ? 'border-brand-primary border-dashed shadow-md' : 'border-slate-200 dark:border-slate-800 shadow-sm'} overflow-hidden transition-all`}
              >
                {editingBanner !== 'new' && editingBanner?.id === banner.id ? (
                  <div className="p-4">
                    <BannerForm banner={banner} onDone={() => { setEditingBanner(null); fetchData(); }} />
                  </div>
                ) : changingImageBannerId === banner.id ? (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <p className="font-semibold text-slate-700 dark:text-slate-200 mb-4">Change Image for: {banner.title || `Banner ${idx + 1}`}</p>
                    <ChangeImageForm id={banner.id} type="banner" currentUrl={banner.image_url} onDone={() => { setChangingImageBannerId(null); fetchData(); }} />
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row">
                    {/* Drag Handle & Number */}
                    <div className="flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/60 border-r border-slate-100 dark:border-slate-800 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                      <div className="flex flex-col items-center gap-1">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                        <span className="text-xs font-bold">{idx + 1}</span>
                      </div>
                    </div>
                    
                    {/* Image Preview */}
                    <div className="w-full sm:w-64 h-32 sm:h-auto bg-slate-100 dark:bg-slate-800 shrink-0 border-r border-slate-100 dark:border-slate-800 relative group">
                      <img src={banner.image_url} alt={banner.title || ''} className="w-full h-full object-cover" />
                    </div>
                    
                    {/* Info & Actions */}
                    <div className="p-4 flex-grow flex flex-col justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-bold text-slate-800 dark:text-white text-lg">{banner.title || <span className="italic text-slate-400 dark:text-slate-500">No title</span>}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{banner.subtitle || 'No subtitle'}</p>
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">Interval: {banner.interval_seconds}s</span>
                          {banner.link && <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded truncate max-w-[200px]">Link: {banner.link}</span>}
                          <span className={`px-2 py-1 rounded font-bold ${banner.is_enabled ? 'bg-green-100 text-green-700 dark:bg-emerald-950/80 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                            {banner.is_enabled ? 'Visible' : 'Hidden'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <Button variant="outline" size="sm" onClick={() => setChangingImageBannerId(banner.id)}>Change Image</Button>
                        <Button variant="outline" size="sm" onClick={() => setEditingBanner(banner)}>Edit Details</Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          supabase.from('home_banners').update({ is_enabled: !banner.is_enabled }).eq('id', banner.id).then(fetchData);
                        }}>
                          {banner.is_enabled ? 'Hide' : 'Show'}
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/40" onClick={() => handleDeleteBanner(banner.id)}>Delete</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {banners.length === 0 && editingBanner !== 'new' && (
              <div className="p-12 text-center bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                <p className="text-slate-500 dark:text-slate-400 mb-4">No banners found. Add a banner to display it on the homepage.</p>
                <Button onClick={() => setEditingBanner('new')} className="bg-brand-primary text-white hover:bg-blue-700">Add First Banner</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'options' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Manage Quick-Link Cards</h3>
            {editingOption === null && <Button size="sm" onClick={() => setEditingOption('new')} className="bg-brand-primary text-white hover:bg-blue-700">Add New Option</Button>}
          </div>

          {editingOption === 'new' && (
            <OptionForm onDone={() => { setEditingOption(null); fetchData(); }} />
          )}

          <div className="flex flex-col gap-4">
            {options.map((option, idx) => (
              <div 
                key={option.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx, 'options')}
                onDragEnd={(e) => handleDragEnd(e, 'options')}
                className={`bg-white rounded-xl border ${draggedItemIdx === idx ? 'border-brand-primary border-dashed shadow-md' : 'border-slate-200 shadow-sm'} overflow-hidden transition-all`}
              >
                {editingOption !== 'new' && editingOption?.id === option.id ? (
                  <div className="p-4">
                    <OptionForm option={option} onDone={() => { setEditingOption(null); fetchData(); }} />
                  </div>
                ) : changingImageOptionId === option.id ? (
                  <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <p className="font-semibold text-slate-700 mb-4">Change Icon for: {option.title}</p>
                    <ChangeImageForm id={option.id} type="option" currentUrl={option.icon_url || ''} onDone={() => { setChangingImageOptionId(null); fetchData(); }} />
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center">
                    {/* Drag Handle & Number */}
                    <div className="flex items-center justify-center p-4 h-full bg-slate-50 border-r border-slate-100 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 transition-colors self-stretch">
                      <div className="flex flex-col items-center gap-1">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                        <span className="text-xs font-bold">{idx + 1}</span>
                      </div>
                    </div>
                    
                    {/* Icon Preview */}
                    <div className="p-4 shrink-0 flex items-center justify-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-3xl mx-auto overflow-hidden border border-slate-200 shadow-sm">
                        {option.icon_url && option.icon_url.startsWith('http') ? (
                          <img src={option.icon_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <span>{option.icon_url || '📘'}</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Info & Actions */}
                    <div className="p-4 flex-grow flex flex-col justify-between gap-4 w-full">
                      <div>
                        <p className="font-bold text-slate-800 text-lg">{option.title}</p>
                        <p className="text-sm text-slate-600 truncate">{option.link}</p>
                        {option.description && <p className="text-xs text-slate-500 mt-1">{option.description}</p>}
                      </div>
                      
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                        <Button variant="outline" size="sm" onClick={() => setChangingImageOptionId(option.id)}>Change Icon</Button>
                        <Button variant="outline" size="sm" onClick={() => setEditingOption(option)}>Edit Details</Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          supabase.from('home_options').update({ is_enabled: !option.is_enabled }).eq('id', option.id).then(fetchData);
                        }}>
                          {option.is_enabled ? 'Disable' : 'Enable'}
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300" onClick={() => handleDeleteOption(option.id)}>Delete</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {options.length === 0 && editingOption !== 'new' && (
              <div className="p-12 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl">
                <p className="text-slate-500 mb-4">No quick-links found. Add one to display it on the homepage.</p>
                <Button onClick={() => setEditingOption('new')} className="bg-brand-primary text-white hover:bg-blue-700">Add First Option</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
