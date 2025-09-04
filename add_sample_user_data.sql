-- Add sample users with complete information for testing
INSERT INTO users (
  id,
  name,
  email,
  image,
  bio,
  phoneNumber,
  address,
  created_at,
  updated_at
) VALUES 
(
  'sample-user-1',
  'Rakesh Singh',
  'rakesh.singh@example.com',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  'Software Engineer passionate about mobile app development and React Native',
  '+91-9876543210',
  'Mumbai, Maharashtra, India',
  NOW(),
  NOW()
),
(
  'sample-user-2', 
  'Priya Sharma',
  'priya.sharma@example.com',
  'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150',
  'UI/UX Designer creating beautiful and intuitive user experiences',
  '+91-8765432109',
  'Delhi, India',
  NOW(),
  NOW()
),
(
  'sample-user-3',
  'Amit Kumar',
  'amit.kumar@example.com',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
  'Full Stack Developer | React | Node.js | MongoDB enthusiast',
  '+91-7654321098',
  'Bangalore, Karnataka, India',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  image = EXCLUDED.image,
  bio = EXCLUDED.bio,
  phoneNumber = EXCLUDED.phoneNumber,
  address = EXCLUDED.address,
  updated_at = NOW();

-- Add some follow relationships for testing
INSERT INTO follows (follower_id, following_id, created_at) VALUES
('sample-user-1', 'sample-user-2', NOW()),
('sample-user-1', 'sample-user-3', NOW()),
('sample-user-2', 'sample-user-1', NOW()),
('sample-user-3', 'sample-user-1', NOW()),
('sample-user-3', 'sample-user-2', NOW())
ON CONFLICT (follower_id, following_id) DO NOTHING;

-- Verify the data
SELECT 
  'Users with complete data:' as info,
  COUNT(*) as count
FROM users 
WHERE email IS NOT NULL 
  AND phoneNumber IS NOT NULL 
  AND bio IS NOT NULL;

SELECT 
  'Follow relationships:' as info,
  COUNT(*) as count
FROM follows;
