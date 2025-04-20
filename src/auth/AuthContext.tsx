import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any | null }>;
  signUp: (email: string, password: string) => Promise<{ error: any | null }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: any | null }>;
  checkIsAdmin: () => Promise<boolean>;
};

const ADMIN_EMAIL = "c77864554@gmail.com";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Function to check if a user is an admin
  const checkIsAdmin = async (): Promise<boolean> => {
    if (!user) return false;
    
    // Check if the user email matches the admin email
    if (user.email === ADMIN_EMAIL) {
      return true;
    }
    
    // Also check the database for admin flag
    try {
      const { data } = await supabase
        .from('students')
        .select('is_admin')
        .eq('id', user.id)
        .single();
        
      return !!data?.is_admin;
    } catch (error) {
      console.error("Error checking admin status:", error);
      return false;
    }
  };

  // Reset all queries when auth state changes
  const resetQueries = () => {
    // Invalidate and refetch all queries to ensure fresh data
    queryClient.invalidateQueries();
  };

  // Memoize the navigation functions to prevent them from causing re-renders
  const navigateToHome = useCallback(() => navigate('/home'), [navigate]);
  const navigateToOnboarding = useCallback(() => navigate('/onboarding'), [navigate]);
  const navigateToRoot = useCallback(() => navigate('/'), [navigate]);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state changed:", event, session?.user?.id);
        
        // Only update state if there's an actual change in session state
        const isSessionChange = (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED');
        
        if (isSessionChange) {
        setSession(session);
        setUser(session?.user ?? null);
        }
        
        if (event === 'SIGNED_IN') {
          // Reset queries when user signs in
          resetQueries();
          
          try {
            // Check if user has completed onboarding
            const { data: profile, error } = await supabase
              .from('students')
              .select('branch, academic_year, semester, full_name, is_admin')
              .eq('id', session?.user?.id)
              .maybeSingle();

            console.log("User profile data:", profile, error);
            
            // Set admin status
            const isUserAdmin = await checkIsAdmin();
            setIsAdmin(isUserAdmin);
              
            // If profile doesn't exist or is missing required fields, redirect to onboarding
            if (error || !profile || !profile.branch || !profile.academic_year || !profile.semester) {
              console.log("User needs onboarding, redirecting...");
              
              // If error code is 406 (Not Acceptable) or other database error, 
              // we might need to create the profile table or fix permissions
              if (error) {
                console.error("Database error checking profile:", error);
                
                // Try to create the profile right away if there's a database error
                try {
                  const email = session?.user?.email || '';
                  const fullName = session?.user?.user_metadata?.full_name || email?.split('@')[0] || 'New User';
                  
                  const { data: newProfile, error: createError } = await supabase
                    .from('students')
                    .upsert({
                      id: session?.user?.id,
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
                    console.error("Error creating profile during auth:", createError);
                    toast.error("Error setting up your profile. Please try again.");
                    navigateToOnboarding();
                  } else {
                    console.log("Created profile during auth flow:", newProfile);
                    queryClient.setQueryData(['userProfile', session?.user?.id], newProfile);
                    toast.success("Profile created successfully!");
                    navigateToHome();
                    return;
                  }
                } catch (e) {
                  console.error("Exception creating profile:", e);
                  navigateToOnboarding();
                }
              } else {
                // If no profile exists (but no DB error), redirect to onboarding
                navigateToOnboarding();
              }
            } else {
              console.log("User has completed onboarding, redirecting to home...");
              navigateToHome();
            }
            toast.success('Successfully signed in!');
          } catch (error) {
            console.error("Error checking user profile:", error);
            // If there's an error or no profile found, direct to onboarding
            navigateToOnboarding();
          }
        } else if (event === 'SIGNED_OUT') {
          setIsAdmin(false);
          // Reset queries when user signs out
          resetQueries();
          navigateToRoot();
          toast.success('Successfully signed out!');
        }
      }
    );

    // Initial session check - more robust implementation
    const initializeAuth = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        
        // Only update state if we actually have a session change
        if (session?.user?.id) {
          console.log("Found existing session for user:", session.user.id);
      setSession(session);
          setUser(session.user);
          
          const isUserAdmin = await checkIsAdmin();
          setIsAdmin(isUserAdmin);
          
          // Check if user needs onboarding without redirecting
          const { data: profile } = await supabase
            .from('students')
            .select('id, academic_year, semester, branch, full_name, is_admin')
            .eq('id', session.user.id)
            .maybeSingle();
            
          // Cache the profile data if found
          if (profile) {
            queryClient.setQueryData(['userProfile', session.user.id], profile);
          }
          
          // Reset queries when session is initialized with a user
          resetQueries();
        } else {
          console.log("No active session found");
          // Clear state to be safe
          setSession(null);
          setUser(null);
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        // Clear state on error
        setSession(null);
        setUser(null);
        setIsAdmin(false);
      } finally {
      setLoading(false);
      }
    };
    
    initializeAuth();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [navigateToHome, navigateToOnboarding, navigateToRoot]);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      return { error };
    } catch (error) {
      console.error("Sign in error:", error);
    return { error };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });
      
      return { error };
    } catch (error) {
      console.error("Sign up error:", error);
    return { error };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      console.log("Signing out user...");
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error during sign out:", error);
        toast.error(`Sign out failed: ${error.message}`);
      }
    } catch (error) {
      console.error("Exception during sign out:", error);
      toast.error("An unexpected error occurred during sign out");
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
          redirectTo: window.location.origin + '/auth/callback'
      }
    });
      
      return { error };
    } catch (error) {
      console.error("Google sign in error:", error);
    return { error };
    }
  };

  const value = {
      session, 
      user, 
    isAdmin,
      loading, 
      signIn, 
      signUp, 
      signOut,
    signInWithGoogle,
    checkIsAdmin
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
