import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, ChevronLeft, Calendar, BookOpen, Star, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/auth/AuthContext';

type NoteWithSubject = {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  views: number | null;
  downloads: number | null;
  average_rating: number | null;
  created_at: string | null;
  subject: {
    id: string;
    name: string;
    branch: string;
    academic_year: number;
    semester: number;
  };
};

const NoteDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  // Fetch note details with subject
  const { data: note, isLoading } = useQuery({
    queryKey: ['note', id],
    queryFn: async () => {
      if (!id) throw new Error('Note ID is required');
      
      const { data, error } = await supabase
        .from('notes')
        .select(`
          *,
          subject:subject_id(
            id, name, branch, academic_year, semester
          )
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as NoteWithSubject;
    },
    enabled: !!id
  });

  // Record view on page load
  useEffect(() => {
    const recordView = async () => {
      if (!user || !id) return;
      
      try {
        // Add to history
        await supabase
          .from('history')
          .insert({
            note_id: id,
            user_id: user.id,
            viewed_at: new Date().toISOString()
          });
          
        // Increment views counter
        await supabase.rpc('increment_note_views', { note_id: id });
      } catch (error) {
        console.error('Error recording view:', error);
      }
    };
    
    recordView();
  }, [id, user]);

  // Function to handle file download
  const handleDownload = async () => {
    if (!note || !user) return;
    
    try {
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = note.file_url;
      
      // Set suggested filename from the URL or use default
      const filename = note.file_url.split('/').pop() || `${note.title}.pdf`;
      link.setAttribute('download', filename);
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Track download
      await supabase.rpc('increment_note_downloads', { note_id: note.id });
      
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        {note && (
          <Link to={`/subjects/${note.subject.id}`} className="inline-flex items-center text-muted-foreground hover:text-white mb-6">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to {note.subject.name}
          </Link>
        )}

        {isLoading ? (
          <div className="mb-8">
            <Skeleton className="h-10 w-2/3 mb-4" />
            <Skeleton className="h-5 w-1/2 mb-2" />
            <Skeleton className="h-5 w-1/3 mb-8" />
            <Skeleton className="h-64 w-full mb-4" />
          </div>
        ) : note ? (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gradient mb-2 flex items-center gap-3">
                <FileText className="h-8 w-8" />
                {note.title}
              </h1>
              <div className="flex flex-wrap gap-4 text-muted-foreground mb-4">
                <div className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  <Link to={`/subjects/${note.subject.id}`} className="hover:text-white">
                    {note.subject.name}
                  </Link>
                  <span>•</span>
                  <span>{note.subject.branch}</span>
                  <span>•</span>
                  <span>Year {note.subject.academic_year}</span>
                  <span>•</span>
                  <span>Semester {note.subject.semester}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(note.created_at)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  <span>{note.views || 0} views</span>
                </div>
                {note.average_rating && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-400" />
                    <span>{note.average_rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-4">
                <Button onClick={handleDownload} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>

            <Card className="border border-white/10 bg-black/40 backdrop-blur-sm mb-8">
              <CardContent className="pt-6">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold mb-2">Description</h2>
                  <p className="text-gray-300 whitespace-pre-line">
                    {note.description || "No description provided for this study material."}
                  </p>
                </div>
                
                <div className="border-t border-white/10 pt-6">
                  <h2 className="text-xl font-semibold mb-4">Preview</h2>
                  
                  {/* PDF Preview or fallback */}
                  {note.file_url.endsWith('.pdf') ? (
                    <div className="w-full h-[500px] rounded-lg border border-white/20 overflow-hidden">
                      <iframe
                        src={note.file_url}
                        className="w-full h-full"
                        title={note.title}
                      ></iframe>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center border border-white/20 rounded-lg">
                      <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                      <h3 className="text-xl font-medium mb-2">View File</h3>
                      <p className="text-muted-foreground mb-6 max-w-md">
                        This file type can't be previewed directly in the browser.
                      </p>
                      <a href={note.file_url} target="_blank" rel="noopener noreferrer">
                        <Button>
                          View File Externally
                        </Button>
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="text-center py-16">
            <h1 className="text-3xl font-bold text-gradient mb-4">Study Material Not Found</h1>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              The study material you're looking for doesn't exist or has been removed.
            </p>
            <Link to="/explore">
              <Button>
                Browse All Materials
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

export default NoteDetail; 