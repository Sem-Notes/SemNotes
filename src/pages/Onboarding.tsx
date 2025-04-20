import React from 'react';
import OnboardingForm from '@/components/OnboardingForm';
import { useAuth } from '@/auth/AuthContext';
import { Navigate } from 'react-router-dom';

const Onboarding = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-center">Complete Your Profile</h1>
          <p className="text-muted-foreground mb-8 text-center">
            Please provide some information to personalize your experience.
          </p>
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <OnboardingForm />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding; 