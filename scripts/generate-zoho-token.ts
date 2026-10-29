import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import { config } from '../src/config/index.js';

/**
 * Script to exchange a Zoho authorization code (grant token) for a permanent refresh token.
 * 
 * Usage:
 *   npx tsx scripts/generate-zoho-token.ts <AUTH_GRANT_CODE>
 */
async function main() {
  const code = process.argv[2];

  if (!code) {
    console.log(`
🔑 Zoho OAuth Refresh Token Generator
====================================
Usage:
  npx tsx scripts/generate-zoho-token.ts <YOUR_GENERATED_CODE>

Steps to get the code:
1. Go to https://api-console.zoho.com/ (or https://api-console.zoho.in/ if in India)
2. Open your Client (or Self-Client)
3. Click "Generate Code"
4. Scope: ZohoBooks.contacts.ALL,ZohoBooks.items.ALL,ZohoBooks.salesorders.ALL,ZohoBooks.settings.READ
5. Duration: 10 minutes
6. Click Generate, copy the code and run this command with that code.
`);
    process.exit(1);
  }

  console.log(`📡 Exchanging authorization code with Zoho Accounts (${config.ZOHO_ACCOUNTS_URL})...`);

  const accountsUrls = [
    config.ZOHO_ACCOUNTS_URL,
    'https://accounts.zoho.com',
    'https://accounts.zoho.in',
    'https://accounts.zoho.eu'
  ];

  const uniqueUrls = Array.from(new Set(accountsUrls));

  for (const baseUrl of uniqueUrls) {
    const tokenUrl = `${baseUrl.replace(/\/+$/, '')}/oauth/v2/token`;
    for (const withRedirect of [true, false]) {
      try {
        const payload: Record<string, string> = {
          code: code.trim(),
          client_id: config.ZOHO_CLIENT_ID,
          client_secret: config.ZOHO_CLIENT_SECRET,
          grant_type: 'authorization_code'
        };

        if (withRedirect && config.ZOHO_REDIRECT_URI) {
          payload.redirect_uri = config.ZOHO_REDIRECT_URI;
        }

        const params = new URLSearchParams(payload);

        console.log(`Trying ${tokenUrl} ${withRedirect ? '(with redirect_uri)' : '(without redirect_uri)'}...`);
        const response = await axios.post(tokenUrl, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000
        });

        if (response.data.error) {
          console.warn(`Response from ${baseUrl}:`, response.data);
          continue;
        }

        console.log(`\n🎉 SUCCESS! Generated Zoho Refresh Token:`);
        console.log(`--------------------------------------------------`);
        console.log(`ZOHO_REFRESH_TOKEN=${response.data.refresh_token}`);
        console.log(`ZOHO_ACCOUNTS_URL=${baseUrl}`);
        if (baseUrl.includes('.in')) {
          console.log(`ZOHO_API_BASE_URL=https://www.zohoapis.in/books/v3`);
        }
        console.log(`--------------------------------------------------`);
        console.log(`\nAccess Token (valid for 1 hour): ${response.data.access_token?.slice(0, 15)}...`);

        // Automatically persist to .env
        if (response.data.refresh_token) {
          const envPath = path.resolve(process.cwd(), '.env');
          if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf8');
            if (/^ZOHO_REFRESH_TOKEN=.*$/m.test(envContent)) {
              envContent = envContent.replace(/^ZOHO_REFRESH_TOKEN=.*$/m, `ZOHO_REFRESH_TOKEN=${response.data.refresh_token.trim()}`);
            } else {
              envContent += `\nZOHO_REFRESH_TOKEN=${response.data.refresh_token.trim()}\n`;
            }
            fs.writeFileSync(envPath, envContent, 'utf8');
            console.log(`💾 Automatically saved ZOHO_REFRESH_TOKEN to .env!`);
          }
        }
        return;
      } catch (err: any) {
        console.warn(`Failed on ${baseUrl}: ${err.response?.data?.error || err.message}`);
      }
    }
  }

  console.error('\n❌ Could not exchange code with any Zoho Accounts endpoint. Please ensure the code is fresh and belongs to the Client ID in .env.');
  process.exit(1);
}

main().catch(console.error);

