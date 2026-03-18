const baseUrl = 'https://aster-backend-production.up.railway.app/api';

async function testCreateProduct() {
    try {
        console.log('Logging in...');
        const loginRes = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin' })
        });
        const loginData = await loginRes.json();
        if (loginRes.status !== 200) {
            console.error('Login failed:', loginData);
            return;
        }
        const token = loginData.token;
        console.log('Login successful, token acquired.');

        console.log('Creating product...');
        const createRes = await fetch(`${baseUrl}/products`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                code: 'PROD-' + Date.now(),
                name: 'Test Product ' + new Date().toISOString(),
                cost: 10.5,
                price: 25.0,
                min_stock: 5,
                tags: ['test', 'automated']
            })
        });
        
        const createData = await createRes.json();
        console.log('Status:', createRes.status);
        console.log('Body:', JSON.stringify(createData, null, 2));

    } catch (error: any) {
        console.error('Error during test:', error.message);
    }
}

testCreateProduct();
