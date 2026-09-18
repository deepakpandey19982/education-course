'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { HomeBanner, HomeOption } from '@/types/supabase';
import { Button } from '@/components/ui/Button';

async function uploadSiteAsset(file: File, folder: string): Promise<string> {
  const ext = file.name.split('.').pop();
  const fileName = `${folder}/${Math.random().toString(36).substring(2)}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('site-assets').upload(fileName, file);
  if (error) throw new Error('Image upload failed: ' + error.message);
  const { data } = supabase.storage.from('site-assets').getPublicUrl(fileName);
  return data.publicUrl;
}

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
      if (file) finalImageUrl = await uploadSiteAsset(file, 'banners');
      if (!finalImageUrl) throw new Error('Please provide a banner image.');

      const payload = {
        title: title || null,
        subtitle: subtitle || null,
        link: link || null,
        interval_seconds: intervalSeconds,
        image_url: finalImageUrl,
      };

      const { error } = banner
        ? await supabase.from('home_banners').update(payload).eq('id', banner.id)
        : await supabase.from('home_banners').insert([{ ...payload, is_enabled: true, order: 0 }]);

      if (error) throw error;
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
      <div className="space-y-1">
        <label className="text-xs font-bold text-slate-600">Banner Image</label>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
        <p className="text-[11px] text-slate-500">Recommended: wide landscape banner, ideally around 1920×600 px.</p>
        {imageUrl && !file && <img src={imageUrl} className="h-20 mt-2 rounded-lg object-cover" alt="" />}
        {file && <img src={URL.createObjectURL(file)} className="h-20 mt-2 rounded-lg object-cover" alt="" />}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving...' : 'Save Banner'}</Button>
      </div>
    </form>
  );
}

// ---------------- Option Form ----------------

function OptionForm({ option, onDone }: { option?: HomeOption; onDone: () => void }) {
  const [title, setTitle] = useState(option?.title || '');
  const [description, setDescription] = useState(option?.description || '');
  const [link, setLink] = useState(option?.link || '');
  const [iconUrl, setIconUrl] = useState(option?.icon_url || '');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let finalIcon = iconUrl;
      if (file) finalIcon = await uploadSiteAsset(file, 'options');

      const payload = {
        title,
        description: description || null,
        link: link || null,
        icon_url: finalIcon || null,
      };

      const { error } = option
        ? await supabase.from('home_options').update(payload).eq('id', option.id)
        : await supabase.from('home_options').insert([{ ...payload, is_enabled: true, order: 0 }]);

      if (error) throw error;
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
      <div className="space-y-1">
        <label className="text-xs font-bold text-slate-600">Icon (upload image, or type an emoji e.g. 📘)</label>
        <div className="flex items-center gap-3">
          <input value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} placeholder="📘" className="w-24 p-2 border border-slate-200 rounded-lg text-sm" />
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving...' : 'Save Option'}</Button>
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
  const [editingOption, setEditingOption] = useState<HomeOption | 'new' | null>(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setIsLoading(true);
    try {
      const { data: bannerData } = await supabase.from('home_banners').select('*').order('order');
      const { data: optionData } = await supabase.from('home_options').select('*').order('order');
      if (bannerData) setBanners(bannerData);
      if (optionData) setOptions(optionData);
    } catch (error) {
      console.error('Error fetching homepage data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteBanner(id: string) {
    if (!confirm('Delete this banner?')) return;
    const { error } = await supabase.from('home_banners').delete().eq('id', id);
    if (error) alert(error.message); else fetchData();
  }

  async function handleToggleBanner(id: string, currentStatus: boolean) {
    const { error } = await supabase.from('home_banners').update({ is_enabled: !currentStatus }).eq('id', id);
    if (error) alert(error.message); else fetchData();
  }

  async function handleReorderBanner(idx: number, direction: -1 | 1) {
    const target = idx + direction;
    if (target < 0 || target >= banners.length) return;
    const a = banners[idx], b = banners[target];
    await Promise.all([
      supabase.from('home_banners').update({ order: b.order }).eq('id', a.id),
      supabase.from('home_banners').update({ order: a.order }).eq('id', b.id),
    ]);
    fetchData();
  }

  async function handleDeleteOption(id: string) {
    if (!confirm('Delete this option?')) return;
    const { error } = await supabase.from('home_options').delete().eq('id', id);
    if (error) alert(error.message); else fetchData();
  }

  async function handleToggleOption(id: string, currentStatus: boolean) {
    const { error } = await supabase.from('home_options').update({ is_enabled: !currentStatus }).eq('id', id);
    if (error) alert(error.message); else fetchData();
  }

  async function handleReorderOption(idx: number, direction: -1 | 1) {
    const target = idx + direction;
    if (target < 0 || target >= options.length) return;
    const a = options[idx], b = options[target];
    await Promise.all([
      supabase.from('home_options').update({ order: b.order }).eq('id', a.id),
      supabase.from('home_options').update({ order: a.order }).eq('id', b.id),
    ]);
    fetchData();
  }

  if (isLoading) return <div className="p-8 text-center">Loading Homepage Manager...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Homepage Content Manager</h2>
      </div>

      <div className="flex gap-4 border-b border-slate-200">
        {(['banners', 'options'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium capitalize transition-colors ${
              activeTab === tab ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'banners' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Manage Banners</h3>
            {editingBanner === null && <Button size="sm" onClick={() => setEditingBanner('new')}>Add Banner</Button>}
          </div>

          {editingBanner === 'new' && (
            <BannerForm onDone={() => { setEditingBanner(null); fetchData(); }} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {banners.map((banner, idx) => (
              editingBanner !== 'new' && editingBanner?.id === banner.id ? (
                <div key={banner.id} className="lg:col-span-3">
                  <BannerForm banner={banner} onDone={() => { setEditingBanner(null); fetchData(); }} />
                </div>
              ) : (
                <div key={banner.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <img src={banner.image_url} alt={banner.title || ''} className="w-full h-40 object-cover rounded-lg" />
                  <div className="space-y-1">
                    <p className="font-bold text-slate-800">{banner.title || <span className="italic text-slate-400">No title</span>}</p>
                    <p className="text-xs text-slate-500">Interval: {banner.interval_seconds}s · Order: {banner.order}</p>
                    <p className="text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${banner.is_enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {banner.is_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleReorderBanner(idx, -1)} disabled={idx === 0}>↑</Button>
                    <Button variant="outline" size="sm" onClick={() => handleReorderBanner(idx, 1)} disabled={idx === banners.length - 1}>↓</Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingBanner(banner)}>Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => handleToggleBanner(banner.id, banner.is_enabled)}>
                      {banner.is_enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleDeleteBanner(banner.id)}>Delete</Button>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {activeTab === 'options' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Manage Quick-Link Cards</h3>
            {editingOption === null && <Button size="sm" onClick={() => setEditingOption('new')}>Add Option</Button>}
          </div>

          {editingOption === 'new' && (
            <OptionForm onDone={() => { setEditingOption(null); fetchData(); }} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {options.map((option, idx) => (
              editingOption !== 'new' && editingOption?.id === option.id ? (
                <div key={option.id} className="lg:col-span-4">
                  <OptionForm option={option} onDone={() => { setEditingOption(null); fetchData(); }} />
                </div>
              ) : (
                <div key={option.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-2xl mx-auto overflow-hidden">
                    {option.icon_url && option.icon_url.startsWith('http') ? (
                      <img src={option.icon_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <span>{option.icon_url || '📘'}</span>
                    )}
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-bold text-slate-800">{option.title}</p>
                    <p className="text-xs text-slate-500 truncate">{option.link}</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${option.is_enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {option.is_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Button variant="outline" size="sm" onClick={() => handleReorderOption(idx, -1)} disabled={idx === 0}>↑</Button>
                    <Button variant="outline" size="sm" onClick={() => handleReorderOption(idx, 1)} disabled={idx === options.length - 1}>↓</Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingOption(option)}>Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => handleToggleOption(option.id, option.is_enabled)}>
                      {option.is_enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleDeleteOption(option.id)}>Delete</Button>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
