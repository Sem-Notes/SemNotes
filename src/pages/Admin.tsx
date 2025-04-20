import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Edit, Trash, Plus, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Navigate, useNavigate } from 'react-router-dom';

// Types
type Student = {
  id: string;
  full_name: string;
  email: string;
  branch: string;
  academic_year: number;
  semester: number;
  is_admin: boolean;
  created_at: string;
};

type Subject = {
  id: string;
  name: string;
  branch: string;
  academic_year: number;
  semester: number;
  is_common: boolean;
  created_at: string;
};

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('subjects');
  
  // Check if user is authenticated and is admin
  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      if (!data) throw new Error('No profile found');
      return data;
    },
    enabled: !!user?.id,
  });
  
  // Fetch all students
  const { 
    data: students, 
    isLoading: studentsLoading, 
    error: studentsError,
    refetch: refetchStudents
  } = useQuery({
    queryKey: ['allStudents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Student[];
    },
    enabled: !!userProfile?.is_admin,
  });
  
  // Fetch all subjects
  const { 
    data: subjects, 
    isLoading: subjectsLoading, 
    error: subjectsError,
    refetch: refetchSubjects
  } = useQuery({
    queryKey: ['allSubjects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Subject[];
    },
    enabled: !!userProfile?.is_admin,
  });
  
  // If not admin, redirect to home
  if (!profileLoading && (!userProfile || !userProfile.is_admin)) {
    return <Navigate to="/home" replace />;
  }
  
  // Force refresh data
  const handleRefreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['allStudents'] });
    queryClient.invalidateQueries({ queryKey: ['allSubjects'] });
    toast.success('Refreshing data...');
  };
  
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gradient mb-4">Admin Dashboard</h1>
          <p className="text-muted-foreground mb-6">
            Manage subjects, users, and application settings
          </p>
          
          <div className="flex justify-between items-center mb-6">
            <Tabs defaultValue="subjects" className="w-full" onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-2 w-[400px]">
                <TabsTrigger value="subjects">Subjects</TabsTrigger>
                <TabsTrigger value="users">Users</TabsTrigger>
              </TabsList>
              
              <div className="mt-6">
                <TabsContent value="subjects">
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>All Subjects</CardTitle>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleRefreshData}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                          </Button>
                          <Button size="sm">
                            <Plus className="h-4 w-4 mr-2" /> Add Subject
                          </Button>
                        </div>
                      </div>
                      <CardDescription>
                        View and manage all subjects in the system
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {subjectsLoading ? (
                        <div className="space-y-4">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                          ))}
                        </div>
                      ) : subjectsError ? (
                        <div className="text-center py-4">
                          <AlertCircle className="h-8 w-8 mx-auto text-red-400 mb-2" />
                          <p className="text-red-400">Failed to load subjects</p>
                        </div>
                      ) : subjects && subjects.length > 0 ? (
                        <div className="border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Branch</TableHead>
                                <TableHead>Year</TableHead>
                                <TableHead>Semester</TableHead>
                                <TableHead>Common</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {subjects.map((subject) => (
                                <TableRow key={subject.id}>
                                  <TableCell className="font-medium">{subject.name}</TableCell>
                                  <TableCell>{subject.branch}</TableCell>
                                  <TableCell>{subject.academic_year}</TableCell>
                                  <TableCell>{subject.semester}</TableCell>
                                  <TableCell>{subject.is_common ? 'Yes' : 'No'}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Button variant="ghost" size="icon">
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="text-red-400">
                                        <Trash className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">No subjects found</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="users">
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>All Users</CardTitle>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleRefreshData}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                        </Button>
                      </div>
                      <CardDescription>
                        View and manage all users in the system
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {studentsLoading ? (
                        <div className="space-y-4">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                          ))}
                        </div>
                      ) : studentsError ? (
                        <div className="text-center py-4">
                          <AlertCircle className="h-8 w-8 mx-auto text-red-400 mb-2" />
                          <p className="text-red-400">Failed to load users</p>
                        </div>
                      ) : students && students.length > 0 ? (
                        <div className="border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Branch</TableHead>
                                <TableHead>Year</TableHead>
                                <TableHead>Semester</TableHead>
                                <TableHead>Admin</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {students.map((student) => (
                                <TableRow key={student.id}>
                                  <TableCell className="font-medium">{student.full_name || 'No name'}</TableCell>
                                  <TableCell>{student.email || 'No email'}</TableCell>
                                  <TableCell>{student.branch || 'N/A'}</TableCell>
                                  <TableCell>{student.academic_year || 'N/A'}</TableCell>
                                  <TableCell>{student.semester || 'N/A'}</TableCell>
                                  <TableCell>{student.is_admin ? 'Yes' : 'No'}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Button variant="ghost" size="icon">
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">No users found</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Admin; 