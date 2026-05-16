import fetch from 'node-fetch'; 

async function testProducts() {
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
  
  // 2. Test /api/products
  console.log('Testing /api/products...');
  try {
    const res = await fetch(`${BACKEND_URL}/api/products`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`Status: ${res.status}`);
    const data = await res.text();
    console.log('Response length:', data.length);
  } catch (err) {
    console.error('Error:', err);
  }
}

testProducts();
