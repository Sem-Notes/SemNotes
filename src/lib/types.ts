// Simplified types for our application, independent of Supabase's generated types

// Student type
export interface Student {
  id: string;
  full_name: string;
  email: string;
  academic_year: number;
  semester: number;
  branch: string;
  is_admin: boolean;
  created_at: string;
}

// Subject type
export interface Subject {
  id: string;
  name: string;
  branch: string;
  academic_year: number;
  semester: number;
  is_common: boolean;
  created_at: string;
}

// Bookmark type with both possible structures supported
export interface Bookmark {
  id: string;
  user_id: string;
  subject_id?: string; // Optional, might not exist in some bookmarks
  note_id?: string;    // Optional, might not exist in some bookmarks
  created_at: string;
}

// Note type
export interface Note {
  id: string;
  subject_id: string;
  title: string;
  content: string;
  is_published: boolean;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

// Combined type for a subject with bookmark status
export interface SubjectWithBookmark extends Subject {
  isBookmarked: boolean;
}

// Combined type for a note with history
export interface NoteWithHistory extends Note {
  viewedDate?: string; // When the user last viewed this note
}

// Type for database operation responses
export interface DatabaseResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  action?: 'added' | 'removed' | 'updated' | 'created';
} 