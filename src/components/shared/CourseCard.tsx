import React from 'react';
import { Button } from '../ui/Button';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const finalPrice = price * (1 - discount / 100);
  const isFree = price === 0 || Number(price) === 0;

  const fallbackImage = 'https://via.placeholder.com/300x200?text=Course+Image';

  return (
    <div className="bg-white rounded-xl overflow-hidden soft-shadow border border-slate-100 group hover:border-brand-primary transition-all hover:-translate-y-1">
      <div className="relative h-48 overflow-hidden bg-slate-100">
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
      </div>
      <div className="p-5">
        <h3 className="text-lg font-bold text-brand-text mb-1 line-clamp-2 group-hover:text-brand-primary transition-colors">
          {title}
        </h3>
        <p className="text-brand-muted text-sm mb-4">by {instructor}</p>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1 text-amber-500 font-bold">
            <span>⭐</span>
            <span>{rating}</span>
          </div>
          <div className="text-right">
            {isFree ? (
              <span className="text-xl font-bold text-green-600">FREE</span>
            ) : discount > 0 ? (
              <div className="flex flex-col items-end">
                <span className="text-xs text-slate-400 line-through">₹{price}</span>
                <span className="text-xl font-bold text-brand-primary">₹{finalPrice.toFixed(2)}</span>
              </div>
            ) : (
              <span className="text-xl font-bold text-brand-primary">₹{price}</span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          fullWidth
          size="sm"
          onClick={() => courseId && router.push(`/courses/${courseId}`)}
        >
          View Course
        </Button>
      </div>
    </div>
  );
};
