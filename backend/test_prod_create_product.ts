const baseUrl = 'https://aster-backend-production.up.railway.app/api';

async function testProductCreation() {
    try {
        // 1. Login to get token
        const loginRes = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin', password: 'admin' })
        });
        const loginData = await loginRes.json();
        console.log('Login Result:', JSON.stringify(loginData, null, 2));
        const token = loginData.token;

        // 2. Try to create product
        const createRes = await fetch(`${baseUrl}/products`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                code: 'TEST-' + Date.now(),
                name: 'Producto de Prueba',
                cost: 100,
                price: 150,
                min_stock: 5,
                tags: ['test']
            })
        });
        const createData = await createRes.json();
        console.log('Create Status:', createRes.status);
        console.log('Create Body:', JSON.stringify(createData, null, 2));
    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

testProductCreation();
