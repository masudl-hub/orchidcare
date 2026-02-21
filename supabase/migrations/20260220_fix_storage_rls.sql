-- Fix storage policies to ensure authenticated users can read plant photos

-- Drop existing policies if they exist (to recreate them cleanly)
DROP POLICY IF EXISTS "Give users authenticated access to folder 1qazxsw" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1qazxsw" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read plant photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload plant photos to their own folder" ON storage.objects;

-- Note: In Supabase, generating a signed URL requires SELECT permissions on the object.
-- Create policy to allow authenticated users to SELECT (read) any object in plant-photos
CREATE POLICY "Authenticated users can read plant photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'plant-photos');

-- Create policy to allow authenticated users to INSERT objects into their own folder
CREATE POLICY "Users can upload plant photos to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'plant-photos' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.profiles WHERE user_id = auth.uid()
  )
);
