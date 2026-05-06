import { useStore } from './src/store/useStore';

async function checkCategories() {
    const store = useStore.getState();
    await store.loadCategories(true);
    const cats = useStore.getState().categoriesData;
    console.log('Categories Count:', cats.length);
    console.log('Sample Category:', JSON.stringify(cats[0], null, 2));
}

// Since we can't run this directly as a script easily with imports, 
// I'll just check the code again.
