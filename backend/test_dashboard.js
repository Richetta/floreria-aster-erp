import fetch from 'node-fetch'; 

async function testDashboardLoad() {
  const BACKEND_URL = 'https://mijardin-erp-backend.onrender.com';
  
  // 1. Get token
  console.log('Logging in...');
  const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin', password: 'admin' })
  });
  
  if (!loginRes.ok) {
    console.error(`Login failed: ${loginRes.status}`);
    console.error(await loginRes.text());
    return;
  }
  
  const { token } = await loginRes.json();
  console.log('Token acquired. Testing dashboard endpoints...');
  
  const endpoints = [
    '/api/auth/me',
    '/api/subscription/current',
    '/api/subscription/usage',
    '/api/activity',
    '/api/orders?status=pending',
    '/api/stock/low-stock',
    '/api/inventory/restock',
    '/api/stock/summary'
  ];
  
  for (const ep of endpoints) {
    try {
      const res = await fetch(`${BACKEND_URL}${ep}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log(`[${res.status}] ${ep}`);
      if (!res.ok) {
        console.error(`Error response for ${ep}:`, await res.text());
      }
    } catch (err) {
      console.error(`Fetch error for ${ep}:`, err);
    }
  }
}

testDashboardLoad();
