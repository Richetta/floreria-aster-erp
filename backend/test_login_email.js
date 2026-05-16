import fetch from 'node-fetch';

async function testLoginAmdin() {
  const BACKEND_URL = 'https://mijardin-erp-backend.onrender.com';
  
  console.log('Testing login with stackcontacto@gmail.com/amdin...');
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'stackcontacto@gmail.com', password: 'amdin' })
    });
    
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log('Response:', data);
  } catch (err) {
    console.error('Error:', err);
  }
}

testLoginAmdin();
