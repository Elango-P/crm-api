import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  ADMIN_API_KEY: z.string().min(16, 'ADMIN_API_KEY must be at least 16 characters for security').default('dev-admin-insecure-api-key-for-local-testing-only'),

  // Firebase
  FIREBASE_DATABASE_TYPE: z.enum(['firestore', 'realtime']).default('firestore'),
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required').default('my-portfolio-e1326'),
  GOOGLE_APPLICATION_CREDENTIALS: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().optional()
  ),
  FIREBASE_CLIENT_EMAIL: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() || undefined : val),
    z.string().email().optional()
  ),
  FIREBASE_PRIVATE_KEY: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() || undefined : val),
    z.string().optional()
  ),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().optional()
  ),
  FIREBASE_DATABASE_URL: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().url().optional()
  ),
  TENANT_ID: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().optional()
  ),

  // Zoho
  ZOHO_PRODUCT: z.enum(['zoho_books', 'zoho_inventory', 'zoho_crm']).default('zoho_books'),
  ZOHO_CLIENT_ID: z.string().default('placeholder_client_id'),
  ZOHO_CLIENT_SECRET: z.string().default('placeholder_client_secret'),
  ZOHO_REDIRECT_URI: z.preprocess(
    (val) => {
      if (typeof val !== 'string') return val;
      let cleaned = val.trim();
      cleaned = cleaned.replace(/^https?:\/\/https?:\/\//i, 'https://');
      cleaned = cleaned.replace(/([^:])\/\/+/g, '$1/');
      return cleaned;
    },
    z.string().url().default('http://localhost:3000/api/zoho/callback')
  ),
  ZOHO_REFRESH_TOKEN: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() || undefined : val),
    z.string().optional().default('placeholder_refresh_token')
  ),
  ZOHO_OAUTH_SCOPES: z.string().default('ZohoBooks.contacts.ALL,ZohoBooks.settings.READ'),
  ZOHO_ACCOUNTS_URL: z.string().url().default('https://accounts.zoho.com'),
  ZOHO_API_BASE_URL: z.string().url().default('https://www.zohoapis.com/books/v3'),
  ZOHO_ORGANIZATION_ID: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() || undefined : val),
    z.string().optional()
  ),

  // Sync Settings
  SYNC_SCHEDULE: z.string().default('*/5 * * * *'),
  RECONCILIATION_SCHEDULE: z.string().default('0 2 * * *'),
  SYNC_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(50),
  SYNC_MAX_RETRIES: z.coerce.number().int().min(1).max(20).default(5),
  SYNC_RETRY_BASE_DELAY_MS: z.coerce.number().int().min(100).default(2000),
  SYNC_DRY_RUN: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  SYNC_LOCK_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),

  // AWS Secret Manager
  AWS_REGION: z.string().default('us-east-1'),
  AWS_SECRET_NAME: z.string().optional()
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment configuration:');
    console.error(result.error.format());
    throw new Error('Environment configuration validation failed');
  }

  // Format private key if provided with escaped newlines
  const config = result.data;
  if (config.FIREBASE_PRIVATE_KEY) {
    config.FIREBASE_PRIVATE_KEY = config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
  }

  return config;
}

export const config = loadConfig();
