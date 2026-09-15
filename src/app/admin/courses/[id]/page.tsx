import { Course } from '@/types/supabase';
import { supabase } from '@/lib/supabase';
import EditCourseClient from './EditCourseClient';

export async function generateStaticParams() {
  const { data: courses } = await supabase
    .from('courses')
    .select('id');

  return courses?.map((course) => ({
    id: course.id,
  })) || [];
}

export default function EditCoursePage() {
  return <EditCourseClient />;
}
