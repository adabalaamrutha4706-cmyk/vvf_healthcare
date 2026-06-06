import { seedDatabase } from './config/seed';

const run = async () => {
  console.log('Running database seed and migrations...');
  await seedDatabase();
  console.log('Seed completed successfully!');
  process.exit(0);
};

run().catch(err => {
  console.error('Seed runner failed:', err);
  process.exit(1);
});
