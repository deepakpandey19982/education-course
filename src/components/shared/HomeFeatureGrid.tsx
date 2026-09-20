'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, resolveStorageUrl } from '@/lib/supabase';
import { HomeOption } from '@/types/supabase';
import { INITIAL_FEATURE_GRID_ITEMS } from '@/lib/feature-grid-presets';

export function HomeFeatureGrid() {
  const router = useRouter();
  const [items, setItems] = useState<HomeOption[]>(() =>
    INITIAL_FEATURE_GRID_ITEMS.map((item, idx) => ({
      id: `preset-${idx}`,
      title: item.title,
      link: item.link,
      icon_url: item.icon_url,
      description: null,
      order: item.order,
      is_enabled: true,
      created_at: '',
      updated_at: '',
    }))
  );
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchFeatureItems() {
      try {
        const { data, error } = await supabase
          .from('home_options')
          .select('*')
          .eq('is_enabled', true)
          .order('order', { ascending: true });

        if (!error && data) {
          setItems(data);

          // Resolve signed URLs for storage assets
          const urlMap: Record<string, string> = {};
          await Promise.all(
            data.map(async (item) => {
              if (item.icon_url) {
                urlMap[item.id] = await resolveStorageUrl(item.icon_url);
              }
            })
          );
          setResolvedUrls(urlMap);
        }
      } catch (err) {
        console.error('Failed to load feature grid items:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchFeatureItems();
  }, []);

  if (isLoading || items.length === 0) {
    return null;
  }

  const handleItemClick = (link?: string | null) => {
    if (!link) return;

    if (link.startsWith('#')) {
      const element = document.querySelector(link);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }

    if (link.startsWith('http://') || link.startsWith('https://')) {
      window.location.href = link;
      return;
    }

    router.push(link);
  };

  return (
    <section className="pb-8 sm:pb-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
        {items.map((item) => {
          const iconSrc = resolvedUrls[item.id] || item.icon_url;
          const isImage = iconSrc && (
            iconSrc.startsWith('http') ||
            iconSrc.startsWith('/') ||
            iconSrc.startsWith('data:')
          );

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleItemClick(item.link)}
              className="group flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 hover:border-brand-primary/40 dark:hover:border-blue-500/40 text-center w-full focus:outline-none focus:ring-2 focus:ring-brand-primary/20 cursor-pointer"
            >
              {/* Feature Icon / Image */}
              <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex items-center justify-center mb-2 sm:mb-2.5 transition-transform duration-200 group-hover:scale-105">
                {isImage ? (
                  <img
                    src={iconSrc}
                    alt={item.title}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-3xl sm:text-4xl" role="img" aria-label={item.title}>
                    {item.icon_url || '📘'}
                  </span>
                )}
              </div>

              {/* Title only */}
              <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 text-center leading-tight line-clamp-2">
                {item.title}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
