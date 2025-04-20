import { supabase } from './client';

// Type assertion to allow working with tables not in the generated types
export const safeSupabase = supabase as any;

export default safeSupabase; 