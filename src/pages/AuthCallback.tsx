import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Handle the OAuth callback
    const handleCallback = async () => {
      try {
        // The callback will be automatically processed by Supabase
        // We just need to check if auth worked and redirect accordingly
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error in auth callback:', error);
          navigate('/auth');
          return;
        }
        
        if (data?.session) {
          // Session exists, redirect to home
          console.log('Auth callback successful, redirecting to home');
          navigate('/home');
        } else {
          // No session, redirect to auth
          console.log('Auth callback did not produce a session, redirecting to auth');
          navigate('/auth');
        }
      } catch (error) {
        console.error('Exception in auth callback:', error);
        navigate('/auth');
      }
    };
    
    handleCallback();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback; 