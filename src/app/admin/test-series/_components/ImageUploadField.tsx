'use client';

import React, { useEffect, useState } from 'react';
import { uploadSiteAsset } from '@/lib/supabase';

export function ImageUploadField({
  label,
  buttonLabel = 'Choose Image',
  folder = 'test-series',
  existingUrl,
  onUrlChange,
}: {
  label: string;
  buttonLabel?: string;
  folder?: string;
  existingUrl?: string | null;
  onUrlChange: (url: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl || null);
  const [fileName, setFileName] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setPreviewUrl(existingUrl || null);
  }, [existingUrl]);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);

    try {
      const uploadedUrl = await uploadSiteAsset(file, folder);
      onUrlChange(uploadedUrl);
      setPreviewUrl(uploadedUrl);
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Image upload failed');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
        <label className="inline-flex w-fit cursor-pointer items-center justify-center rounded-lg bg-brand-primary px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-900 transition-colors shadow-xs">
          {uploading ? 'Uploading...' : buttonLabel}
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleChange} />
        </label>

        {(fileName || previewUrl) && (
          <div className="space-y-2">
            {previewUrl && (
              <div className="relative w-full max-w-xs h-28 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                <img src={previewUrl} alt={label} className="w-full h-full object-cover" />
              </div>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {uploading ? 'Uploading image...' : fileName || 'Current image'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
