import dotenv from 'dotenv';
import path from 'path';
import { app } from 'electron';

// Load environment files in order of precedence
// .env.production (highest priority for production builds)
// .env.local (medium priority for local overrides)
// .env (lowest priority for defaults)

if (process.env.NODE_ENV === 'production') {
  // In packaged app, look for .env.production in the resources directory
  const isPackaged = app.isPackaged;
  const envPath = isPackaged 
    ? path.join(process.resourcesPath, '.env.production')
    : '.env.production';
  
  console.log('[ENV] Loading production environment from:', envPath);
  const result = dotenv.config({ path: envPath });
  
  if (result.error) {
    console.error('[ENV] Failed to load .env.production:', result.error.message);
  } else {
    console.log('[ENV] Successfully loaded production environment variables');
  }
}

dotenv.config({ path: '.env.local' });
dotenv.config();

// Optionally normalize NODE_ENV default
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

// Debug: Log environment variables (remove in production)
console.log('[ENV] Environment variables loaded:');
console.log('[ENV] NODE_ENV:', process.env.NODE_ENV);
console.log('[ENV] OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '***SET***' : 'NOT SET');
console.log('[ENV] OPENAI_BASE_URL:', process.env.OPENAI_BASE_URL || 'NOT SET');
console.log('[ENV] TAVILY_API_KEY:', process.env.TAVILY_API_KEY ? '***SET***' : 'NOT SET');


