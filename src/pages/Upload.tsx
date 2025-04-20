import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, FileUp, Check, X, Upload as UploadIcon } from 'lucide-react';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthContext';
import { toast } from 'sonner';

// Define validation schema
const noteFormSchema = z.object({
  title: z.string().min(3, "Title is required and must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  branch: z.string().min(1, "Branch is required"),
  semester: z.string().min(1, "Semester is required"),
  subject: z.string().min(1, "Subject is required"),
  academic_year: z.string().min(1, "Academic year is required"),
  unit_number: z.string().min(1, "Unit number is required"),
});

type NoteFormValues = z.infer<typeof noteFormSchema>;

const Upload = () => {
  const [step, setStep] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      title: "",
      description: "",
      branch: "",
      semester: "",
      subject: "",
      academic_year: "",
      unit_number: "1", // Default to unit 1
    }
  });

  const validateFile = (selectedFile: File | null): boolean => {
    setFileError(null);
    
    if (!selectedFile) {
      setFileError("Please select a file");
      return false;
    }
    
    // Check file type
    if (selectedFile.type !== 'application/pdf') {
      setFileError("Only PDF files are accepted");
      return false;
    }
    
    // Check file size (20MB max)
    if (selectedFile.size > 20 * 1024 * 1024) {
      setFileError("File size must be less than 20MB");
      return false;
    }
    
    return true;
  };

  const handleFileSelect = (selectedFile: File) => {
    if (validateFile(selectedFile)) {
      setFile(selectedFile);
    }
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
      handleFileSelect(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const nextStep = () => {
    if (step === 1 && !file) {
      setFileError("Please select a file before proceeding");
      return;
    }
    setStep(step + 1);
  };
  
  const prevStep = () => setStep(step - 1);

  const onSubmit = async (values: NoteFormValues) => {
    if (!file || !user) return;
    
    setIsSubmitting(true);
    
    try {
      // 1. Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `notes/${user.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('notes')
        .upload(filePath, file);
        
      if (uploadError) throw uploadError;
      
      // Get the URL for the uploaded file
      const { data: fileData } = supabase.storage
        .from('notes')
        .getPublicUrl(filePath);
        
      if (!fileData) throw new Error("Failed to get file URL");
      
      // 2. Find or create subject
      const { data: subjectData, error: subjectError } = await supabase
        .from('subjects')
        .select('id')
        .eq('name', values.subject)
        .eq('branch', values.branch)
        .eq('semester', parseInt(values.semester))
        .eq('academic_year', parseInt(values.academic_year))
        .single();
        
      let subjectId = subjectData?.id;
      
      if (subjectError || !subjectId) {
        // Create a new subject
        const { data: newSubject, error: createSubjectError } = await supabase
          .from('subjects')
          .insert({
            name: values.subject,
            branch: values.branch,
            semester: parseInt(values.semester),
            academic_year: parseInt(values.academic_year)
          })
          .select('id')
          .single();
          
        if (createSubjectError || !newSubject) throw createSubjectError;
        
        subjectId = newSubject.id;
      }
      
      // 3. Create note with approval status
      const { error: noteError } = await supabase
        .from('notes')
        .insert({
          title: values.title,
          description: values.description,
          file_url: fileData.publicUrl,
          subject_id: subjectId,
          student_id: user.id,
          unit_number: parseInt(values.unit_number),
          approval_status: 'pending'
        });
        
      if (noteError) throw noteError;
      
      // Success!
      toast.success("Note submitted for approval!");
      navigate('/home');
      
    } catch (error: any) {
      console.error("Error uploading note:", error);
      toast.error(`Failed to upload note: ${error.message}`);
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
                {step === 3 && "Review your submission and submit for approval"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {step === 1 && (
                <div>
                  <div 
                    className={`border-2 border-dashed rounded-lg p-8 text-center ${
                      isDragging ? 'border-primary bg-primary/10' : fileError ? 'border-red-500 bg-red-500/5' : 'border-muted-foreground/20'
                    } transition-colors cursor-pointer`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    {!file ? (
                      <div className="flex flex-col items-center justify-center py-4">
                        <FileUp className={`h-12 w-12 mb-4 ${fileError ? 'text-red-500' : 'text-muted-foreground'}`} />
                        <p className="text-lg font-medium mb-2">Click or drag & drop to upload</p>
                        <p className="text-muted-foreground mb-4">Upload PDF files up to 20MB</p>
                        
                        <input 
                          type="file" 
                          id="file-upload" 
                          accept=".pdf" 
                          className="hidden" 
                          onChange={handleFileChange}
                        />
                        <Button className="cursor-pointer">
                          <UploadIcon className="h-4 w-4 mr-2" /> Browse Files
                        </Button>
                        
                        {fileError && (
                          <p className="mt-3 text-sm text-red-500">{fileError}</p>
                        )}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                setFile(null);
                              }}
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                        
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                            document.getElementById('file-upload')?.click();
                          }}
                        >
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
                          name="branch"
                          control={form.control}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Branch/Department</FormLabel>
                              <FormControl>
                                <select 
                                  className="w-full px-3 py-2 bg-secondary/20 border border-secondary/30 rounded focus:outline-none focus:ring-2 focus:ring-primary/30"
                                  {...field}
                                >
                                  <option value="">Select Branch</option>
                                  <option value="CSE">Computer Science</option>
                                  <option value="ECE">Electronics Engineering</option>
                                  <option value="ME">Mechanical Engineering</option>
                                  <option value="CE">Civil Engineering</option>
                                  <option value="IT">Information Technology</option>
                                  <option value="EE">Electrical Engineering</option>
                                </select>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          name="academic_year"
                          control={form.control}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Academic Year</FormLabel>
                              <FormControl>
                                <select 
                                  className="w-full px-3 py-2 bg-secondary/20 border border-secondary/30 rounded focus:outline-none focus:ring-2 focus:ring-primary/30"
                                  {...field}
                                >
                                  <option value="">Select Year</option>
                                  <option value="1">First Year</option>
                                  <option value="2">Second Year</option>
                                  <option value="3">Third Year</option>
                                  <option value="4">Fourth Year</option>
                                </select>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          name="semester"
                          control={form.control}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Semester</FormLabel>
                              <FormControl>
                                <select 
                                  className="w-full px-3 py-2 bg-secondary/20 border border-secondary/30 rounded focus:outline-none focus:ring-2 focus:ring-primary/30"
                                  {...field}
                                >
                                  <option value="">Select Semester</option>
                                  <option value="1">Semester 1</option>
                                  <option value="2">Semester 2</option>
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
                                  {...field}
                                >
                                  <option value="1">Unit 1</option>
                                  <option value="2">Unit 2</option>
                                  <option value="3">Unit 3</option>
                                  <option value="4">Unit 4</option>
                                  <option value="5">Unit 5</option>
                                  <option value="6">Unit 6</option>
                                </select>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        name="subject"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Subject</FormLabel>
                            <FormControl>
                              <input 
                                type="text" 
                                placeholder="e.g., Data Structures & Algorithms" 
                                className="w-full px-3 py-2 bg-secondary/20 border border-secondary/30 rounded focus:outline-none focus:ring-2 focus:ring-primary/30"
                                {...field}
                              />
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
                                placeholder="Add a description for your notes..." 
                                className="bg-secondary/20 border-secondary/30 min-h-[120px]"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Provide a brief description of what your notes cover.
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                    </form>
                  </Form>
                  
                  <div className="flex justify-between mt-6">
                    <Button 
                      variant="outline" 
                      onClick={prevStep}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <Button 
                      onClick={nextStep}
                      disabled={!form.formState.isValid}
                    >
                      Next <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              
              {step === 3 && (
                <div>
                  <div className="space-y-4">
                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                      <h3 className="text-lg font-medium mb-4">Review Information</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Title:</p>
                          <p className="font-medium">{form.getValues('title')}</p>
                        </div>
                    
                        <div>
                          <p className="text-muted-foreground">Subject:</p>
                          <p className="font-medium">{form.getValues('subject')}</p>
                        </div>
                      
                        <div>
                          <p className="text-muted-foreground">Branch:</p>
                          <p className="font-medium">{form.getValues('branch')}</p>
                        </div>
                        
                        <div>
                          <p className="text-muted-foreground">Year:</p>
                          <p className="font-medium">Year {form.getValues('academic_year')}</p>
                        </div>
                        
                        <div>
                          <p className="text-muted-foreground">Semester:</p>
                          <p className="font-medium">Semester {form.getValues('semester')}</p>
                        </div>
                      
                        <div>
                          <p className="text-muted-foreground">Unit:</p>
                          <p className="font-medium">Unit {form.getValues('unit_number')}</p>
                        </div>
                        
                        <div className="col-span-2">
                          <p className="text-muted-foreground">File:</p>
                          <p className="font-medium truncate">{file?.name}</p>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <p className="text-muted-foreground">Description:</p>
                        <p className="text-sm">{form.getValues('description')}</p>
                      </div>
                    </div>
                      
                    <div className="bg-yellow-500/10 p-4 rounded-lg border border-yellow-500/20 mt-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-yellow-500/20 p-2 rounded-full">
                          <Check className="h-5 w-5 text-yellow-500" />
                        </div>
                        <div>
                          <h4 className="font-medium text-yellow-500">Awaiting Approval</h4>
                          <p className="text-sm mt-1">Your notes will be reviewed by an admin before being published.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between mt-6">
                    <Button 
                      variant="outline" 
                      onClick={prevStep}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <Button 
                      onClick={form.handleSubmit(onSubmit)}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>Uploading...</>
                      ) : (
                        <>Submit for Approval <Check className="ml-2 h-4 w-4" /></>
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
