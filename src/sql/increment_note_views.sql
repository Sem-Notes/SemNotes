-- Function to increment note views
CREATE OR REPLACE FUNCTION increment_note_views(note_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE notes
  SET views = COALESCE(views, 0) + 1
  WHERE id = note_id;
END;
$$; 