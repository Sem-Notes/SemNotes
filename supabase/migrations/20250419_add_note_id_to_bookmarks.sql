-- Add note_id column to bookmarks table
ALTER TABLE IF EXISTS public.bookmarks 
ADD COLUMN IF NOT EXISTS note_id UUID REFERENCES public.notes(id);

-- Create index on note_id for better performance
CREATE INDEX IF NOT EXISTS bookmarks_note_id_idx ON public.bookmarks(note_id);

-- Add foreign key relationship if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' 
        AND table_name = 'bookmarks' 
        AND constraint_name = 'bookmarks_note_id_fkey'
    ) THEN
        ALTER TABLE public.bookmarks 
        ADD CONSTRAINT bookmarks_note_id_fkey 
        FOREIGN KEY (note_id) 
        REFERENCES public.notes(id) ON DELETE CASCADE;
    END IF;
END
$$; 