import fetch from 'node-fetch'; 

async function testNotifications() {
  const BACKEND_URL = 'https://mijardin-erp-backend.onrender.com';
  
  const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin', password: 'admin' })
  });
  const { token } = await loginRes.json();
  
  const res = await fetch(`${BACKEND_URL}/api/notifications`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(`Status: ${res.status}`);
}

testNotifications();
