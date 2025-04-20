import { safeSupabase } from '@/integrations/supabase/safeClient';

// Simplified bookmark type that doesn't rely on supabase types
export interface Bookmark {
  id: string;
  user_id: string;
  note_id?: string;
  subject_id?: string;
  created_at: string;
}

/**
 * Fetch user bookmarks with robust error handling
 */
export async function fetchUserBookmarks(userId: string): Promise<Bookmark[]> {
  if (!userId) return [];
  
  // Create a controller to abort requests if they take too long
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);
  
  try {
    // Run both queries in parallel for speed
    const [noteIdResult, subjectIdResult] = await Promise.allSettled([
      // Try with note_id
      safeSupabase
        .from('bookmarks')
        .select('id, user_id, note_id, created_at')
        .eq('user_id', userId),
      
      // Try with subject_id
      safeSupabase
        .from('bookmarks')
        .select('id, user_id, subject_id, created_at')
        .eq('user_id', userId)
    ]);
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    // Process results from note_id query
    if (noteIdResult.status === 'fulfilled' && !noteIdResult.value.error && noteIdResult.value.data?.length > 0) {
      console.log('Bookmarks data (with note_id):', noteIdResult.value.data);
      return noteIdResult.value.data as Bookmark[];
    }
    
    // Process results from subject_id query
    if (subjectIdResult.status === 'fulfilled' && !subjectIdResult.value.error && subjectIdResult.value.data?.length > 0) {
      // Map subject_id to note_id for compatibility
      const mappedData = subjectIdResult.value.data.map(item => ({
        ...item,
        note_id: item.subject_id
      }));
      
      console.log('Bookmarks data (with subject_id mapped to note_id):', mappedData);
      return mappedData as Bookmark[];
    }
    
    // If we got no errors but also no data, return empty array (user has no bookmarks)
    if ((noteIdResult.status === 'fulfilled' && !noteIdResult.value.error) || 
        (subjectIdResult.status === 'fulfilled' && !subjectIdResult.value.error)) {
      console.log('User has no bookmarks');
      return [];
    }
    
    // If both failed, log the error and return empty array
    console.error('Could not fetch bookmarks with either note_id or subject_id');
    return [];
  } catch (error) {
    // Clear the timeout if there's an exception
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error('Bookmark fetch aborted due to timeout');
    } else {
      console.error('Caught error in bookmarks fetch:', error);
    }
    
    // Always return empty array on error to prevent UI from breaking
    return [];
  }
}

/**
 * Check if a note/subject is bookmarked
 */
export function isBookmarked(bookmarks: Bookmark[], id: string): boolean {
  return bookmarks?.some(bookmark => 
    (bookmark.note_id === id) || (bookmark.subject_id === id)
  ) || false;
}

/**
 * Add a bookmark
 */
export async function addBookmark(
  userId: string, 
  itemId: string
): Promise<{ success: boolean, message: string }> {
  if (!userId || !itemId) {
    return { success: false, message: 'Missing user ID or item ID' };
  }
  
  try {
    // Try adding with note_id first
    try {
      const { error } = await safeSupabase
        .from('bookmarks')
        .insert({
          user_id: userId,
          note_id: itemId,
        });
        
      if (!error) {
        console.log('Bookmark added successfully using note_id');
        return { success: true, message: 'Bookmark added successfully' };
      }
    } catch (innerError) {
      console.error('Error adding bookmark with note_id:', innerError);
    }
    
    // If that failed, try with subject_id
    try {
      const { error } = await safeSupabase
        .from('bookmarks')
        .insert({
          user_id: userId,
          subject_id: itemId,
        });
        
      if (!error) {
        console.log('Bookmark added successfully using subject_id');
        return { success: true, message: 'Bookmark added successfully' };
      } else {
        console.error('Error adding bookmark with subject_id:', error);
        return { success: false, message: error.message };
      }
    } catch (innerError) {
      console.error('Error adding bookmark with subject_id:', innerError);
      return { 
        success: false, 
        message: 'Failed to add bookmark. Please try again.' 
      };
    }
  } catch (error) {
    console.error('Error in addBookmark:', error);
    return { 
      success: false, 
      message: 'Failed to add bookmark. Please try again.'
    };
  }
}

/**
 * Remove a bookmark
 */
export async function removeBookmark(
  userId: string, 
  itemId: string
): Promise<{ success: boolean, message: string }> {
  if (!userId || !itemId) {
    return { success: false, message: 'Missing user ID or item ID' };
  }
  
  try {
    // Try removing with note_id first
    try {
      const { error } = await safeSupabase
        .from('bookmarks')
        .delete()
        .eq('user_id', userId)
        .eq('note_id', itemId);
        
      if (!error) {
        console.log('Bookmark removed successfully using note_id');
        return { success: true, message: 'Bookmark removed successfully' };
      }
    } catch (innerError) {
      console.error('Error removing bookmark with note_id:', innerError);
    }
    
    // If that failed, try with subject_id
    try {
      const { error } = await safeSupabase
        .from('bookmarks')
        .delete()
        .eq('user_id', userId)
        .eq('subject_id', itemId);
        
      if (!error) {
        console.log('Bookmark removed successfully using subject_id');
        return { success: true, message: 'Bookmark removed successfully' };
      } else {
        console.error('Error removing bookmark with subject_id:', error);
        return { success: false, message: error.message };
      }
    } catch (innerError) {
      console.error('Error removing bookmark with subject_id:', innerError);
      return { 
        success: false, 
        message: 'Failed to remove bookmark. Please try again.' 
      };
    }
  } catch (error) {
    console.error('Error in removeBookmark:', error);
    return { 
      success: false, 
      message: 'Failed to remove bookmark. Please try again.'
    };
  }
}

/**
 * Toggle a bookmark (add if not exists, remove if exists)
 */
export async function toggleBookmark(
  userId: string,
  itemId: string,
  isCurrentlyBookmarked: boolean
): Promise<{ success: boolean, action: 'added' | 'removed', message: string }> {
  if (isCurrentlyBookmarked) {
    const result = await removeBookmark(userId, itemId);
    return { 
      ...result, 
      action: 'removed'
    };
  } else {
    const result = await addBookmark(userId, itemId);
    return { 
      ...result, 
      action: 'added'
    };
  }
} 