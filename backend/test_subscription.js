import fetch from 'node-fetch'; // or use built-in fetch if node >= 18

async function testSubscription() {
  const BACKEND_URL = 'https://mijardin-erp-backend.onrender.com';
  
  // 1. Get token
  const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin', password: 'admin' })
  });
  const { token } = await loginRes.json();
  
  if (!token) {
    console.log('Login failed');
    return;
  }
  
  // 2. Test /subscription/current
  console.log('Testing /api/subscription/current...');
  try {
    const res = await fetch(`${BACKEND_URL}/api/subscription/current`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`Status: ${res.status}`);
    const data = await res.text();
    console.log('Response:', data);
  } catch (err) {
    console.error('Error:', err);
  }
}

testSubscription();
