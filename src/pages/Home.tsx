import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, RefreshCw, AlertCircle, Upload, Book, FileQuestion, Bookmark, BookmarkCheck, Edit, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/auth/AuthContext';
import { fetchUserBookmarks, isBookmarked, toggleBookmark } from '@/lib/database-fixed';
import { Subject, Student, Bookmark as BookmarkType } from '@/lib/types';
import { fetchStudentProfile, createOrUpdateStudentProfile, fetchSubjectsForStudent, testSupabaseConnection, debugSupabaseConnection } from '@/lib/supabase-utils';
import { safeSupabase } from '@/integrations/supabase/safeClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ProfileEditForm from '@/components/ProfileEditForm';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// Type for combined subject with bookmark status
type SubjectWithBookmark = Subject & {
  isBookmarked: boolean;
};

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Check for emergency mode activation from URL (for reconnection attempts)
  useEffect(() => {
    const retryAttempt = parseInt(searchParams.get('retryAttempt') || '0');
    if (retryAttempt > 3) {
      console.log(`🚨 Too many retry attempts (${retryAttempt}). Activating emergency mode.`);
      forceEmergencyMode();
    }
  }, [searchParams]);

  // Function to attempt reconnection
  const attemptReconnection = useCallback(() => {
    // Get current retry count from URL or default to 0
    const currentRetryCount = parseInt(searchParams.get('retryAttempt') || '0');
    // Increment retry count
    const newRetryCount = currentRetryCount + 1;
    // Update URL with new retry count
    searchParams.set('retryAttempt', newRetryCount.toString());
    setSearchParams(searchParams);
    
    // Reload the page to try again
    window.location.reload();
  }, [searchParams, setSearchParams]);

  // Force emergency mode with local data
  const forceEmergencyMode = useCallback(() => {
    console.log("🚨 Forcing emergency mode due to connection issues");
    setIsEmergencyMode(true);
    
    // Create emergency local data
    const emergencyProfile = {
      id: user?.id || 'emergency-user',
      full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Offline User',
      email: user?.email || 'offline@example.com',
      academic_year: 1,
      semester: 1,
      branch: 'CSE',
      is_admin: false,
      created_at: new Date().toISOString()
    } as Student;
    
    const emergencySubjects = [
      {
        id: 'offline-subject-1',
        name: 'Computer Science 101',
        academic_year: 1,
        semester: 1,
        branch: 'CSE',
        is_common: true,
        created_at: new Date().toISOString()
      },
      {
        id: 'offline-subject-2',
        name: 'Data Structures',
        academic_year: 1,
        semester: 1,
        branch: 'CSE',
        is_common: false,
        created_at: new Date().toISOString()
      }
    ] as Subject[];
    
    // Set data in react-query cache
    queryClient.setQueryData(['userProfile', user?.id], emergencyProfile);
    queryClient.setQueryData(['subjects'], emergencySubjects);
    queryClient.setQueryData(['bookmarks', user?.id], []);
    
    // Show offline mode toast
    toast.error("Working in offline mode due to database connection issues", { 
      description: "We couldn't reach our database server. Using limited offline data until connection is restored.",
      duration: 8000 
    });
  }, [user, queryClient]);

  // Directly test Supabase connection on page load
  useEffect(() => {
    if (!isEmergencyMode && user?.id) {
      // Check browser online status first
      const isOnline = navigator.onLine;
      
      if (!isOnline) {
        console.log("🌐 Browser reports offline status - activating emergency mode immediately");
        forceEmergencyMode();
        return;
      }
      
      // Try immediate connection test first
      testSupabaseConnection().then(isConnected => {
        if (!isConnected) {
          console.log("🌐 Initial Supabase connection test failed - will retry after delay");
          
          // Set a timeout to check again after 5 seconds before activating emergency mode
          setTimeout(async () => {
            // Check if we're still online according to the browser
            if (!navigator.onLine) {
              console.log("🌐 Browser now reports offline - activating emergency mode");
              forceEmergencyMode();
              return;
            }
            
            // Try one more connection test
            const isConnectedRetry = await testSupabaseConnection();
            if (!isConnectedRetry) {
              console.log("🌐 Supabase connection test failed after retry - activating emergency mode");
              forceEmergencyMode();
            } else {
              console.log("✅ Supabase connection established on retry - staying in normal mode");
            }
          }, 5000);
        } else {
          console.log("✅ Initial Supabase connection test successful");
        }
      });
      
      // Listen for online/offline events
      const handleOffline = () => {
        console.log("🌐 Browser went offline - activating emergency mode");
        if (!isEmergencyMode) {
          forceEmergencyMode();
        }
      };
      
      const handleOnline = () => {
        console.log("🌐 Browser back online - connection might be restored");
        // Don't automatically exit emergency mode - let user do it explicitly
      };
      
      window.addEventListener('offline', handleOffline);
      window.addEventListener('online', handleOnline);
      
      return () => {
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('online', handleOnline);
      };
    }
  }, [user?.id, isEmergencyMode, forceEmergencyMode]);

  // Fetch user's profile (year, semester, branch)
  const { 
    data: userProfile, 
    isLoading: profileLoading, 
    error: profileError,
    refetch: refetchProfile
  } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      try {
        console.log("Fetching user profile for:", user.id);
        const profile = await fetchStudentProfile(user.id);
        
        if (profile) {
          console.log("Profile found:", profile);
          return profile;
        }
        
        // If no profile exists, create a default one
        console.log("No profile found, creating default");
        const defaultProfile = {
          id: user.id,
          full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'New User',
          email: user?.email || '',
          academic_year: 1,
          semester: 1,
          branch: 'CSE',
          is_admin: false,
          created_at: new Date().toISOString()
        } as Student;
        
        const savedProfile = await createOrUpdateStudentProfile(user.id, defaultProfile);
        return savedProfile || defaultProfile;
      } catch (error) {
        console.error('Error in profile query:', error);
        
        // If we've been trying for a while with no success, switch to emergency mode
        if (error.name === 'AbortError' || error.message?.includes('timeout')) {
          console.log("🚨 Profile query timed out - may need to enter emergency mode");
          // Wait briefly to see if retries fix it before entering emergency mode
          setTimeout(() => {
            if (!userProfile) {
              forceEmergencyMode();
            }
          }, 5000);
        }
        
        throw error;
      }
    },
    enabled: !!user?.id && !isEmergencyMode,
    retry: 3,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true
  });

  // Get student's subjects
  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      // Use user ID from auth if available, even if profile isn't loaded yet
      const userId = user?.id;
      
      // Show loading toast when subjects start loading, but only if we don't have data yet
      if (!subjectsQuery.data || subjectsQuery.data.length === 0) {
        toast.loading("Loading subjects...", { id: 'subjects-loading', duration: 5000 });
      }
      
      if (!userId) {
        console.log('⚠️ No user ID available for subjects query');
        return [];
      }
      
      console.log(`🔍 Fetching subjects with userId: ${userId}`);
      try {
        // Pass userId directly to the enhanced fetchSubjectsForStudent function
        const subjects = await fetchSubjectsForStudent(userId);
        if (subjects.length > 0) {
          toast.success(`Loaded ${subjects.length} subjects`, { id: 'subjects-loading' });
        }
        return subjects;
      } catch (error) {
        console.error('❌ Error in subjects query:', error);
        toast.error("Failed to load subjects", { id: 'subjects-loading' });
        
        // Check if it's a timeout or network error
        if (error.name === 'AbortError' || error.message?.includes('timeout') || error.message?.includes('network')) {
          console.log("🚨 Subjects query failed due to connection issues - may enter emergency mode");
          // If profile is loaded but subjects are failing, this might be a good time for emergency mode
          if (userProfile && !isEmergencyMode) {
            setTimeout(() => {
              if (subjectsQuery.data?.length === 0) {
                forceEmergencyMode();
              }
            }, 5000);
          }
        }
        
        return [];
      }
    },
    enabled: !!user?.id && !isEmergencyMode,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
    initialData: [],
  });

  // Fetch bookmarks
  const { 
    data: bookmarks = [], 
    isLoading: bookmarksLoading,
    error: bookmarksError,
  } = useQuery({
    queryKey: ['bookmarks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      console.log("Fetching bookmarks for user:", user.id);
      const results = await fetchUserBookmarks(user.id);
      console.log("Bookmarks fetched:", results?.length);
      return results;
    },
    enabled: !!user?.id,
    retry: 2,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true
  });

  // This effect will trigger a refresh if profile is loaded but subjects are missing
  useEffect(() => {
    // Only run if profile is loaded but no subjects are available
    if (userProfile && subjectsQuery.data && subjectsQuery.data.length === 0 && !subjectsQuery.isFetching) {
      console.log('🔄 Profile loaded but no subjects found, triggering refresh...');
      
      // Show loading toast - use consistent ID to avoid duplicates
      toast.loading('Loading your subjects...', { id: 'subjects-direct-fetch' });
      
      // Try to fetch subjects directly using the profile
      fetchSubjectsForStudent(userProfile)
        .then(subjects => {
          if (subjects.length > 0) {
            console.log(`✅ Direct fetch found ${subjects.length} subjects`);
            // Update the query data with the fetched subjects
            queryClient.setQueryData(['subjects'], subjects);
            toast.success(`Loaded ${subjects.length} subjects`, { id: 'subjects-direct-fetch' });
          } else {
            console.log('⚠️ Direct fetch still found no subjects');
            toast.error('Could not load subjects', { id: 'subjects-direct-fetch' });
          }
        })
        .catch(error => {
          console.error('❌ Error in direct subjects fetch:', error);
          toast.error('Failed to load subjects', { id: 'subjects-direct-fetch' });
        });
    }
  }, [userProfile, subjectsQuery.data, subjectsQuery.isFetching]);

  // Add a more aggressive refresh mechanism
  useEffect(() => {
    if (user && userProfile && subjectsQuery.data.length === 0 && !subjectsQuery.isFetching) {
      console.log('Aggressive subjects refresh: Profile loaded but no subjects. Triggering refetch.');
      toast.loading('Loading subjects...', { id: 'subjects-aggressive-refresh', duration: 2000 });
      
      // Trigger a refetch immediately
      subjectsQuery.refetch();
      
      // Also set up a timer to try again after a short delay
      const timer = setTimeout(() => {
        if (subjectsQuery.data.length === 0) {
          console.log('Subjects still not loaded after delay, invalidating queries');
          queryClient.invalidateQueries({ queryKey: ['subjects'] });
          queryClient.invalidateQueries({ queryKey: ['userProfile'] });
          queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
        }
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [user, userProfile, subjectsQuery.data.length, subjectsQuery.isFetching, subjectsQuery.refetch, queryClient]);

  // This effect will run when subjects are successfully loaded
  useEffect(() => {
    // If we have subjects and we're not loading, clear any loading toasts
    if (subjectsQuery.data && 
        subjectsQuery.data.length > 0 && 
        !subjectsQuery.isLoading && 
        !subjectsQuery.isFetching) {
      // Clear all possible loading toast IDs
      toast.dismiss('subjects-loading');
      toast.dismiss('subjects-direct-fetch');
      toast.dismiss('subjects-aggressive-refresh');
      toast.dismiss('manual-refresh');
      
      // Force reset any loading states
      setIsRefreshing(false);
    }
  }, [subjectsQuery.data, subjectsQuery.isLoading, subjectsQuery.isFetching]);
  
  // Dedicated effect to prevent loading states from getting stuck
  useEffect(() => {
    // If loading takes too long, force reset the loading state
    if (isRefreshing) {
      const timeout = setTimeout(() => {
        setIsRefreshing(false);
      }, 5000); // Max 5 seconds of loading state
      
      return () => clearTimeout(timeout);
    }
  }, [isRefreshing]);
  
  // When refresh button is clicked, ensure loading state is properly managed
  const handleRefreshSubjects = useCallback(() => {
    if (isEmergencyMode) {
      // In emergency mode, attempt to reconnect instead of regular refresh
      attemptReconnection();
      return;
    }
    
    // Set loading state
    setIsRefreshing(true);
    
    toast.loading("Refreshing your subject list", { id: 'manual-refresh', duration: 5000 });
    
    // First, test the connection
    debugSupabaseConnection().then(async (isConnected) => {
      if (!isConnected) {
        toast.error("Connection issue detected", { 
          id: 'manual-refresh', 
          description: "We're having trouble connecting to our database. Please check your connection."
        });
        setIsRefreshing(false);
        return;
      }
      
      // If connected, invalidate and refetch subjects
      queryClient.invalidateQueries({
        queryKey: ["subjects", userProfile?.id],
      });
      
      if (userProfile?.id) {
        // Direct fetch for immediate loading
        try {
          const subjects = await fetchSubjectsForStudent(userProfile.id);
          
          if (subjects && subjects.length > 0) {
            toast.success(`${subjects.length} subjects loaded`, { id: 'manual-refresh', duration: 3000 });
            // Force update the cache
            queryClient.setQueryData(['subjects'], subjects);
          } else {
            toast.error("No subjects found", { 
              id: 'manual-refresh', 
              description: "We couldn't find any subjects for your profile. Please check your academic details."
            });
          }
        } catch (error) {
          console.error("Error refreshing subjects:", error);
          toast.error("Failed to load subjects", { 
            id: 'manual-refresh', 
            description: error.message || "An unknown error occurred" 
          });
        }
      } else {
        toast.error("Profile not loaded", { 
          id: 'manual-refresh', 
          description: "Please wait for your profile to load or try refreshing the page." 
        });
      }
      
      // Always reset loading state
      setIsRefreshing(false);
    });
  }, [queryClient, userProfile, isEmergencyMode, attemptReconnection]);

  // Memoized function to check if a subject is bookmarked
  const isBookmarkedCheck = useMemo(() => {
    return (id: string): boolean => {
      return isBookmarked(bookmarks, id);
    };
  }, [bookmarks]);

  // Memoize filtered subjects
  const filteredSubjects = useMemo(() => {
    if (!subjectsQuery.data) return [];

    return subjectsQuery.data
      .map((subject) => ({
        ...subject,
        isBookmarked: isBookmarkedCheck(subject.id),
      }))
      .filter((subject) =>
        subject.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        subject.branch.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [subjectsQuery.data, searchQuery, isBookmarkedCheck]);

  // Combined loading state
  const isLoading = profileLoading || subjectsQuery.isFetching || bookmarksLoading;

  // Show errors with toast
  useEffect(() => {
    if (profileError) {
      toast.error('Failed to load your profile');
    }

    if (subjectsQuery.error) {
      toast.error('Failed to load subjects');
    }

    if (bookmarksError) {
      toast.error('Failed to load your bookmarks');
    }
  }, [profileError, subjectsQuery.error, bookmarksError]);

  // Function to handle profile edit completion
  const handleProfileEditComplete = useCallback(() => {
    setEditProfileOpen(false);
    // Invalidate userProfile query to refresh data
    queryClient.invalidateQueries({
      queryKey: ['userProfile', user?.id]
    });
    toast.success('Profile updated successfully');
  }, [queryClient, user?.id]);

  // Toggle bookmark function - use optimistic updates
  const handleBookmarkToggle = async (id: string) => {
    if (!user) {
      toast.error('Please log in to bookmark subjects');
      return;
    }

    // Check if item is already bookmarked
    const currentlyBookmarked = isBookmarkedCheck(id);
    
    // Optimistic update
    queryClient.setQueryData(['bookmarks', user.id], (oldBookmarks: any[] = []) => {
      if (currentlyBookmarked) {
        return oldBookmarks.filter(bookmark => bookmark.subject_id !== id);
      } else {
        return [...oldBookmarks, { subject_id: id, user_id: user.id }];
      }
    });
    
    try {
      // Make the actual API call
      await toggleBookmark(user.id, id, currentlyBookmarked);
      
      // Show success toast
      toast.success(
        currentlyBookmarked ? 'Subject removed from bookmarks' : 'Subject added to bookmarks'
      );
      
      // Invalidate the queries to refresh the data
      queryClient.invalidateQueries({
        queryKey: ['bookmarks', user.id]
      });
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      toast.error('Failed to update bookmark');
      // Revert the optimistic update by refetching
      queryClient.invalidateQueries({
        queryKey: ['bookmarks', user.id]
      });
    }
  };

  const displayName = userProfile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student';
  
  // Check if user is admin - only show admin features if is_admin is true
  const isAdmin = userProfile?.is_admin === true;

  // Additional debug effect to check Supabase connection when loading fails
  useEffect(() => {
    // Only run this if we're experiencing loading issues
    const hasLoadingIssue = 
      (userProfile && subjectsQuery.data && subjectsQuery.data.length === 0 && !subjectsQuery.isFetching) ||
      (profileError) || 
      (subjectsQuery.error);
      
    if (hasLoadingIssue) {
      console.log("🔎 Detected loading issues - running Supabase connection diagnostics");
      debugSupabaseConnection().then(success => {
        console.log(`🔍 Connection diagnostics complete: ${success ? 'success' : 'issues detected'}`);
        
        // If we're having trouble with Supabase but browser is online, show a special toast
        if (!success && navigator.onLine) {
          toast.error("Connection issues detected", {
            description: "We're having trouble connecting to our database. Please try refreshing the page.",
            action: {
              label: "Refresh",
              onClick: () => window.location.reload()
            },
            duration: 10000
          });
        }
      });
    }
  }, [userProfile, subjectsQuery.data, subjectsQuery.isFetching, profileError, subjectsQuery.error]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Override any loading indicators */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* Hide any loading indicators in the navbar or top of page */
        .loading-dots, 
        [aria-label="Loading..."],
        .animate-spin:not([data-allowed="true"]) {
          display: none !important;
          opacity: 0 !important;
        }
      `}} />
      
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        {/* Emergency mode banner */}
        {isEmergencyMode && (
          <Alert className="mb-4 border-red-500 bg-red-500/10">
            <WifiOff className="h-4 w-4 text-red-500" />
            <AlertTitle className="text-red-500">Database connection issue detected</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <div>
                <p>We are unable to connect to our database server. You're viewing limited offline content.</p>
                <p className="text-xs mt-1">Your internet connection appears to be working, but our database might be temporarily unavailable.</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-2 border-red-500 text-red-500 hover:bg-red-500/20 whitespace-nowrap"
                onClick={attemptReconnection}
              >
                <Wifi className="mr-2 h-4 w-4" /> Try reconnecting
              </Button>
            </AlertDescription>
          </Alert>
        )}
      
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gradient mb-2">
                Welcome, {profileLoading ? 'Loading...' : displayName}
                {isEmergencyMode && <span className="ml-2 text-sm bg-red-500 text-white px-2 py-1 rounded-full">Offline</span>}
                {isAdmin && !isEmergencyMode && <span className="ml-2 text-sm bg-blue-500 text-white px-2 py-1 rounded-full">Admin</span>}
              </h1>
              
              {profileLoading ? (
                <div className="mb-2">
                  <Skeleton className="h-4 w-60" />
                </div>
              ) : profileError ? (
                <div className="text-red-400 flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Error loading profile. Please refresh the page.</span>
                </div>
              ) : (
                <div>
                  <p className="text-muted-foreground mb-2">
                    {`${userProfile?.branch || 'Unknown branch'} • Year ${userProfile?.academic_year || 'Unknown'} • Semester ${userProfile?.semester || 'Unknown'}`}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setEditProfileOpen(true)}
                    className="flex items-center gap-1 text-sm"
                  >
                    <Edit className="h-3 w-3" /> Edit Profile
                  </Button>
                </div>
              )}
            </div>
            
            {/* Fixed refresh button with no disabled state */}
            <div className="flex items-center gap-2">
              {/* This button must always be rendered, never disabled, and never show loading state */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={isEmergencyMode ? attemptReconnection : handleRefreshSubjects}
                className="flex items-center gap-1"
              >
                <RefreshCw className="h-4 w-4" />
                {isEmergencyMode ? 'Try reconnecting' : 'Refresh Data'}
              </Button>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search subjects..."
                  className="pl-10 pr-4 py-2 bg-secondary/20 border border-secondary/30 rounded-full w-full sm:w-auto min-w-[250px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              {isAdmin && (
                <Link to="/admin">
                  <Button variant="secondary" className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
                    Admin Dashboard
                  </Button>
                </Link>
              )}
              {isAdmin && (
                <Button 
                  variant="outline" 
                  className="text-yellow-400 border-yellow-400/30 hover:bg-yellow-500/10"
                  onClick={() => {
                    debugSupabaseConnection().then(success => {
                      if (success) {
                        toast.success("Connection test successful", {
                          description: "Your database connection is working correctly. Try refreshing data."
                        });
                      } else {
                        toast.error("Connection issues detected", {
                          description: "Please check your .env file and restart the application."
                        });
                      }
                    });
                  }}
                >
                  <AlertCircle className="mr-2 h-4 w-4" /> Check Connection
                </Button>
              )}
            <Link to="/upload">
              <Button className="bg-primary">
                <Upload className="mr-2 h-4 w-4" /> Upload Notes
              </Button>
            </Link>
          </div>
        </div>
        </div>

        <h2 className="text-xl font-semibold mb-4">My Subjects</h2>

        {/* Loading indicator for subjects - Only show when actually loading and not when we have subjects */}
        {(subjectsQuery.isLoading || subjectsQuery.isFetching) && filteredSubjects.length === 0 ? (
          <div className="bg-blue-500/10 text-blue-400 p-4 rounded-md mb-4 flex items-center">
            <div className="animate-spin mr-3">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">Loading your subjects...</p>
              <p className="text-sm opacity-80">We're retrieving subjects for {userProfile?.branch || 'your branch'} {userProfile?.academic_year ? `Year ${userProfile.academic_year}` : ''}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-auto bg-blue-500/20 border-blue-500/30"
              onClick={handleRefreshSubjects}
            >
              Refresh
            </Button>
          </div>
        ) : null}

        {(isLoading && !userProfile) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="border border-white/10 bg-black/40 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <Skeleton className="h-6 w-2/3 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-4/5 mb-2" />
                </CardContent>
                <CardFooter className="flex justify-between text-sm text-muted-foreground border-t border-white/5 pt-4">
                  <Skeleton className="h-9 w-24" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : subjectsQuery.error ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto text-red-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">Failed to load subjects</h3>
            <p className="text-muted-foreground mb-4">There was an error loading your subjects.</p>
            <Button onClick={handleRefreshSubjects}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh Data
            </Button>
          </div>
        ) : filteredSubjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="subjects-container">
            {filteredSubjects.map((subject) => (
              <Card 
                key={subject.id} 
                className="border border-white/10 bg-black/40 backdrop-blur-sm hover:bg-black/50 transition-all relative overflow-hidden group"
              >
                {/* Subject type indicator */}
                <div className={`absolute top-0 left-0 w-1 h-full ${subject.is_common ? 'bg-blue-500' : 'bg-primary'}`}></div>
                
                {/* Bookmark button */}
                <button 
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleBookmarkToggle(subject.id);
                  }}
                  aria-label={subject.isBookmarked ? "Remove bookmark" : "Bookmark subject"}
                >
                  {subject.isBookmarked ? (
                    <BookmarkCheck className="h-4 w-4 text-primary" />
                  ) : (
                    <Bookmark className="h-4 w-4 text-muted-foreground hover:text-primary" />
                  )}
                </button>

                <CardHeader className="pb-2 pt-6">
                  <CardTitle className="flex items-start gap-2">
                    <Book className="h-5 w-5 text-primary shrink-0 mt-1" />
                    <span>{subject.name}</span>
                  </CardTitle>
                  <CardDescription className="ml-7 text-muted-foreground">
                    {subject.branch} • Year {subject.academic_year} • Semester {subject.semester}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-300 flex items-center gap-2 ml-7">
                    {subject.is_common ? (
                      <>
                        <span className="text-blue-400 text-xs font-medium px-1.5 py-0.5 bg-blue-400/10 rounded">Common</span>
                        <span>Shared across branches</span>
                      </>
                    ) : (
                      <>
                        <span className="text-primary text-xs font-medium px-1.5 py-0.5 bg-primary/10 rounded">Branch</span>
                        <span>Specific to your branch</span>
                      </>
                    )}
                  </p>
                </CardContent>
                <CardFooter className="flex justify-between text-sm text-muted-foreground border-t border-white/5 pt-4">
                  <Link 
                    to={`/subjects/${subject.id}`}
                    className="inline-flex items-center gap-2 py-1.5 px-3 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors"
                  >
                    <FileQuestion className="h-4 w-4" />
                    View Notes
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 border border-dashed border-white/20 rounded-lg">
            <Book className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No subjects found</h3>
            <p className="text-muted-foreground">
              {searchQuery ? 
                'No subjects match your search query. Try a different search term.' : 
                'You don\'t have any subjects assigned yet.'
              }
            </p>
          </div>
        )}
      </main>

      {/* Profile Edit Dialog */}
      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <ProfileEditForm onComplete={handleProfileEditComplete} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Home;
