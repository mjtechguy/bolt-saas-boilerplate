import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables from .env file
dotenv.config();

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
console.log(__filename,'file',__dirname)


// Read the SQL template file
const sqlTemplate = fs.readFileSync(`${__dirname}/supabase/migrations/seed.sql`, 'utf8');

// Replace placeholders with environment variables
const sqlContent = sqlTemplate
  .replace('{{VITE_DEFAULT_ADMIN_EMAIL}}', process.env.VITE_DEFAULT_ADMIN_EMAIL)
  .replace('{{VITE_DEFAULT_ADMIN_PASSWORD}}', process.env.VITE_DEFAULT_ADMIN_PASSWORD);

// Write the updated SQL content to a new file
fs.writeFileSync(`${__dirname}/migrations.sql`, sqlContent);

console.log('SQL file "output.sql" has been generated with environment variables.');