'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { HomeOption } from '@/types/supabase';

export function HomeQuickOptions() {
  const [options, setOptions] = useState<HomeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('home_options')
        .select('*')
        .eq('is_enabled', true)
        .order('order');
      if (data) setOptions(data);
      setIsLoading(false);
    }
    fetchData();
  }, []);

  if (isLoading) return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-xl" />
      ))}
    </div>
  );

  if (options.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {options.map((option) => (
        <div
          key={option.id}
          onClick={() => { if (option.link) window.location.href = option.link; }}
          className="p-4 rounded-xl border border-slate-200 bg-white text-center cursor-pointer transition-all hover:border-brand-primary hover:shadow-md group"
        >
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-3 overflow-hidden group-hover:scale-110 transition-transform">
            {option.icon_url && (option.icon_url.startsWith('http') || option.icon_url.startsWith('/')) ? (
              <img src={option.icon_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{option.icon_url || '📘'}</span>
            )}
          </div>
          <span className="font-bold text-slate-800 text-sm block leading-tight">{option.title}</span>
          {option.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-1">{option.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}
