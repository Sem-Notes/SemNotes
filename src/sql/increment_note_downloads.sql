-- Function to increment note downloads
CREATE OR REPLACE FUNCTION increment_note_downloads(note_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE notes
  SET downloads = COALESCE(downloads, 0) + 1
  WHERE id = note_id;
END;
$$; 