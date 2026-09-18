'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { HomeBanner } from '@/types/supabase';
import { Button } from '@/components/ui/Button';

export function HomeBannerSlider() {
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('home_banners')
        .select('*')
        .eq('is_enabled', true)
        .order('order');

      if (data) setBanners(data);
      setIsLoading(false);
    }
    fetchData();
  }, []);

  const intervalSeconds = banners[currentIndex]?.interval_seconds || 3;

  useEffect(() => {
    if (banners.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, intervalSeconds * 1000);

    return () => clearInterval(timer);
  }, [banners.length, intervalSeconds, currentIndex]);

  const goTo = (idx: number) => setCurrentIndex(((idx % banners.length) + banners.length) % banners.length);
  const goPrev = () => goTo(currentIndex - 1);
  const goNext = () => goTo(currentIndex + 1);

  if (isLoading) return <div className="w-full h-[400px] bg-slate-100 animate-pulse rounded-2xl" />;
  if (banners.length === 0) return null;

  const banner = banners[currentIndex];
  const hasMultiple = banners.length > 1;

  return (
    <div className="relative w-full h-[220px] sm:h-[320px] md:h-[440px] lg:h-[500px] rounded-2xl overflow-hidden shadow-xl group">
      <AnimatePresence mode="wait">
        <motion.a
          key={banner.id}
          href={banner.link || undefined}
          onClick={(e) => { if (!banner.link) e.preventDefault(); }}
          initial={{ opacity: 0, x: 80 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -80 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="absolute inset-0 block w-full h-full cursor-pointer"
        >
          <img
            src={banner.image_url}
            alt={banner.title || 'Banner'}
            className="w-full h-full object-cover"
          />
          {(banner.title || banner.subtitle) && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent flex flex-col justify-end sm:justify-center px-6 sm:px-10 md:px-16 pb-8 sm:pb-0 text-white">
              {banner.title && <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-2 md:mb-4">{banner.title}</h2>}
              {banner.subtitle && <p className="text-sm sm:text-lg md:text-xl mb-4 md:mb-6 opacity-90 max-w-xl">{banner.subtitle}</p>}
              {banner.link && (
                <Button variant="primary" className="w-fit">
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
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/30 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/50"
          >
            ‹
          </button>
          <button
            aria-label="Next banner"
            onClick={(e) => { e.preventDefault(); goNext(); }}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/30 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/50"
          >
            ›
          </button>

          <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {banners.map((b, idx) => (
              <button
                key={b.id}
                aria-label={`Go to banner ${idx + 1}`}
                onClick={(e) => { e.preventDefault(); goTo(idx); }}
                className={`h-2.5 rounded-full transition-all ${
                  idx === currentIndex ? 'bg-white w-8' : 'bg-white/50 hover:bg-white/80 w-2.5'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
