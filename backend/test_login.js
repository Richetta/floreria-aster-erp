import fetch from 'node-fetch'; // or use built-in fetch if node >= 18

async function testLogin() {
  const BACKEND_URL = 'https://mijardin-erp-backend.onrender.com';
  
  console.log('Testing login with admin/admin...');
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin', password: 'admin' })
    });
    
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log('Response:', data);
    
    if (data.token) {
      console.log('Token received! Testing /api/auth/me...');
      const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${data.token}` }
      });
      console.log(`/me Status: ${meRes.status}`);
      const meData = await meRes.text();
      console.log('/me Response:', meData);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

testLogin();
