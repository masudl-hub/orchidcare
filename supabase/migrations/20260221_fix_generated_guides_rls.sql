-- Add missing SELECT policy for generated-guides bucket.
-- Without this, authenticated clients cannot call createSignedUrl() on objects
-- in this bucket (Supabase requires SELECT permission to generate a signed URL),
-- causing all visual-guide images to silently disappear on page reload.

CREATE POLICY "Authenticated users can read generated guides"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'generated-guides');
