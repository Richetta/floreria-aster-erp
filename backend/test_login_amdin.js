import fetch from 'node-fetch'; // or use built-in fetch if node >= 18

async function testLoginAmdin() {
  const BACKEND_URL = 'https://mijardin-erp-backend.onrender.com';
  
  console.log('Testing login with admin/amdin...');
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin', password: 'amdin' })
    });
    
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log('Response:', data);
  } catch (err) {
    console.error('Error:', err);
  }
}

testLoginAmdin();
