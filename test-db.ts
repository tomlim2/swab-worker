import { createClient } from './src/lib/database/supabase';

// Test our database module types
const client = createClient('test-url', 'test-key');
const table = client.from('test-table');

// These should all be available
console.log(typeof table.like);
console.log(typeof table.delete);
console.log(typeof table.select);
console.log(typeof table.eq);
