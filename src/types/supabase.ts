export type DbRole = 'user' | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: DbRole;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  price: number;
  discount: number;
  learning_points: string[] | null;
  thumbnail_url: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface CourseFile {
  id: string;
  course_id: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  course_id: string | null;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Database {
  profiles: Profile;
  categories: Category;
  courses: Course;
  course_files: CourseFile;
  orders: Order;
}
