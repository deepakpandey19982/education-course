'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, resolveStorageUrl } from '@/lib/supabase';
import { HomeBanner } from '@/types/supabase';
import { Button } from '@/components/ui/Button';

const createDummyBannerSvg = (title: string, colorA: string, colorB: string, accent: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 600">
      <defs>
        <linearGradient id="grad" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${colorA}" />
          <stop offset="100%" stop-color="${colorB}" />
        </linearGradient>
      </defs>
      <rect width="1600" height="600" fill="url(#grad)" />
      <circle cx="1320" cy="120" r="180" fill="rgba(255,255,255,0.12)" />
      <circle cx="1460" cy="430" r="220" fill="rgba(255,255,255,0.08)" />
      <rect x="110" y="180" width="620" height="220" rx="30" fill="rgba(15,23,42,0.12)" />
      <text x="150" y="280" fill="white" font-size="54" font-weight="700" font-family="Segoe UI, Arial, sans-serif">${title}</text>
      <text x="150" y="340" fill="${accent}" font-size="28" font-weight="600" font-family="Segoe UI, Arial, sans-serif">Professional learning for future careers</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const dummyBanners: HomeBanner[] = [
  {
    id: 'dummy-banner-1',
    title: 'Build Your Career',
    subtitle: 'Industry-ready skills for students and professionals.',
    link: '/courses',
    image_url: createDummyBannerSvg('Build Your Career', '#1d4ed8', '#0f172a', '#93c5fd'),
    is_enabled: true,
    interval_seconds: 3,
    order: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'dummy-banner-2',
    title: 'Learn Smarter',
    subtitle: 'Flexible, practical courses designed for real-world goals.',
    link: '/courses',
    image_url: createDummyBannerSvg('Learn Smarter', '#0f766e', '#0f172a', '#99f6e4'),
    is_enabled: true,
    interval_seconds: 3,
    order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'dummy-banner-3',
    title: 'Grow Faster',
    subtitle: 'Upgrade your knowledge with guided, expert content.',
    link: '/courses',
    image_url: createDummyBannerSvg('Grow Faster', '#7c3aed', '#111827', '#e9d5ff'),
    is_enabled: true,
    interval_seconds: 3,
    order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function HomeBannerSlider() {
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [bannerAspectRatio, setBannerAspectRatio] = useState(16 / 9);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);

    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('home_banners')
        .select('*')
        .eq('is_enabled', true)
        .order('order');

      let list = dummyBanners;
      if (data && data.length > 0) {
        list = await Promise.all(
          data.map(async (banner) => ({
            ...banner,
            image_url: await resolveStorageUrl(banner.image_url),
          }))
        );
      }
      setBanners(list);
      setCurrentIndex(0);
      setIsLoading(false);
    }
    fetchData();
  }, []);

  const intervalSeconds = banners[currentIndex]?.interval_seconds || 3;

  useEffect(() => {
    if (!banners.length) {
      setBannerAspectRatio(16 / 9);
      return;
    }

    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setBannerAspectRatio(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = banners[currentIndex]?.image_url || '';
  }, [banners, currentIndex]);

  useEffect(() => {
    if (banners.length <= 1) return;

    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, intervalSeconds * 1000);

    return () => window.clearInterval(timer);
  }, [banners.length, intervalSeconds, currentIndex]);

  const goTo = (idx: number) => {
    if (!banners.length) return;
    setCurrentIndex(((idx % banners.length) + banners.length) % banners.length);
  };
  const goPrev = () => goTo(currentIndex - 1);
  const goNext = () => goTo(currentIndex + 1);

  if (isLoading) return <div className="w-full h-[220px] sm:h-[320px] md:h-[440px] lg:h-[500px] bg-slate-100 animate-pulse rounded-2xl" />;
  if (banners.length === 0) return null;

  const banner = banners[currentIndex];
  const hasMultiple = banners.length > 1;
  const effectiveBannerRatio = (() => {
    if (!viewportWidth) return bannerAspectRatio;
    // For mobile, maintain a reasonable aspect ratio to avoid being too short or too tall
    if (viewportWidth < 640) return Math.max(1, Math.min(bannerAspectRatio, 2.0)); 
    if (viewportWidth < 1024) return Math.min(bannerAspectRatio, 2.5);
    return bannerAspectRatio;
  })();

  return (
    <div 
      className="relative mx-auto w-full max-w-full overflow-hidden rounded-2xl shadow-xl group" 
      style={{ aspectRatio: `${effectiveBannerRatio}` }}
    >
      <AnimatePresence mode="wait">
        <motion.a
          key={banner.id}
          href={banner.link || undefined}
          onClick={(e) => { if (!banner.link) e.preventDefault(); }}
          initial={{ opacity: 0, x: 80 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -80 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          className="absolute inset-0 block h-full w-full cursor-pointer bg-slate-900"
        >
          <img
            src={banner.image_url}
            alt={banner.title || 'Banner'}
            className="h-full w-full object-cover sm:object-contain sm:bg-slate-100"
          />
          {(banner.title || banner.subtitle) && (
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/30 to-transparent px-4 pb-6 text-white sm:px-8 sm:pb-8 md:px-14">
              {banner.title && <h2 className="mb-2 max-w-full text-xl font-bold leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] sm:max-w-none sm:text-3xl md:text-5xl">{banner.title}</h2>}
              {banner.subtitle && <p className="mb-4 max-w-full text-xs leading-snug opacity-95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] sm:max-w-xl sm:text-base md:text-xl">{banner.subtitle}</p>}
              {banner.link && (
                <Button variant="primary" className="w-fit px-4 py-2 text-xs sm:text-sm md:text-base bg-brand-primary text-white hover:bg-blue-600 border-none shadow-lg">
                  Learn More
                </Button>
              )}
            </div>
          )}
        </motion.a>
      </AnimatePresence>

      {hasMultiple && (
        <>
          <button
            aria-label="Previous banner"
            onClick={(e) => { e.preventDefault(); goPrev(); }}
            className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-lg text-white opacity-100 transition-opacity hover:bg-black/50 sm:left-4"
          >
            ‹
          </button>
          <button
            aria-label="Next banner"
            onClick={(e) => { e.preventDefault(); goNext(); }}
            className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-lg text-white opacity-100 transition-opacity hover:bg-black/50 sm:right-4"
          >
            ›
          </button>

          <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-2 sm:bottom-5">
            {banners.map((b, idx) => (
              <button
                key={b.id}
                aria-label={`Go to banner ${idx + 1}`}
                onClick={(e) => { e.preventDefault(); goTo(idx); }}
                className={`h-2.5 rounded-full transition-all ${
                  idx === currentIndex ? 'w-8 bg-white' : 'w-2.5 bg-white/60 hover:bg-white/85'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
