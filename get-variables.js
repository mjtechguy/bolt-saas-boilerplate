import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables from .env file
dotenv.config();

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the migrations directory
const migrationsDir = `${__dirname}/supabase/migrations`;

// Delete existing migration files
fs.readdirSync(migrationsDir).forEach(file => {
  if (file.endsWith('_bolt_saas_seed.sql')) {
    fs.unlinkSync(`${migrationsDir}/${file}`);
    console.log(`Deleted existing migration file: ${file}`);
  }
});

// Get the current date in YYYYMMDD format
const now = new Date();
const currentDate = now.toISOString().split('T')[0].replace(/-/g, '');
const currentTime = now.toTimeString().split(' ')[0].replace(/:/g, '');
const migrationFileName = `${currentDate}_${currentTime}_bolt_saas_seed.sql`;

// Read the SQL template file
const sqlTemplate = fs.readFileSync(`${__dirname}/supabase/seed.sql`, 'utf8');

// Replace placeholders with environment variables
const sqlContent = sqlTemplate
  .replace('{{VITE_DEFAULT_ADMIN_EMAIL}}', process.env.VITE_DEFAULT_ADMIN_EMAIL)
  .replace('{{VITE_DEFAULT_ADMIN_PASSWORD}}', process.env.VITE_DEFAULT_ADMIN_PASSWORD);

// Write the updated SQL content to a new migration file
fs.writeFileSync(`${migrationsDir}/${migrationFileName}`, sqlContent);

console.log(`Migration file created: ${migrationFileName}`);
