import dotenv from 'dotenv';

// Load .env.local first (if present), then .env. Later calls won't overwrite set vars.
dotenv.config({ path: '.env.local' });
dotenv.config();

// Optionally normalize NODE_ENV default
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}


