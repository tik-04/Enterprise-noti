// db/migrate.ts
import dataSource from "./data-source"

async function runMigrations() {
  try {
    await dataSource.initialize(); 
    await dataSource.runMigrations();
    console.log('✅ Migrations completed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigrations();