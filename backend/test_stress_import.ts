import axios from 'axios';

const baseUrl = 'http://localhost:3000/api'; // O la URL de tu backend local

async function stressTest() {
    try {
        console.log('--- STRESS TEST: BULK IMPORT ---');
        
        // 1. Login
        console.log('Logging in...');
        const loginRes = await axios.post(`${baseUrl}/auth/login`, {
            email: 'admin',
            password: 'admin'
        });
        const token = loginRes.data.token;
        console.log('Login OK.');

        // 2. Generate 500 products
        console.log('Generating 500 test products...');
        const products = Array.from({ length: 500 }, (_, i) => ({
            code: `STRESS-${Date.now()}-${i}`,
            name: `Stress Test Product ${i}`,
            cost: Math.floor(Math.random() * 1000),
            price: Math.floor(Math.random() * 2000) + 1000,
            stock: Math.floor(Math.random() * 100)
        }));

        // 3. Send Bulk Import
        console.log(`Sending bulk import of ${products.length} items...`);
        const startTime = Date.now();
        
        const response = await axios.post(`${baseUrl}/import-data/bulk-import`, {
            data: products,
            update_costs: true,
            update_prices: true,
            update_stock: true,
            auto_margin: false
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const duration = Date.now() - startTime;
        console.log('--- RESULT ---');
        console.log(`Status: ${response.status}`);
        console.log(`Time taken: ${duration}ms`);
        console.log(`Created: ${response.data.created}`);
        console.log(`Updated: ${response.data.updated}`);
        console.log(`Errors: ${response.data.errors.length}`);
        
        if (duration < 5000) {
            console.log('✅ Performance is GOOD (under 5s for 500 items)');
        } else {
            console.warn('⚠️ Performance is slow (over 5s)');
        }

    } catch (error: any) {
        console.error('Test failed:', error.response?.data || error.message);
    }
}

stressTest();
