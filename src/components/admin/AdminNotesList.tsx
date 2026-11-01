
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, ExternalLink } from 'lucide-react';
import { supabase, NoteWithSubject } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AdminNotesList = () => {
  const { data: pendingNotes, isLoading, refetch } = useQuery({
    queryKey: ['pendingNotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select(`
          *,
          student:students(email, full_name, branch, academic_year, semester),
          subject:subjects(name, branch, academic_year, semester)
        `)
        .eq('is_approved', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as NoteWithSubject[];
    }
  });

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ is_approved: true })
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success("Note approved successfully");
      refetch();
    } catch (error: any) {
      toast.error(`Error approving note: ${error.message}`);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success("Note rejected and deleted");
      refetch();
    } catch (error: any) {
      toast.error(`Error rejecting note: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-white/10 bg-black/40 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
          <CardDescription>
            Review and approve notes submitted by students
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : pendingNotes && pendingNotes.length > 0 ? (
            <div className="space-y-4">
              {pendingNotes.map((note) => (
                <div 
                  key={note.id} 
                  className="bg-secondary/10 p-4 rounded-lg border border-secondary/20"
                >
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-medium text-lg">{note.title}</h3>
                      <div className="text-sm text-muted-foreground mt-1">
                        <p>Subject: {note.subject?.name}</p>
                        <p>Unit: {note.unit_number}</p>
                        <p>
                          Submitted by: {note.student?.full_name || note.student?.email || 'Unknown'} 
                          ({note.student?.branch}, Year {note.student?.academic_year}, Semester {note.student?.semester})
                        </p>
                        <p>Submitted on: {new Date(note.created_at).toLocaleDateString()}</p>
                      </div>
                      
                      <div className="mt-2">
                        <p className="text-sm mb-1 font-medium">Description:</p>
                        <p className="text-sm bg-secondary/5 p-2 rounded">
                          {note.description || 'No description provided'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-row md:flex-col justify-end gap-2">
                      <a 
                        href={note.file_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex"
                      >
                        <Button variant="outline" size="sm">
                          <ExternalLink className="h-4 w-4 mr-2" /> View
                        </Button>
                      </a>
                      
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(note.id)}
                      >
                        <Check className="h-4 w-4 mr-2" /> Approve
                      </Button>
                      
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleReject(note.id)}
                      >
                        <X className="h-4 w-4 mr-2" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No pending notes to approve
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminNotesList;
