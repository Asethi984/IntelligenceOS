# Auth-Gated App Testing Playbook

## Step 1: Create Test User & Session (mongosh)
```
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
```

## Step 2: Test Backend API
- GET /api/auth/me with Authorization: Bearer {session_token}
- Or use cookie: session_token={session_token}

## Success indicators
- /api/auth/me returns user object
- Dashboard loads without redirect
