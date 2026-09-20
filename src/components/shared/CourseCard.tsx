import React from 'react';
import Link from 'next/link';
import { Button } from '../ui/Button';

interface CourseCardProps {
  title: string;
  instructor: string;
  price: number;
  discount: number;
  rating: number;
  category: string;
  image: string;
  courseId?: string;
}

export const CourseCard = ({ title, instructor, price, discount, rating, category, image, courseId }: CourseCardProps) => {
  const finalPrice = price * (1 - discount / 100);
  const isFree = price === 0 || Number(price) === 0;
  const targetHref = courseId ? `/courses/${courseId}` : '/courses';

  const fallbackImage = '/placeholder-course.svg';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden soft-shadow border border-slate-100 dark:border-slate-800 group hover:border-brand-primary dark:hover:border-blue-500 transition-all hover:-translate-y-1 flex flex-col justify-between">
      <div>
        <Link href={targetHref} className="block relative h-48 overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-pointer">
          <img
            src={image || fallbackImage}
            alt={title}
            onError={(e) => {
              (e.target as HTMLImageElement).src = fallbackImage;
            }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute top-3 left-3">
            <span className="bg-brand-primary text-white text-xs font-bold px-2 py-1 rounded">
              {category}
            </span>
          </div>
        </Link>
        <div className="p-5 pb-0">
          <Link href={targetHref} className="block group-hover:text-brand-primary dark:group-hover:text-blue-400 transition-colors">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 line-clamp-2">
              {title}
            </h3>
          </Link>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">by {instructor}</p>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-1 text-amber-500 dark:text-amber-400 font-bold">
              <span>⭐</span>
              <span>{rating}</span>
            </div>
            <div className="text-right">
              {isFree ? (
                <span className="text-xl font-bold text-green-600 dark:text-emerald-400">FREE</span>
              ) : discount > 0 ? (
                <div className="flex flex-col items-end">
                  <span className="text-xs text-slate-400 dark:text-slate-500 line-through">₹{price}</span>
                  <span className="text-xl font-bold text-brand-primary dark:text-blue-400">₹{finalPrice.toFixed(2)}</span>
                </div>
              ) : (
                <span className="text-xl font-bold text-brand-primary dark:text-blue-400">₹{price}</span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="p-5 pt-0">
        <Link href={targetHref} className="block w-full">
          <Button
            variant="outline"
            fullWidth
            size="sm"
            type="button"
          >
            View Course
          </Button>
        </Link>
      </div>
    </div>
  );
};
