const url = 'https://aster-backend-production.up.railway.app/api/auth/login';

async function testLogin() {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin' })
        });
        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Body:', JSON.stringify(data, null, 2));
    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

testLogin();
