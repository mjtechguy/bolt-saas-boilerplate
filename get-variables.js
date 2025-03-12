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
  }
});

// Get the current date and time for unique filenames
const now = new Date();
const currentDate = now.toISOString().split('T')[0].replace(/-/g, '');
const currentTime = now.toTimeString().split(' ')[0].replace(/:/g, '');
const migrationFileName = `${currentDate}_${currentTime}_bolt_saas_seed.sql`;

// Read the SQL template file
const sqlTemplatePath = `${__dirname}/supabase/seed.sql`;
if (!fs.existsSync(sqlTemplatePath)) {
  console.error(`❌ Error: Seed SQL file not found at ${sqlTemplatePath}`);
  process.exit(1);
}
let sqlContent = fs.readFileSync(sqlTemplatePath, 'utf8');

// Dynamically replace all placeholders in {{VARIABLE_NAME}} format
sqlContent = sqlContent.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
  const value = process.env[varName];
  if (!value) {
    console.warn(`⚠️ Warning: Environment variable ${varName} is not set.`);
  }
  return value || ''; // Replace with empty string if variable is missing
});

// Write the updated SQL content to a new migration file
fs.writeFileSync(`${migrationsDir}/${migrationFileName}`, sqlContent);

console.log(`✅ Migration file created: ${migrationFileName}`);
