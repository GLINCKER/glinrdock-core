-- Fix container_id for existing services
UPDATE services 
SET container_id = 'cac326273fff' 
WHERE id = 1 AND name LIKE '%nginx%';

-- Show the updated record
SELECT id, name, container_id FROM services WHERE id = 1;