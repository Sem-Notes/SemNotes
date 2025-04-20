import { safeSupabase as supabase } from '@/integrations/supabase/safeClient';
import { Bookmark, DatabaseResponse } from '@/lib/types';

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
export const fetchUserBookmarks = async (userId: string): Promise<Bookmark[]> => {
  console.log(`Fetching bookmarks for user: ${userId}`);
  
  try {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error fetching bookmarks:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      console.log('No bookmarks found for user:', userId);
      return [];
    }
    
    console.log(`Found ${data.length} bookmarks for user ${userId}`);
    return data;
  } catch (error) {
    console.error('Exception fetching bookmarks:', error);
    return [];
  }
};

/**
 * Check if a note/subject is bookmarked
 */
export const isBookmarked = (bookmarks: Bookmark[], id: string): boolean => {
  if (!bookmarks || !Array.isArray(bookmarks) || bookmarks.length === 0) {
    return false;
  }
  
  // Check if any bookmark has a matching subject_id or note_id
  return bookmarks.some(bookmark => 
    (bookmark.subject_id && bookmark.subject_id === id) || 
    (bookmark.note_id && bookmark.note_id === id)
  );
};

/**
 * Toggle a bookmark (add if not exists, remove if exists)
 */
export const toggleBookmark = async (
  userId: string, 
  id: string, 
  currentlyBookmarked: boolean
): Promise<DatabaseResponse<Bookmark>> => {
  console.log(`Toggling bookmark for user ${userId}, id ${id}, currently bookmarked: ${currentlyBookmarked}`);
  
  try {
    // If already bookmarked, delete the bookmark
    if (currentlyBookmarked) {
      // Need to handle both subject_id and note_id cases
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .or(`subject_id.eq.${id},note_id.eq.${id}`)
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error removing bookmark:', error);
        return { 
          success: false, 
          message: `Failed to remove bookmark: ${error.message}` 
        };
      }
      
      return { 
        success: true, 
        message: 'Bookmark removed successfully',
        action: 'removed'
      };
    } 
    // If not bookmarked, add a new bookmark
    else {
      // Create bookmark with both note_id and subject_id to satisfy database constraints
      const { data, error } = await supabase
        .from('bookmarks')
        .insert({
          user_id: userId,
          note_id: id,
          subject_id: id
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error adding bookmark:', error);
        return { 
          success: false, 
          message: `Failed to add bookmark: ${error.message}` 
        };
      }
      
      return { 
        success: true, 
        data, 
        message: 'Bookmark added successfully',
        action: 'added'
      };
    }
  } catch (error) {
    console.error('Exception toggling bookmark:', error);
    return { 
      success: false, 
      message: `An unexpected error occurred: ${error.message}` 
    };
  }
};

/**
 * Add a bookmark
 */
export async function addBookmark(
  userId: string, 
  itemId: string
): Promise<{ success: boolean, message: string }> {
  if (!userId || !itemId) {
    console.error('Missing userId or itemId in addBookmark:', { userId, itemId });
    return { success: false, message: 'Missing user ID or item ID' };
  }
  
  try {
    console.log(`Adding bookmark for user ${userId}, item ${itemId}`);
    
    // Determine if this is a note or subject and insert appropriate record
    // For now, we insert with both fields to ensure compatibility
    const { data, error } = await supabase
      .from('bookmarks')
      .insert({
        user_id: userId,
        note_id: itemId,
        subject_id: itemId
      })
      .select()
      .single();
      
    if (error) {
      console.error('Error adding bookmark:', error);
      return { success: false, message: `Failed to add bookmark: ${error.message}` };
    }
    
    console.log('Bookmark added successfully:', data);
    return { success: true, message: 'Bookmark added successfully' };
  } catch (error) {
    console.error('Exception in addBookmark:', error);
    return { 
      success: false, 
      message: 'Failed to add bookmark. Please try again later.'
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
      const { error } = await supabase
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
      const { error } = await supabase
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