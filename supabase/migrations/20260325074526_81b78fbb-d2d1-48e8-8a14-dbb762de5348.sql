-- Allow anonymous users to upload to order-form-attachments bucket
CREATE POLICY "Anon can upload order form attachments"
ON storage.objects
AS PERMISSIVE FOR INSERT TO anon
WITH CHECK (bucket_id = 'order-form-attachments');

-- Allow anonymous users to read order form attachments
CREATE POLICY "Anon can read order form attachments"
ON storage.objects
AS PERMISSIVE FOR SELECT TO anon
USING (bucket_id = 'order-form-attachments');