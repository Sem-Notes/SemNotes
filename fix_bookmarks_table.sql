-- This script addresses issues with the bookmarks table
-- It ensures either note_id or subject_id exists for storing references

-- First, check if bookmarks table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bookmarks') THEN
        -- Create the bookmarks table if it doesn't exist
        CREATE TABLE public.bookmarks (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END
$$;

-- Add note_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'bookmarks'
        AND column_name = 'note_id'
    ) THEN
        ALTER TABLE public.bookmarks ADD COLUMN note_id UUID REFERENCES notes(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added note_id column to bookmarks table';
    ELSE
        RAISE NOTICE 'note_id column already exists';
    END IF;
END $$;

-- Add subject_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'bookmarks'
        AND column_name = 'subject_id'
    ) THEN
        ALTER TABLE public.bookmarks ADD COLUMN subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added subject_id column to bookmarks table';
    ELSE
        RAISE NOTICE 'subject_id column already exists';
    END IF;
END $$;

-- Create indexes for performance
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND c.relname = 'bookmarks_user_id_idx'
        AND c.relkind = 'i'
    ) THEN
        CREATE INDEX bookmarks_user_id_idx ON public.bookmarks(user_id);
        RAISE NOTICE 'Created index on user_id column';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND c.relname = 'bookmarks_note_id_idx'
        AND c.relkind = 'i'
    ) THEN
        CREATE INDEX bookmarks_note_id_idx ON public.bookmarks(note_id);
        RAISE NOTICE 'Created index on note_id column';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND c.relname = 'bookmarks_subject_id_idx'
        AND c.relkind = 'i'
    ) THEN
        CREATE INDEX bookmarks_subject_id_idx ON public.bookmarks(subject_id);
        RAISE NOTICE 'Created index on subject_id column';
    END IF;
END $$;

-- Update existing bookmarks if needed
DO $$
BEGIN
    -- If note_id exists but subject_id doesn't, copy note_id to subject_id
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'bookmarks' 
        AND column_name = 'note_id'
    ) AND EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'bookmarks' 
        AND column_name = 'subject_id'
    ) THEN
        UPDATE public.bookmarks 
        SET subject_id = note_id 
        WHERE subject_id IS NULL AND note_id IS NOT NULL;
        
        RAISE NOTICE 'Updated missing subject_id values from note_id';
    END IF;

    -- If subject_id exists but note_id doesn't, copy subject_id to note_id
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'bookmarks' 
        AND column_name = 'subject_id'
    ) AND EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'bookmarks' 
        AND column_name = 'note_id'
    ) THEN
        UPDATE public.bookmarks 
        SET note_id = subject_id 
        WHERE note_id IS NULL AND subject_id IS NOT NULL;
        
        RAISE NOTICE 'Updated missing note_id values from subject_id';
    END IF;
END $$;

-- Verify the structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'bookmarks'
ORDER BY ordinal_position; 