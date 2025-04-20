import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';

const formSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  branch: z.string().min(1, "Branch is required"),
  academic_year: z.coerce.number().min(1).max(4),
  semester: z.coerce.number().min(1).max(2)
});

type ProfileFormData = z.infer<typeof formSchema>;

type ProfileEditFormProps = {
  isOnboarding?: boolean;
  onComplete?: () => void;
};

const ProfileEditForm = ({ isOnboarding = false, onComplete }: ProfileEditFormProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: '',
      branch: '',
      academic_year: 1,
      semester: 1
    }
  });

  useEffect(() => {
    async function loadUserProfile() {
      if (!user) return;
      
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('students')
          .select('full_name, branch, academic_year, semester')
          .eq('id', user.id)
          .single();
          
        if (error && error.code !== 'PGRST116') {
          throw error;
        }
        
        if (data) {
          // Pre-fill form with existing data
          form.reset({
            full_name: data.full_name || user?.user_metadata?.full_name || '',
            branch: data.branch || '',
            academic_year: data.academic_year || 1,
            semester: data.semester || 1
          });
        } else if (user?.user_metadata?.full_name) {
          // If we have name from Google auth, use it
          form.setValue('full_name', user.user_metadata.full_name);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        toast.error('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    }
    
    loadUserProfile();
  }, [user, form]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) {
      toast.error("You must be logged in to update your profile");
      navigate('/auth');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Check if the user profile already exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('students')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found" error
        throw fetchError;
      }
      
      let result;
      
      if (existingProfile) {
        // Update existing profile
        result = await supabase
          .from('students')
          .update({
            full_name: data.full_name,
            branch: data.branch,
            academic_year: data.academic_year,
            semester: data.semester
          })
          .eq('id', user.id)
          .select();
      } else {
        // Insert new profile
        result = await supabase
          .from('students')
          .insert({
            id: user.id,
            email: user.email,
            full_name: data.full_name,
            branch: data.branch,
            academic_year: data.academic_year,
            semester: data.semester,
            is_admin: false,
            created_at: new Date().toISOString()
          })
          .select();
      }
      
      if (result.error) throw result.error;

      console.log('Profile update successful:', result.data);

      // First remove any existing cached data to ensure clean state
      queryClient.removeQueries({ queryKey: ['userProfile', user.id] });

      // Update the cache with the new/updated profile
      if (result.data && result.data.length > 0) {
        // Set the data in cache directly
        queryClient.setQueryData(['userProfile', user.id], result.data[0]);
        
        // Log the updated cache data
        console.log('Cache updated with:', result.data[0]);
      }

      // Force invalidate all related queries to ensure UI is updated with fresh data
      setTimeout(() => {
        queryClient.invalidateQueries();
        
        // Specifically refetch these key queries
        queryClient.refetchQueries({ queryKey: ['userProfile', user.id] });
        queryClient.refetchQueries({ queryKey: ['subjects'] });
        queryClient.refetchQueries({ queryKey: ['bookmarks'] });
        
        // Show success after queries are invalidated
        toast.success(isOnboarding ? 'Profile created successfully' : 'Profile updated successfully');
        
        if (onComplete) {
          // Give a moment for queries to refresh before completing
          setTimeout(() => {
            onComplete();
          }, 300);
        } else if (isOnboarding) {
          // For onboarding, delay navigation to ensure data is loaded
          setTimeout(() => {
            navigate('/home');
          }, 800);
        }
      }, 200);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast.error('Failed to update profile: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Use a fixed loading state of 1.5 seconds for better UX
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setLoading(false);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [loading]);

  if (loading && !isOnboarding) {
    return <div className="text-center py-4">Loading profile data...</div>;
  }

  return (
    <div className={isOnboarding ? "min-h-screen bg-background flex items-center justify-center p-4" : ""}>
      <div className={isOnboarding ? "max-w-md w-full space-y-8 neo-blur p-8 rounded-xl" : "w-full"}>
        {isOnboarding && (
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gradient-primary mb-2">Welcome!</h2>
            <p className="text-gray-400">Let's set up your academic profile</p>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="branch"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your branch" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="CSE">Computer Science</SelectItem>
                      <SelectItem value="ECE">Electronics</SelectItem>
                      <SelectItem value="ME">Mechanical</SelectItem>
                      <SelectItem value="CE">Civil</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="academic_year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Academic Year</FormLabel>
                  <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value.toString()}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your academic year" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">First Year</SelectItem>
                      <SelectItem value="2">Second Year</SelectItem>
                      <SelectItem value="3">Third Year</SelectItem>
                      <SelectItem value="4">Fourth Year</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="semester"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Semester</FormLabel>
                  <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value.toString()}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your semester" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">Semester 1</SelectItem>
                      <SelectItem value="2">Semester 2</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isOnboarding ? 'Complete Setup' : 'Save Changes'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default ProfileEditForm; 