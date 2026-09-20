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

  if (isLoading || options.length === 0) return null;

  return (
    <section className="pb-6 sm:pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {options.map((option) => (
          <div
            key={option.id}
            onClick={() => { if (option.link) window.location.href = option.link; }}
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center cursor-pointer transition-all hover:border-brand-primary hover:shadow-md group"
          >
            <div className="w-12 h-12 bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-2xl mx-auto mb-3 overflow-hidden group-hover:scale-110 transition-transform">
              {option.icon_url && (option.icon_url.startsWith('http') || option.icon_url.startsWith('/')) ? (
                <img src={option.icon_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{option.icon_url || '📘'}</span>
              )}
            </div>
            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm block leading-tight">{option.title}</span>
            {option.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{option.description}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
