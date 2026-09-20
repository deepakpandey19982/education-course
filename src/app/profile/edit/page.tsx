'use client';

import React, { useState, useEffect } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { useRouter } from 'next/navigation';
import { supabase, getUserProfile, updateUserProfile, uploadSiteAsset } from '@/lib/supabase';
import Navbar from '@/components/shared/Navbar';
import Footer from '@/components/shared/Footer';
import { Button } from '@/components/ui/Button';

const createImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Unable to create crop canvas.');
  }

  const outputSize = 800;
  canvas.width = outputSize;
  canvas.height = outputSize;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to generate cropped image.'));
        return;
      }
      resolve(blob);
    }, 'image/jpeg', 0.92);
  });
}

export default function EditProfilePage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await getUserProfile();
        if (!profile) {
          router.replace('/login');
          return;
        }
        setFullName(profile.full_name || '');
        setAvatarUrl(profile.avatar_url || null);
      } catch (err) {
        console.error('Error loading profile:', err);
        setError('Failed to load profile information.');
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaveSuccess(null);

    try {
      await updateUserProfile({ full_name: fullName, avatar_url: avatarUrl });
      setSaveSuccess('Profile updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setError('Only JPG, PNG, or WebP images are allowed.');
      event.target.value = '';
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    setPendingFile(file);
    setCropSource(imageUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropModalOpen(true);
    setError(null);
    setSaveSuccess(null);
    event.target.value = '';
  };

  const handleCropConfirm = async () => {
    if (!pendingFile || !cropSource || !croppedAreaPixels) {
      setError('Please adjust the crop before saving.');
      return;
    }

    try {
      const croppedBlob = await getCroppedImg(cropSource, croppedAreaPixels);
      const croppedFile = new File([croppedBlob], pendingFile.name || 'profile.jpg', {
        type: pendingFile.type || 'image/jpeg',
      });

      // Show an immediate local preview so the user sees the change right away
      const localPreviewUrl = URL.createObjectURL(croppedBlob);
      setAvatarUrl(localPreviewUrl);

      // Close ONLY the crop modal — Account Settings panel stays open
      setCropModalOpen(false);
      setPendingFile(null);
      setCropSource(null);
      setCroppedAreaPixels(null);
      setError(null);

      // Now upload to storage and persist the permanent URL
      const url = await uploadSiteAsset(croppedFile, 'avatars');
      await updateUserProfile({ avatar_url: url });
      setAvatarUrl(url);
    } catch (err: any) {
      setError(err.message || 'Profile photo upload failed.');
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarUrl(null);
    try {
      await updateUserProfile({ avatar_url: null });
    } catch (err: any) {
      setError(err.message || 'Unable to remove the profile photo.');
    }
    setError(null);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all password fields.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setChangingPassword(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error('You must be logged in to change your password.');
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (verifyError) {
        throw new Error('Current password is incorrect.');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setPasswordSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err?.message || 'Unable to change password right now.');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="bg-white w-full max-w-lg rounded-2xl soft-shadow border border-slate-100 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Account Settings</h1>
              <p className="text-slate-500">Manage your profile and password</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Close account settings"
                onClick={() => router.push('/dashboard')}
                className="h-9 w-9 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100"
              >
                ×
              </button>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-700">Profile Picture</label>
              </div>

              <div className="flex items-center gap-4">
                <div className="h-24 w-24 shrink-0 rounded-full overflow-hidden border-2 border-slate-200 bg-slate-100 flex items-center justify-center shadow-sm">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        // Fallback gracefully if URL is broken
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                        (e.currentTarget.parentElement as HTMLDivElement).innerHTML =
                          `<span class="text-2xl font-bold text-slate-400">${(fullName?.[0] ?? 'U').toUpperCase()}</span>`;
                      }}
                    />
                  ) : (
                    <span className="text-3xl font-bold text-slate-400">{fullName?.[0]?.toUpperCase() || 'U'}</span>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-brand-primary-foreground hover:bg-blue-900">
                    Change Photo
                    <input type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
                  </label>
                  <Button variant="outline" type="button" onClick={handleRemoveAvatar}>Remove Photo</Button>
                </div>
              </div>
              <p className="text-xs text-slate-500">Recommended: square 1:1 image, ideally 400×400 px or larger.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Full Name</label>
              <input
                required
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none transition-all text-slate-900 placeholder-slate-400"
                placeholder="Enter your full name"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {error}
              </div>
            )}

            {saveSuccess && (
              <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-200 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                <span>{saveSuccess}</span>
              </div>
            )}

            <div className="flex gap-4">
              <Button
                variant="outline"
                fullWidth
                type="button"
                onClick={() => router.push('/dashboard')}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                fullWidth
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>

          <form onSubmit={handleChangePassword} className="space-y-6 mt-10 pt-6 border-t border-slate-200">
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Change Password</h2>
              <p className="text-sm text-slate-500">Use your current password to update your account password.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Current Password</label>
              <div className="relative">
                <input
                  required
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full p-3 pr-12 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none transition-all text-slate-900 placeholder-slate-400"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-brand-primary"
                >
                  {showCurrentPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">New Password</label>
              <div className="relative">
                <input
                  required
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-3 pr-12 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none transition-all text-slate-900 placeholder-slate-400"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-brand-primary"
                >
                  {showNewPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Confirm New Password</label>
              <div className="relative">
                <input
                  required
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-3 pr-12 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none transition-all text-slate-900 placeholder-slate-400"
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-brand-primary"
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {passwordError && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg border border-emerald-200">
                {passwordSuccess}
              </div>
            )}

            <Button variant="primary" fullWidth size="lg" disabled={changingPassword} type="submit">
              {changingPassword ? 'Changing password...' : 'Change Password'}
            </Button>
          </form>
        </div>
      </main>
      {cropModalOpen && cropSource && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-4 py-6">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Crop profile photo</h3>
              <button
                type="button"
                onClick={() => {
                  setCropModalOpen(false);
                  setCropSource(null);
                  setPendingFile(null);
                  setCroppedAreaPixels(null);
                }}
                className="h-8 w-8 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <div className="relative h-72 w-full overflow-hidden rounded-xl bg-slate-100">
              <Cropper
                image={cropSource}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, croppedArea) => setCroppedAreaPixels(croppedArea)}
              />
            </div>
            <div className="mt-4">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="w-full accent-brand-primary"
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="outline" type="button" onClick={() => {
                setCropModalOpen(false);
                setCropSource(null);
                setPendingFile(null);
                setCroppedAreaPixels(null);
              }}>
                Cancel
              </Button>
              <Button variant="primary" type="button" onClick={handleCropConfirm}>
                Use Cropped Photo
              </Button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
