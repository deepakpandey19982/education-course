'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Course } from '@/types/supabase';

interface CourseFormProps {
  initialCourse?: Course;
  onSuccess?: () => void;
}

export const CourseForm = ({ initialCourse, onSuccess }: CourseFormProps) => {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
  const [formData, setFormData] = useState({
    title: initialCourse?.title || '',
    description: initialCourse?.description || '',
    category_id: initialCourse?.category_id || '',
    price: initialCourse?.price || 0,
    discount: initialCourse?.discount || 0,
    thumbnail_url: initialCourse?.thumbnail_url || '',
    is_published: initialCourse?.is_published ?? false,
  });

  // State for dynamic learning points
  const [learningPoints, setLearningPoints] = useState<string[]>(
    initialCourse?.learning_points?.length
      ? initialCourse.learning_points
      : ['', '', '', '']
  );

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  useEffect(() => {
    async function fetchCategories() {
      const { data } = await supabase.from('categories').select('id, name').order('name');
      if (data) setCategories(data);
    }
    fetchCategories();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked :
              type === 'number' ? parseFloat(value) : value,
    }));
  };

  const handlePointChange = (index: number, value: string) => {
    const updatedPoints = [...learningPoints];
    updatedPoints[index] = value;
    setLearningPoints(updatedPoints);
  };

  const addPoint = () => {
    setLearningPoints([...learningPoints, '']);
  };

  const removePoint = (index: number) => {
    if (learningPoints.length <= 1) return;
    const updatedPoints = learningPoints.filter((_, i) => i !== index);
    setLearningPoints(updatedPoints);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPdfFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let courseId = initialCourse?.id;
      let filePath = '';

      // 1. Upload PDF if provided
      if (pdfFile) {
        setUploadingPdf(true);
        const fileExt = pdfFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const storagePath = `pdfs/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('course-pdfs')
          .upload(storagePath, pdfFile);

        if (uploadError) throw new Error('PDF Upload failed: ' + uploadError.message);
        filePath = storagePath;
        setUploadingPdf(false);
      }

      // Filter out empty points before saving
      const filteredPoints = learningPoints.filter(p => p.trim() !== '');

      // 2. Save Course Metadata
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .upsert({
          id: courseId,
          ...formData,
          learning_points: filteredPoints,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (courseError) throw new Error('Course save failed: ' + courseError.message);

      courseId = courseData.id;

      // 3. Link PDF to Course if uploaded
      if (filePath) {
        const { error: fileError } = await supabase.from('course_files').upsert({
          course_id: courseId,
          file_path: filePath,
          file_name: pdfFile!.name,
          file_size: pdfFile!.size,
        }, { onConflict: 'course_id' });

        if (fileError) throw new Error('PDF mapping failed: ' + fileError.message);
      }

      alert('Course saved successfully!');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
      setUploadingPdf(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-xl soft-shadow border border-slate-100">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Title */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Course Title</label>
          <input
            required
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none text-slate-900 placeholder-slate-400"
            placeholder="e.g. Full Stack Web Development"
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Category</label>
          <select
            name="category_id"
            value={formData.category_id}
            onChange={handleInputChange}
            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none text-slate-900 placeholder-slate-400"
          >
            <option value="">Select a Category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Price */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Price (₹)</label>
          <input
            required
            type="number"
            name="price"
            value={formData.price}
            onChange={handleInputChange}
            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none text-slate-900 placeholder-slate-400"
            placeholder="0.00"
          />
        </div>

        {/* Discount */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Discount (%)</label>
          <input
            type="number"
            name="discount"
            min="0"
            max="100"
            value={formData.discount}
            onChange={handleInputChange}
            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none text-slate-900 placeholder-slate-400"
            placeholder="0"
          />
          <div className="text-xs text-slate-500 font-medium mt-1">
            Final Price: <span className="text-brand-primary font-bold">₹{(formData.price * (1 - formData.discount / 100)).toFixed(2)}</span>
          </div>
        </div>

        {/* Thumbnail URL */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Thumbnail Image URL</label>
          <input
            name="thumbnail_url"
            value={formData.thumbnail_url}
            onChange={handleInputChange}
            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none text-slate-900 placeholder-slate-400"
            placeholder="https://..."
          />
        </div>

        {/* Description */}
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-bold text-slate-700">Course Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={4}
            className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none text-slate-900 placeholder-slate-400"
            placeholder="Describe what students will learn..."
          />
        </div>

        {/* Learning Points */}
        <div className="space-y-4 md:col-span-2 p-6 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <label className="text-sm font-bold text-slate-700">What You Will Learn</label>
            <Button variant="outline" size="sm" onClick={addPoint} className="gap-2">
              <span>+</span> Add Point
            </Button>
          </div>
          <div className="space-y-3">
            {learningPoints.map((point, index) => (
              <div key={index} className="flex gap-2 items-center">
                <span className="text-slate-400 text-sm font-medium w-6">{index + 1}.</span>
                <input
                  value={point}
                  onChange={(e) => handlePointChange(index, e.target.value)}
                  className="flex-grow p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none text-slate-900 placeholder-slate-400"
                  placeholder="Enter a key learning outcome..."
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => removePoint(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* PDF Upload */}
        <div className="space-y-2 md:col-span-2 p-4 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
          <label className="text-sm font-bold text-slate-700 block mb-2">Course PDF Asset (Private)</label>
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-blue-700"
            />
            {pdfFile && <span className="text-xs text-slate-600">{pdfFile.name}</span>}
          </div>
          <p className="text-xs text-slate-400 mt-2">Note: Uploading a new PDF will replace the existing one.</p>
        </div>

        {/* Publish Toggle */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="is_published"
            name="is_published"
            checked={formData.is_published}
            onChange={handleInputChange}
            className="w-4 h-4 text-brand-primary rounded focus:ring-brand-primary"
          />
          <label htmlFor="is_published" className="text-sm font-bold text-slate-700">Publish Course immediately</label>
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-6 border-t border-slate-100">
        <Button variant="ghost" type="button" onClick={() => window.history.back()}>Cancel</Button>
        <Button
          variant="primary"
          type="submit"
          disabled={loading || uploadingPdf}
        >
          {loading || uploadingPdf ? (
            <span>{uploadingPdf ? 'Uploading PDF...' : 'Saving...'}</span>
          ) : 'Save Course'}
        </Button>
      </div>
    </form>
  );
};
