import { safeSupabase } from '@/integrations/supabase/safeClient';
import { Student, Subject, Bookmark } from './types';

/**
 * Test Supabase connection - a lightweight call to check if Supabase is responsive
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    console.log("🔌 Testing Supabase connection...");
    const startTime = Date.now();
    
    // Use a simple query instead of RPC call
    const { data, error } = await safeSupabase
      .from('students')
      .select('count', { count: 'exact', head: true })
      .limit(1)
      .maybeSingle();
    
    const endTime = Date.now();
    const elapsed = endTime - startTime;
    
    if (error) {
      console.error(`❌ Supabase connection test failed after ${elapsed}ms:`, error.message);
      return false;
    }
    
    console.log(`✅ Supabase connection test successful (${elapsed}ms)`);
    return true;
  } catch (error) {
    console.error("❌ Supabase connection test exception:", error.message);
    return false;
  }
}

/**
 * Safely fetch a student profile
 */
export async function fetchStudentProfile(userId: string): Promise<Student | null> {
  if (!userId) {
    console.log("🛑 fetchStudentProfile called with no userId");
    return null;
  }
  
  console.log(`🔍 fetchStudentProfile: Fetching profile for user ${userId}`);
  
  // First, test if Supabase is responsive
  const isConnected = await testSupabaseConnection();
  if (!isConnected) {
    console.log("⚠️ Supabase connection test failed - may affect profile fetch");
  }
  
  // Try up to 3 times with increasing timeouts
  let attempt = 0;
  const maxAttempts = 3;
  
  while (attempt < maxAttempts) {
    attempt++;
    try {
      console.log(`⏳ Profile fetch attempt ${attempt}/${maxAttempts}`);
      
      // Create an abort controller to avoid hanging requests
      const controller = new AbortController();
      const timeoutMs = 5000 + (attempt * 1000); // Increased timeout with each attempt
      const timeoutId = setTimeout(() => {
        console.log(`⏱️ Timed out after ${timeoutMs}ms on profile fetch attempt ${attempt}`);
        controller.abort();
      }, timeoutMs);
      
      // Try to fetch the profile
      console.log(`📡 Sending Supabase request to fetch profile for ${userId}`);
      const startTime = Date.now();
      
      const { data, error } = await safeSupabase
        .from('students')
        .select('id, full_name, email, academic_year, semester, branch, is_admin, created_at')
        .eq('id', userId)
        .maybeSingle()
        .abortSignal(controller.signal);
      
      const endTime = Date.now();
      const elapsed = endTime - startTime;
      console.log(`⏲️ Profile query took ${elapsed}ms`);
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      if (error) {
        console.error(`❌ Error fetching student profile (attempt ${attempt}):`, error);
        console.error(`🔧 Error details: ${JSON.stringify(error)}`);
        
        // Check if it's a network related error
        if (error.code === 'PGRST301' || 
            error.message?.includes('network') || 
            error.message?.includes('fetch')) {
          console.log("🌐 Detected network connectivity issue with Supabase");
        }
        
        if (attempt === maxAttempts) {
          console.error("⛔ All profile fetch attempts failed");
          return null;
        }
        
        // Wait before retry, with exponential backoff
        const backoffMs = 500 * Math.pow(2, attempt - 1);
        console.log(`⏳ Waiting ${backoffMs}ms before retry ${attempt+1}/${maxAttempts}`);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }
      
      if (data) {
        console.log(`✅ Profile found for user ${userId}:`, data);
        return data as Student;
      } else {
        console.log(`⚠️ No profile found for user ${userId}, might need to create one`);
        return null;
      }
    } catch (error) {
      // Handle AbortError explicitly
      if (error.name === 'AbortError') {
        console.error(`⏱️ Profile fetch timed out (attempt ${attempt})`);
      } else {
        console.error(`❌ Exception in fetchStudentProfile (attempt ${attempt}):`, error);
        console.error(`🔧 Error type: ${error.name}, message: ${error.message}`);
        if (error.stack) console.error(`🔍 Stack trace: ${error.stack.split('\n')[0]}`);
      }
      
      if (attempt === maxAttempts) {
        console.error("⛔ All profile fetch attempts failed due to exceptions");
        return null;
      }
      
      // Wait before retry with exponential backoff
      const backoffMs = 500 * Math.pow(2, attempt - 1);
      console.log(`⏳ Waiting ${backoffMs}ms before retry ${attempt+1}/${maxAttempts}`);
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }
  
  console.log(`⛔ All ${maxAttempts} profile fetch attempts failed for user ${userId}`);
  return null;
}

/**
 * Create or update a student profile
 */
export async function createOrUpdateStudentProfile(
  userId: string, 
  data: Partial<Student>
): Promise<Student | null> {
  if (!userId) return null;
  
  try {
    const profileData = {
      id: userId,
      ...data,
      created_at: data.created_at || new Date().toISOString()
    };
    
    // Create an abort controller to avoid hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    // Use upsert to either create or update
    const { data: result, error } = await safeSupabase
      .from('students')
      .upsert(profileData)
      .select()
      .single();
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    if (error) {
      console.error('Error upserting student profile:', error);
      return null;
    }
    
    return result as Student;
  } catch (error) {
    console.error('Exception in createOrUpdateStudentProfile:', error);
    return null;
  }
}

/**
 * Fetch subjects based on student profile
 */
export async function fetchSubjectsForStudent(studentIdOrProfile: string | Student): Promise<Subject[]> {
  // Handle either a student ID string or a full profile object
  let studentId: string;
  let academicYear: number;
  let semester: number;
  let branch: string;
  
  if (typeof studentIdOrProfile === 'string') {
    // We only have the ID, need to fetch the profile first
    studentId = studentIdOrProfile;
    console.log(`🔍 fetchSubjectsForStudent: Fetching profile for student ID ${studentId} first`);
    
    try {
      const profile = await fetchStudentProfile(studentId);
      if (!profile) {
        console.log(`⚠️ Could not fetch profile for student ID: ${studentId}`);
        return [];
      }
      
      academicYear = profile.academic_year;
      semester = profile.semester;
      branch = profile.branch;
      console.log(`📚 Student details: ${profile.full_name}, Year ${academicYear}, Sem ${semester}, Branch ${branch}`);
    } catch (error) {
      console.error('❌ Error fetching student profile for subjects:', error);
      return [];
    }
  } else if (!studentIdOrProfile) {
    console.log("🛑 fetchSubjectsForStudent called with no profile or ID");
    return [];
  } else {
    // We have the full profile object
    const profile = studentIdOrProfile;
    studentId = profile.id;
    academicYear = profile.academic_year;
    semester = profile.semester;
    branch = profile.branch;
    
    console.log(`🔍 fetchSubjectsForStudent: Using provided profile for ${profile.full_name} (${studentId})`);
    console.log(`📚 Academic details: Year ${academicYear}, Sem ${semester}, Branch ${branch}`);
  }
  
  // Try up to 3 times with increasing timeouts
  let attempt = 0;
  const maxAttempts = 3;
  
  while (attempt < maxAttempts) {
    attempt++;
    try {
      console.log(`⏳ Subjects fetch attempt ${attempt}/${maxAttempts}`);
      
      // Create an abort controller to avoid hanging requests
      const controller = new AbortController();
      const timeoutMs = 2000 + (attempt * 1000); // Increase timeout with each attempt
      const timeoutId = setTimeout(() => {
        console.log(`⏱️ Timeout reached after ${timeoutMs}ms for subjects query`);
        controller.abort();
      }, timeoutMs);
      
      // Fetch subjects that match the student's year, semester, and branch (or are common)
      const query = safeSupabase
        .from('subjects')
        .select('*')
        .eq('academic_year', academicYear)
        .eq('semester', semester)
        .or(`branch.eq.${branch},is_common.eq.true`);
        
      console.log(`🔎 Query params: ${JSON.stringify({
        year: academicYear,
        semester: semester,
        branch: branch
      })}`);
      
      // Log when the query is about to execute
      console.log(`📡 Sending Supabase request for subjects`);
      const startTime = Date.now();
      
      const { data, error } = await query;
      
      const endTime = Date.now();
      console.log(`⏲️ Subjects query took ${endTime - startTime}ms`);
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      if (error) {
        console.error(`❌ Error fetching subjects (attempt ${attempt}):`, error);
        console.error(`🔧 Error details: ${JSON.stringify(error)}`);
        if (attempt === maxAttempts) return [];
        // Wait before retry, with exponential backoff
        await new Promise(r => setTimeout(r, 500 * attempt));
        continue;
      }
      
      if (!data || data.length === 0) {
        console.log(`⚠️ No subjects found for profile (attempt ${attempt})`);
        console.log(`📊 Database might be missing subjects for: Year ${academicYear}, Sem ${semester}, Branch ${branch}`);
        
        // On the last attempt, try a more permissive query
        if (attempt === maxAttempts - 1) {
          console.log(`🔄 Trying more permissive query on final attempt`);
          
          const { data: fallbackData } = await safeSupabase
            .from('subjects')
            .select('*')
            .or(`academic_year.eq.${academicYear},is_common.eq.true`);
            
          if (fallbackData && fallbackData.length > 0) {
            console.log(`✅ Found ${fallbackData.length} subjects with fallback query`);
            return fallbackData as Subject[];
          }
        }
        
        // On the last attempt, just return empty array
        if (attempt === maxAttempts) return [];
        // Wait a bit and try again
        await new Promise(r => setTimeout(r, 500 * attempt));
        continue;
      }
      
      console.log(`✅ Successfully fetched ${data.length} subjects:`);
      console.log(`📋 First few subjects: ${data.slice(0, 2).map(s => s.name).join(', ')}...`);
      return data as Subject[];
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error(`⏱️ Subjects query timed out after ${2000 + (attempt * 1000)}ms (attempt ${attempt})`);
      } else {
        console.error(`❌ Exception in fetchSubjectsForStudent (attempt ${attempt}):`, error);
        console.error(`🔧 Error type: ${error.name}, message: ${error.message}`);
        if (error.stack) console.error(`🔍 Stack trace: ${error.stack.split('\n')[0]}`);
      }
      
      if (attempt === maxAttempts) {
        console.log(`⛔ All ${maxAttempts} subject fetch attempts failed`);
        return [];
      }
      
      // Wait before retry
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
  
  // This should not happen due to the returns in the loop, but TS requires a return here
  return [];
}

/**
 * Safely handle any Supabase operation with timeout and error handling
 */
export async function safeSupabaseOperation<T>(
  operation: () => Promise<{ data: any; error: any }>,
  errorMessage: string,
  defaultValue: T,
  timeoutMs: number = 2000
): Promise<T> {
  try {
    // Create an abort controller to avoid hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    // Run the operation
    const { data, error } = await operation();
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    if (error) {
      console.error(`${errorMessage}:`, error);
      return defaultValue;
    }
    
    return data as T;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`Operation timed out after ${timeoutMs}ms:`, errorMessage);
    } else {
      console.error(`Exception in operation: ${errorMessage}`, error);
    }
    return defaultValue;
  }
} 