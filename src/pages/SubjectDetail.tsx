import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Book, Star, FileText, BookOpen, ChevronLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/auth/AuthContext';

type Subject = {
  id: string;
  name: string;
  branch: string;
  academic_year: number;
  semester: number;
  is_common: boolean;
  created_at: string;
};

type Note = {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  views: number | null;
  downloads: number | null;
  average_rating: number | null;
  created_at: string | null;
};

const SubjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  // Fetch subject details
  const { data: subject, isLoading: subjectLoading } = useQuery({
    queryKey: ['subject', id],
    queryFn: async () => {
      if (!id) throw new Error('Subject ID is required');
      
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Subject;
    },
    enabled: !!id
  });

  // Fetch notes for this subject
  const { data: notes, isLoading: notesLoading } = useQuery({
    queryKey: ['subjectNotes', id],
    queryFn: async () => {
      if (!id) throw new Error('Subject ID is required');
      
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('subject_id', id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Note[];
    },
    enabled: !!id
  });

  // Record view when clicking on a note
  const recordView = async (noteId: string) => {
    if (!user) return;
    
    try {
      // Add to history
      await supabase
        .from('history')
        .insert({
          note_id: noteId,
          user_id: user.id,
          viewed_at: new Date().toISOString()
        });
        
      // Increment views counter
      await supabase.rpc('increment_note_views', { note_id: noteId });
    } catch (error) {
      console.error('Error recording view:', error);
    }
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isLoading = subjectLoading || notesLoading;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        <Link to="/home" className="inline-flex items-center text-muted-foreground hover:text-white mb-6">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Subjects
        </Link>

        {subjectLoading ? (
          <div className="mb-8">
            <Skeleton className="h-10 w-2/3 mb-4" />
            <Skeleton className="h-5 w-1/2 mb-2" />
            <Skeleton className="h-5 w-1/3" />
          </div>
        ) : subject ? (
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gradient mb-2 flex items-center gap-3">
              <Book className="h-8 w-8" />
              {subject.name}
            </h1>
            <p className="text-xl text-muted-foreground mb-1">
              {subject.branch} • Year {subject.academic_year} • Semester {subject.semester}
            </p>
            <p className="text-muted-foreground">
              {subject.is_common ? 'Common subject for all branches' : `Specific to ${subject.branch} branch`}
            </p>
          </div>
        ) : (
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gradient mb-2">Subject Not Found</h1>
            <p className="text-muted-foreground">
              The subject you're looking for doesn't exist or has been removed.
            </p>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Study Materials</h2>
          <Link to="/upload">
            <Button size="sm">
              Upload New Material
            </Button>
          </Link>
        </div>

        {notesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border border-white/10 bg-black/40 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-4/5" />
                </CardContent>
                <CardFooter className="border-t border-white/5 pt-4">
                  <Skeleton className="h-9 w-32" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : notes && notes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {notes.map((note) => (
              <Link 
                to={`/notes/${note.id}`} 
                key={note.id}
                onClick={() => recordView(note.id)}
              >
                <Card className="border border-white/10 bg-black/40 backdrop-blur-sm hover:bg-black/50 transition-all h-full">
                  <CardHeader>
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-lg flex items-start gap-2">
                        <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span>{note.title}</span>
                      </CardTitle>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <span>{formatDate(note.created_at)}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-300 line-clamp-2">
                      {note.description || "No description provided"}
                    </p>
                    <div className="flex gap-6 mt-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4" />
                        <span>{note.views || 0} views</span>
                      </div>
                      {note.average_rating && (
                        <div className="flex items-center gap-1">
                          <span className="text-yellow-400">★</span>
                          <span>{note.average_rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-white/5 pt-4">
                    <Button variant="outline" size="sm" className="w-full">
                      View Study Material
                    </Button>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium mb-2">No study materials yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              There are no study materials available for this subject yet. Be the first to contribute!
            </p>
            <Link to="/upload">
              <Button>
                Upload Material
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

export default SubjectDetail; 