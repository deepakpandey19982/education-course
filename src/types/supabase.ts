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
  test_id: string | null;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_id: string | null;
  created_at: string;
  updated_at: string;
}

// --- Homepage Dynamic Content ---

export interface HomeBanner {
  id: string;
  image_url: string;
  link: string | null;
  title: string | null;
  subtitle: string | null;
  interval_seconds: number;
  order: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface HomeOption {
  id: string;
  title: string;
  icon_url: string | null;
  link: string | null;
  description: string | null;
  order: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SiteSetting {
  key: string;
  value: string;
}

// --- Test Series System ---
// Hierarchy: TestSeries -> TestSeriesSubject -> Test -> Question

export interface TestSeries {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  is_published: boolean;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface TestSeriesSubject {
  id: string;
  series_id: string;
  name: string;
  icon_url: string | null;
  order: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Test {
  id: string;
  subject_id: string;
  title: string;
  date_label: string | null;
  thumbnail_url: string | null;
  duration_minutes: number;
  max_marks: number;
  marks_per_correct: number;
  negative_marks: number;
  language: string;
  instructions: string | null;
  is_paid: boolean;
  price: number;
  is_published: boolean;
  scheduled_start: string | null;
  scheduled_end: string | null;
  order: number;
  created_at: string;
  updated_at: string;
}

// Alias kept for readability where code refers to "subject" generically.
export type TestSubject = TestSeriesSubject;

export interface Question {
  id: string;
  test_id: string;
  subject_id?: string | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  explanation: string | null;
  marks: number;
  negative_marks: number;
  language: string;
  order: number;
  created_at: string;
  updated_at: string;
}

// Shape returned to students during an attempt: correct_option/explanation stripped server-side.
export type QuestionForAttempt = Omit<Question, 'correct_option' | 'explanation'>;

export interface TestAttempt {
  id: string;
  user_id: string;
  test_id: string;
  started_at: string;
  duration_minutes_snapshot: number;
  submitted_at: string | null;
  status: 'in_progress' | 'submitted' | 'auto_submitted';
  score: number | null;
  correct_count: number | null;
  incorrect_count: number | null;
  unattempted_count: number | null;
  accuracy: number | null;
  created_at: string;
}

export interface TestAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option: 'A' | 'B' | 'C' | 'D' | null;
  status: 'not_visited' | 'visited' | 'answered' | 'marked_for_review' | 'answered_marked';
  is_correct: boolean | null;
  updated_at: string;
}

export interface Database {
  profiles: Profile;
  categories: Category;
  courses: Course;
  course_files: CourseFile;
  orders: Order;
  home_banners: HomeBanner;
  home_options: HomeOption;
  site_settings: SiteSetting;
  test_series: TestSeries;
  test_series_subjects: TestSeriesSubject;
  tests: Test;
  questions: Question;
  test_attempts: TestAttempt;
  test_answers: TestAnswer;
}
