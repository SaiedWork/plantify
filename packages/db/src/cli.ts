import { createDb } from './client.js';
import { resetDatabase } from './reset.js';
import { seed } from './seed/seed.js';

const command = process.argv[2];
const { db, close } = createDb();

try {
  if (command === 'seed') {
    console.log('seeded', await seed(db));
  } else if (command === 'reset') {
    console.log('reset + seeded', await resetDatabase(db));
  } else {
    throw new Error(`unknown command "${command}" (expected seed | reset)`);
  }
} finally {
  await close();
}
