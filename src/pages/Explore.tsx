import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Book, BookOpen, Search, Filter, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/auth/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Note = {
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

const Explore = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');

  // Fetch all notes
  const { data: notes, isLoading } = useQuery({
    queryKey: ['allNotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select(`
          *,
          subject:subject_id(
            id, name, branch, academic_year, semester
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Note[];
    }
  });

  // Fetch all subjects for filtering
  const { data: subjects } = useQuery({
    queryKey: ['allSubjects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Get unique branches from subjects
  const uniqueBranches = React.useMemo(() => {
    if (!subjects) return [];
    const branches = [...new Set(subjects.map(subject => subject.branch))];
    return branches;
  }, [subjects]);

  // Filter notes
  const filteredNotes = React.useMemo(() => {
    if (!notes) return [];
    
    return notes.filter(note => {
      // Search query filter
      const matchesSearch = searchQuery 
        ? note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (note.description && note.description.toLowerCase().includes(searchQuery.toLowerCase()))
        : true;
      
      // Subject filter
      const matchesSubject = subjectFilter === 'all' 
        ? true
        : note.subject.id === subjectFilter;
      
      // Branch filter
      const matchesBranch = branchFilter === 'all'
        ? true
        : note.subject.branch === branchFilter;
      
      return matchesSearch && matchesSubject && matchesBranch;
    });
  }, [notes, searchQuery, subjectFilter, branchFilter]);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gradient mb-6">Explore Study Materials</h1>
          
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search notes..."
                className="pl-10 bg-secondary/20 border-secondary/30"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-[160px]">
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    {branchFilter === 'all' ? 'All Branches' : branchFilter}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {uniqueBranches.map(branch => (
                    <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="w-[180px]">
                  <span className="flex items-center gap-2">
                    <Book className="h-4 w-4" />
                    {subjectFilter === 'all' ? 'All Subjects' : subjects?.find(s => s.id === subjectFilter)?.name || 'Subject'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects?.map(subject => (
                    <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
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
        ) : filteredNotes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredNotes.map((note) => (
              <Link 
                to={`/notes/${note.id}`} 
                key={note.id}
                onClick={() => recordView(note.id)}
              >
                <Card className="border border-white/10 bg-black/40 backdrop-blur-sm hover:bg-black/50 transition-all h-full">
                  <CardHeader>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <CardTitle className="text-lg flex items-start gap-2">
                          <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <span>{note.title}</span>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {note.subject.name} • {note.subject.branch} • 
                          Year {note.subject.academic_year} • Semester {note.subject.semester}
                        </CardDescription>
                      </div>
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
            <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium mb-2">No notes found</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              {searchQuery || subjectFilter || branchFilter
                ? "We couldn't find any notes matching your filters. Try adjusting your search criteria."
                : "There are no study materials available yet. Be the first to contribute!"}
            </p>
            {(searchQuery || subjectFilter || branchFilter) && (
              <Button variant="outline" onClick={() => {
                setSearchQuery('');
                setSubjectFilter('all');
                setBranchFilter('all');
              }}>
                Clear Filters
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Explore; 