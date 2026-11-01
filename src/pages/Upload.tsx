import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, FileUp, Check, X, Upload as UploadIcon } from 'lucide-react';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthContext';
import { useQuery } from '@tanstack/react-query';

const uploadFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  subject_id: z.string().min(1, "Subject is required"),
  unit_number: z.number().min(1).max(5),
  description: z.string().min(10, "Description must be at least 10 characters"),
  tags: z.string().optional(),
  academic_year: z.number().min(1).max(4),
  semester: z.number().min(1).max(2),
});

type UploadFormData = z.infer<typeof uploadFormSchema>;

type SubjectType = {
  id: string;
  name: string;
  branch: string;
  academic_year: number;
  semester: number;
  is_common?: boolean;
};

type StudentProfile = {
  academic_year: number | null;
  semester: number | null;
  branch: string | null;
};

const Upload = () => {
  const [step, setStep] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      title: '',
      subject_id: '',
      unit_number: 1,
      description: '',
      tags: '',
      academic_year: 1,
      semester: 1,
    }
  });

  const { data: userProfile } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('academic_year, semester, branch')
        .eq('id', user?.id)
        .single();
      
      if (error) throw error;
      return data as StudentProfile;
    },
    enabled: !!user?.id
  });

  useEffect(() => {
    if (userProfile) {
      form.setValue('academic_year', userProfile.academic_year || 1);
      form.setValue('semester', userProfile.semester || 1);
    }
  }, [userProfile, form]);

  const { data: subjects, refetch: refetchSubjects } = useQuery<SubjectType[]>({
    queryKey: ['uploadSubjects', form.watch('academic_year'), form.watch('semester'), userProfile?.branch],
    queryFn: async () => {
      if (!userProfile?.branch || !form.watch('academic_year') || !form.watch('semester')) {
        return [] as SubjectType[];
      }
      
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('academic_year', form.watch('academic_year'))
        .eq('semester', form.watch('semester'))
        .or(`branch.eq.${userProfile?.branch},is_common.eq.true`);
      
      if (error) throw error;
      return (data || []) as SubjectType[];
    },
    enabled: !!userProfile && !!form.watch('academic_year') && !!form.watch('semester')
  });

  useEffect(() => {
    if (form.watch('academic_year') && form.watch('semester')) {
      refetchSubjects();
    }
  }, [form.watch('academic_year'), form.watch('semester')]);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        handleFileSelect(droppedFile);
      } else {
        toast.error("Only PDF files are accepted");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf') {
        handleFileSelect(selectedFile);
      } else {
        toast.error("Only PDF files are accepted");
      }
    }
  };

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const onSubmit = async (data: z.infer<typeof uploadFormSchema>) => {
    if (!file) {
      toast.error("Please upload a PDF file");
      return;
    }

    setIsSubmitting(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = `notes/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('notes')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;

      const { data: fileUrl } = supabase.storage
        .from('notes')
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from('notes')
        .insert({
          title: data.title,
          description: data.description,
          student_id: user?.id,
          subject_id: data.subject_id,
          unit_number: data.unit_number,
          file_url: fileUrl.publicUrl,
          is_approved: false,
        });
      
      if (insertError) throw insertError;
      
      toast.success("Note uploaded successfully and pending approval");
      navigate('/profile');
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(`Error uploading note: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gradient mb-2">Upload Notes</h1>
            <p className="text-muted-foreground">Share your notes with the community and help other students</p>
          </div>
          
          <div className="relative mb-8">
            <div className="flex items-center justify-between relative z-10">
              {[1, 2, 3].map((stepNumber) => (
                <div 
                  key={stepNumber}
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    step >= stepNumber ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step > stepNumber ? <Check className="h-5 w-5" /> : stepNumber}
                </div>
              ))}
            </div>
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted -z-0">
              <div 
                className="h-full bg-primary transition-all" 
                style={{ width: `${(step - 1) * 50}%` }}
              ></div>
            </div>
          </div>
          
          <Card className="border border-white/10 bg-black/40 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>
                {step === 1 && "Upload Document"}
                {step === 2 && "Document Details"}
                {step === 3 && "Review & Submit"}
              </CardTitle>
              <CardDescription>
                {step === 1 && "Upload a PDF file containing your notes"}
                {step === 2 && "Provide information about your notes"}
                {step === 3 && "Review your submission"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {step === 1 && (
                <div>
                  <div 
                    className={`border-2 border-dashed rounded-lg p-8 text-center ${
                      isDragging ? 'border-primary bg-primary/10' : 'border-muted-foreground/20'
                    } transition-colors`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    {!file ? (
                      <div className="flex flex-col items-center justify-center py-4">
                        <FileUp className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium mb-2">Drag & drop or browse files</p>
                        <p className="text-muted-foreground mb-4">Upload PDF files up to 20MB</p>
                        
                        <input 
                          type="file" 
                          id="file-upload" 
                          accept=".pdf" 
                          className="hidden" 
                          onChange={handleFileChange}
                        />
                        <label htmlFor="file-upload">
                          <Button className="cursor-pointer">
                            <UploadIcon className="h-4 w-4 mr-2" /> Browse Files
                          </Button>
                        </label>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="bg-primary/10 p-4 rounded-lg mb-4 w-full max-w-md">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="bg-primary/20 p-2 rounded mr-3">
                                <FileUp className="h-6 w-6 text-primary" />
                              </div>
                              <div className="text-left">
                                <p className="font-medium truncate">{file.name}</p>
                                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                            </div>
                            <button 
                              className="text-muted-foreground hover:text-destructive transition-colors" 
                              onClick={() => setFile(null)}
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                        
                        <Button onClick={() => setFile(null)}>
                          Change File
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end mt-6">
                    <Button 
                      className="ml-2" 
                      onClick={nextStep}
                      disabled={!file}
                    >
                      Next <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              
              {step === 2 && (
                <div>
                  <Form {...form}>
                    <form className="space-y-4">
                      <FormField
                        name="title"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                              <input 
                                type="text" 
                                placeholder="e.g., Data Structures Complete Notes" 
                                className="w-full px-3 py-2 bg-secondary/20 border border-secondary/30 rounded focus:outline-none focus:ring-2 focus:ring-primary/30"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          name="academic_year"
                          control={form.control}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Academic Year</FormLabel>
                              <FormControl>
                                <select 
                                  className="w-full px-3 py-2 bg-secondary/20 border border-secondary/30 rounded focus:outline-none focus:ring-2 focus:ring-primary/30"
                                  value={field.value}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                >
                                  {[1, 2, 3, 4].map((year) => (
                                    <option key={year} value={year}>
                                      Year {year}
                                    </option>
                                  ))}
                                </select>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          name="semester"
                          control={form.control}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Semester</FormLabel>
                              <FormControl>
                                <select 
                                  className="w-full px-3 py-2 bg-secondary/20 border border-secondary/30 rounded focus:outline-none focus:ring-2 focus:ring-primary/30"
                                  value={field.value}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                >
                                  {[1, 2].map((sem) => (
                                    <option key={sem} value={sem}>
                                      Semester {sem}
                                    </option>
                                  ))}
                                </select>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        name="subject_id"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Subject</FormLabel>
                            <FormControl>
                              <select 
                                className="w-full px-3 py-2 bg-secondary/20 border border-secondary/30 rounded focus:outline-none focus:ring-2 focus:ring-primary/30"
                                {...field}
                              >
                                <option value="">Select Subject</option>
                                {subjects?.map((subject) => (
                                  <option key={subject.id} value={subject.id}>
                                    {subject.name}
                                  </option>
                                ))}
                              </select>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        name="unit_number"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit Number</FormLabel>
                            <FormControl>
                              <select 
                                className="w-full px-3 py-2 bg-secondary/20 border border-secondary/30 rounded focus:outline-none focus:ring-2 focus:ring-primary/30"
                                value={field.value}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                              >
                                {[1, 2, 3, 4, 5].map((unit) => (
                                  <option key={unit} value={unit}>
                                    Unit {unit}
                                  </option>
                                ))}
                              </select>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        name="description"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Provide a brief description of what these notes cover..." 
                                className="bg-secondary/20 border border-secondary/30 focus:ring-primary/30"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Include topics covered, special features, or any other relevant information.
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        name="tags"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tags (comma separated)</FormLabel>
                            <FormControl>
                              <input 
                                type="text" 
                                placeholder="e.g., algorithms, data structures, sorting" 
                                className="w-full px-3 py-2 bg-secondary/20 border border-secondary/30 rounded focus:outline-none focus:ring-2 focus:ring-primary/30"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </form>
                  </Form>
                  
                  <div className="flex justify-between mt-6">
                    <Button variant="outline" onClick={prevStep}>
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <Button 
                      onClick={nextStep}
                      disabled={
                        !form.getValues().title ||
                        !form.getValues().subject_id ||
                        !form.getValues().description
                      }
                    >
                      Next <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              
              {step === 3 && (
                <div>
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <h3 className="font-medium">Document</h3>
                      <div className="bg-black/30 p-3 rounded-md flex items-center">
                        <FileUp className="h-5 w-5 mr-3 text-primary" />
                        <span>{file?.name}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium mb-1">Title</h3>
                        <p className="bg-black/30 p-3 rounded-md">{form.getValues().title}</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h3 className="font-medium mb-1">Academic Year</h3>
                          <p className="bg-black/30 p-3 rounded-md">Year {form.getValues().academic_year}</p>
                        </div>
                        <div>
                          <h3 className="font-medium mb-1">Semester</h3>
                          <p className="bg-black/30 p-3 rounded-md">Semester {form.getValues().semester}</p>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="font-medium mb-1">Subject</h3>
                        <p className="bg-black/30 p-3 rounded-md">
                          {subjects?.find(s => s.id === form.getValues().subject_id)?.name || "Not selected"}
                        </p>
                      </div>
                      
                      <div>
                        <h3 className="font-medium mb-1">Unit</h3>
                        <p className="bg-black/30 p-3 rounded-md">Unit {form.getValues().unit_number}</p>
                      </div>
                      
                      <div>
                        <h3 className="font-medium mb-1">Description</h3>
                        <p className="bg-black/30 p-3 rounded-md">{form.getValues().description}</p>
                      </div>
                      
                      {form.getValues().tags && (
                        <div>
                          <h3 className="font-medium mb-1">Tags</h3>
                          <div className="flex flex-wrap gap-2">
                            {form.getValues().tags.split(',').map((tag, index) => (
                              <span key={index} className="bg-primary/20 text-primary px-2 py-1 rounded text-sm">{tag.trim()}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-between mt-6">
                    <Button variant="outline" onClick={prevStep}>
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <Button 
                      onClick={() => onSubmit(form.getValues())}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin w-4 h-4 mr-2 border-2 border-t-transparent border-white rounded-full" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" /> Submit
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Upload;
