import { api } from './src/services/api';

async function testHierarchy() {
    try {
        const categories = await api.getCategories(true);
        console.log('Categories Hierarchy:', JSON.stringify(categories, null, 2));
    } catch (error) {
        console.error('Error fetching hierarchy:', error);
    }
}

// simulate environment if needed or just run it via ts-node if available
// For now, I'll just assume the API works as updated in prev turns.
