import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Edit, Upload, BookOpen, Star, Clock, Medal, Settings, Book, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ProfileEditForm from '@/components/ProfileEditForm';
import { useAuth } from '@/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Types
type SubjectWithBookmark = {
  id: string;
  name: string;
  branch: string;
  academic_year: number;
  semester: number;
  is_common: boolean;
  bookmark_created_at: string;
};

type NoteWithHistory = {
  id: string;
  title: string;
  subject: {
    name: string;
    branch: string;
    academic_year: number;
    semester: number;
  };
  viewed_at: string;
};

const Profile = () => {
  const { user } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Add a force refresh function
  const forceRefresh = () => {
    console.log('Forcing refresh of profile data');
    window.location.reload();
  };
  
  // Fetch user's profile data first, before any effects that depend on it
  const { data: userProfile, isLoading, refetch } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      try {
        console.log('Fetching user profile in Profile page for', user.id);
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching profile in Profile page:', error);
          
          // If profile not found (code PGRST116), create a new one
          if (error.code === 'PGRST116') {
            console.log('Profile not found, creating one in Profile page');
            
            // Get user metadata
            const email = user?.email || '';
            const fullName = user?.user_metadata?.full_name || email?.split('@')[0] || 'New User';
            
            // Create a new profile with default values
            const { data: newProfile, error: createError } = await supabase
              .from('students')
              .insert({
                id: user.id,
                full_name: fullName,
                email: email,
                academic_year: 1,
                semester: 1,
                branch: 'CSE',
                is_admin: false,
                created_at: new Date().toISOString()
              })
              .select()
              .single();
            
            if (createError) {
              console.error('Error creating profile in Profile page:', createError);
              throw createError;
            }
            
            console.log('Created new profile in Profile page:', newProfile);
            return newProfile;
          }
          
          throw error;
        }
        
        console.log('Profile data in Profile page:', data);
        return data;
      } catch (error) {
        console.error('Caught error in Profile page profile fetch:', error);
        // Return a dummy profile rather than throwing to prevent loading state
        return {
          id: user.id,
          full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User',
          email: user?.email,
          academic_year: 1,
          semester: 1,
          branch: 'CSE',
          is_admin: false,
          created_at: new Date().toISOString()
        };
      }
    },
    enabled: !!user,
    retry: 1,
    refetchOnWindowFocus: false, // Disable automatic refetching on window focus
    staleTime: 300000, // 5 minutes
    cacheTime: 600000 // 10 minutes
  });
  
  // Effect to check for empty page on initial load - with better error handling
  // Now placed AFTER userProfile is defined
  useEffect(() => {
    let timeoutId: number;
    let hasDataLoaded = false;
    
    // Function to mark data as loaded
    const markDataLoaded = () => {
      hasDataLoaded = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
    
    if (user && !userProfile && !isLoading) {
      // Set a timeout to check if data loaded
      timeoutId = window.setTimeout(() => {
        if (!hasDataLoaded && !isLoading && !userProfile) {
          console.log('Profile data failed to load after timeout - forcing one-time refresh');
          // Store a flag in sessionStorage to prevent infinite reload loops
          if (sessionStorage.getItem('profile_reload_attempted') !== 'true') {
            sessionStorage.setItem('profile_reload_attempted', 'true');
            forceRefresh();
          } else {
            console.log('Already attempted reload once, not trying again');
            toast.error('Failed to load profile data. Please try again later.');
          }
        }
      }, 5000);
      
      // Clear the reload flag when component unmounts
      return () => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
      };
    }
    
    // If we have a profile already, mark as loaded
    if (userProfile) {
      markDataLoaded();
      sessionStorage.removeItem('profile_reload_attempted');
    }
  }, [user, userProfile, isLoading]);
  
  // Fetch user's bookmarked subjects - revised to handle both note_id and subject_id
  const { data: bookmarks, isLoading: bookmarksLoading } = useQuery({
    queryKey: ['bookmarkedSubjects', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      try {
        // Try various approaches to handle the schema differences
        
        // First try direct query with both columns
        try {
          // Try note_id join first
          const { data: noteIdData, error: noteIdError } = await supabase
            .from('bookmarks')
            .select(`
              id,
              note_id,
              created_at,
              subjects:note_id(
                id, name, branch, academic_year, semester, is_common
              )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          
          if (!noteIdError && noteIdData && noteIdData.some(item => item.subjects)) {
            console.log('Bookmark subjects loaded via note_id');
            
            return noteIdData
              .filter(item => item.subjects)
              .map(item => ({
                id: item.subjects.id,
                name: item.subjects.name,
                branch: item.subjects.branch,
                academic_year: item.subjects.academic_year,
                semester: item.subjects.semester,
                is_common: item.subjects.is_common,
                bookmark_created_at: item.created_at
              }));
          }
        } catch (e) {
          console.error('Error trying note_id join:', e);
        }
        
        // If note_id doesn't work, try subject_id join
        try {
          const { data: subjectIdData, error: subjectIdError } = await supabase
            .from('bookmarks')
            .select(`
              id,
              subject_id,
              created_at,
              subjects:subject_id(
                id, name, branch, academic_year, semester, is_common
              )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          
          if (!subjectIdError && subjectIdData && subjectIdData.some(item => item.subjects)) {
            console.log('Bookmark subjects loaded via subject_id');
            
            return subjectIdData
              .filter(item => item.subjects)
              .map(item => ({
                id: item.subjects.id,
                name: item.subjects.name,
                branch: item.subjects.branch,
                academic_year: item.subjects.academic_year,
                semester: item.subjects.semester,
                is_common: item.subjects.is_common,
                bookmark_created_at: item.created_at
              }));
          }
        } catch (e) {
          console.error('Error trying subject_id join:', e);
        }
        
        // If both specific joins fail, tell the user we couldn't load bookmarks
        console.error('Could not load bookmarks with either column join approach');
        return [];
      } catch (error) {
        console.error('Caught error in Profile bookmarks fetch:', error);
        return []; // Return empty array instead of throwing to prevent loading state
      }
    },
    enabled: !!user,
    retry: 1 // Limit retries to prevent infinite loading
  });

  // Fetch user's browsing history
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['viewHistory', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      try {
        console.log('Fetching history for user in Profile', user.id);
        const { data, error } = await supabase
          .from('history')
          .select(`
            note_id,
            viewed_at,
            notes:note_id(
              id, title, 
              subjects:subject_id(
                name, branch, academic_year, semester
              )
            )
          `)
          .eq('user_id', user.id)
          .order('viewed_at', { ascending: false })
          .limit(10);
        
        if (error) {
          console.error('Error fetching history in Profile:', error);
          throw error;
        }
        
        console.log('History data in Profile:', data);
        
        // Filter out any entries with null notes or subjects
        return data
          .filter(item => item.notes && item.notes.subjects)
          .map(item => ({
            id: item.notes.id,
            title: item.notes.title,
            subject: item.notes.subjects,
            viewed_at: item.viewed_at
          })) as NoteWithHistory[];
      } catch (error) {
        console.error('Caught error in Profile history fetch:', error);
        return []; // Return empty array instead of throwing to prevent loading state
      }
    },
    enabled: !!user,
    retry: 1 // Limit retries to prevent infinite loading
  });

  // Get user's initials for avatar
  const getUserInitials = () => {
    if (userProfile?.full_name) {
      const nameParts = userProfile.full_name.split(' ');
      if (nameParts.length > 1) {
        return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
      }
      return userProfile.full_name.substring(0, 2).toUpperCase();
    } else if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'UN';
  };

  // Get display name
  const getDisplayName = () => {
    return userProfile?.full_name || 
           user?.user_metadata?.full_name || 
           user?.email?.split('@')[0] || 
           'User';
  };

  // Get avatar URL
  const getAvatarUrl = () => {
    return user?.user_metadata?.avatar_url || null;
  };

  // Academic info display
  const getAcademicInfo = () => {
    const branch = userProfile?.branch || 'Not set';
    const year = userProfile?.academic_year ? `Year ${userProfile.academic_year}` : 'Not set';
    const semester = userProfile?.semester ? `Semester ${userProfile.semester}` : '';
    
    return `${branch} • ${year}${semester ? ` • ${semester}` : ''}`;
  };

  const handleEditComplete = () => {
    setEditDialogOpen(false);
    
    // Show a loading toast
    toast.loading('Refreshing your profile data...');
    
    // Use a single invalidation for userProfile
    queryClient.invalidateQueries({
      queryKey: ['userProfile', user?.id]
    });
    
    // Manually trigger a refetch of the profile data
    refetch()
      .then(() => {
        // Once profile is refetched, invalidate related data that might depend on profile
        queryClient.invalidateQueries({
          queryKey: ['subjects']
        });
        
        queryClient.invalidateQueries({
          queryKey: ['bookmarks']
        });
        
        // Show success toast
        toast.dismiss(); // Dismiss loading toast
        toast.success('Profile updated successfully');
      })
      .catch(error => {
        console.error('Error refreshing profile data:', error);
        toast.dismiss(); // Dismiss loading toast
        toast.error('Failed to refresh data. Please try again.');
      });
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Force reset user profile
  const resetProfile = async () => {
    if (!user) return;
    
    try {
      toast.loading('Resetting your profile...');
      console.log('Resetting profile for user', user.id);
      
      // First try to delete existing profile
      const { error: deleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', user.id);
      
      if (deleteError) {
        console.error('Error deleting profile:', deleteError);
        toast.dismiss();
        toast.error('Failed to reset profile: ' + deleteError.message);
        return;
      }
      
      console.log('Successfully deleted profile');
      
      // Clear the React Query cache for this user
      queryClient.removeQueries({ queryKey: ['userProfile', user?.id] });
      
      // Invalidate all potentially affected queries
      queryClient.invalidateQueries();
      
      // Show success message
      toast.dismiss();
      toast.success('Profile reset successfully. Please update your information.');
      
      // Open the edit dialog to allow user to create a new profile
      setTimeout(() => {
        setEditDialogOpen(true);
      }, 500);
    } catch (error) {
      console.error('Error resetting profile:', error);
      toast.dismiss();
      toast.error('Failed to reset profile. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="container mx-auto px-4 pt-24 pb-16">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">Loading profile data...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="flex flex-col md:flex-row gap-8 mb-8">
          <div className="md:w-1/3">
            <Card className="border border-white/10 bg-black/40 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center">
                  {getAvatarUrl() ? (
                    <div className="w-24 h-24 rounded-full overflow-hidden mb-4">
                      <img 
                        src={getAvatarUrl()} 
                        alt={getDisplayName()} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-white text-3xl mb-4">
                      {getUserInitials()}
                    </div>
                  )}
                  <h2 className="text-2xl font-bold">{getDisplayName()}</h2>
                  <p className="text-muted-foreground">{getAcademicInfo()}</p>
                  
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                      <Edit className="h-4 w-4 mr-1" /> Edit Profile
                    </Button>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-1" /> Settings
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 w-full mt-6 text-center">
                    <div className="bg-black/30 p-3 rounded-md">
                      <div className="text-xl font-bold">0</div>
                      <div className="text-xs text-muted-foreground">Uploads</div>
                    </div>
                    <div className="bg-black/30 p-3 rounded-md">
                      <div className="text-xl font-bold">{bookmarks?.length || 0}</div>
                      <div className="text-xs text-muted-foreground">Bookmarks</div>
                    </div>
                    <div className="bg-black/30 p-3 rounded-md">
                      <div className="text-xl font-bold">0</div>
                      <div className="text-xs text-muted-foreground">Avg. Rating</div>
                    </div>
                  </div>
                  
                  <div className="mt-6 w-full">
                    <h3 className="text-sm font-medium mb-2 text-muted-foreground">ACHIEVEMENTS</h3>
                    <div className="flex flex-wrap gap-2">
                      <div className="bg-primary/20 p-2 rounded-md flex items-center">
                        <Medal className="h-4 w-4 mr-1 text-primary" />
                        <span className="text-xs">New Member</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="md:w-2/3">
            <Tabs defaultValue="uploads">
              <TabsList className="w-full bg-secondary/10 border border-secondary/30">
                <TabsTrigger value="uploads" className="flex-1 data-[state=active]:bg-primary/30">
                  <Upload className="h-4 w-4 mr-2" /> My Uploads
                </TabsTrigger>
                <TabsTrigger value="bookmarks" className="flex-1 data-[state=active]:bg-primary/30">
                  <Star className="h-4 w-4 mr-2" /> Bookmarks
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 data-[state=active]:bg-primary/30">
                  <Clock className="h-4 w-4 mr-2" /> History
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="uploads" className="mt-6">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Upload className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-medium mb-2">No uploads yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Share your notes and help other students in your class
                  </p>
                  <Button>
                    <Upload className="h-4 w-4 mr-2" /> Upload Notes
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="bookmarks" className="mt-6">
                {bookmarksLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Card key={i} className="border border-white/10 bg-black/40">
                        <CardHeader className="p-4">
                          <Skeleton className="h-5 w-3/4 mb-2" />
                          <Skeleton className="h-4 w-1/2" />
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                ) : bookmarks && bookmarks.length > 0 ? (
                  <div className="space-y-4">
                    {bookmarks.map((subject) => (
                      <Card key={subject.id} className="border border-white/10 bg-black/40 relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-1 h-full ${subject.is_common ? 'bg-blue-500' : 'bg-primary'}`}></div>
                        <CardHeader className="p-4">
                          <CardTitle className="flex items-start gap-2 text-base font-medium">
                            <Book className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <span className="block">{subject.name}</span>
                              <div className="flex justify-between mt-1">
                                <span className="text-xs text-muted-foreground">
                                  {subject.branch} • Year {subject.academic_year} • Semester {subject.semester}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Bookmarked {formatDate(subject.bookmark_created_at)}
                                </span>
                              </div>
                            </div>
                          </CardTitle>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Star className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-medium mb-2">No bookmarks yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Save your favorite subjects for quick access
                    </p>
                    <Link to="/home">
                      <Button>
                        <Book className="h-4 w-4 mr-2" /> Browse Subjects
                      </Button>
                    </Link>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="history" className="mt-6">
                {historyLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Card key={i} className="border border-white/10 bg-black/40">
                        <CardHeader className="p-4">
                          <Skeleton className="h-5 w-3/4 mb-2" />
                          <Skeleton className="h-4 w-1/2" />
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                ) : history && history.length > 0 ? (
                  <div className="space-y-4">
                    {history.map((note) => (
                      <Card key={note.id} className="border border-white/10 bg-black/40">
                        <CardHeader className="p-4">
                          <CardTitle className="flex items-start gap-2 text-base font-medium">
                            <BookOpen className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <span className="block">{note.title}</span>
                              <div className="flex justify-between mt-1">
                                <span className="text-xs text-muted-foreground">
                                  {note.subject.name} • {note.subject.branch} • Semester {note.subject.semester}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Viewed {formatDate(note.viewed_at)}
                                </span>
                              </div>
                            </div>
                          </CardTitle>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Clock className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-medium mb-2">No recent activity</h3>
                    <p className="text-muted-foreground mb-4">
                      Your recently viewed notes will appear here
                    </p>
                    <Link to="/home">
                      <Button>
                        <BookOpen className="h-4 w-4 mr-2" /> Start Browsing
                      </Button>
                    </Link>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your personal information and academic details.
            </DialogDescription>
          </DialogHeader>
          <ProfileEditForm onComplete={handleEditComplete} />
        </DialogContent>
      </Dialog>
      
      {/* Debug panel */}
      {import.meta.env.DEV && (
        <div className="fixed bottom-4 right-4 bg-black/60 p-4 rounded-md backdrop-blur-sm z-50">
          <h3 className="text-xs font-semibold mb-2">Debug Tools</h3>
          <div className="flex flex-col gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={resetProfile}
              className="text-xs"
            >
              Reset Profile
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={forceRefresh}
              className="text-xs"
            >
              Reload Page
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
