import { config } from './environment.js';
import { zohoTokenService } from '../services/zohoTokenService.js';

export interface SanitizedZohoConfig {
  product: string;
  clientId: string;
  clientSecretConfigured: boolean;
  redirectUri: string;
  refreshTokenConfigured: boolean;
  scopes: string[];
  accountsUrl: string;
  apiBaseUrl: string;
  organizationIdConfigured: boolean;
  organizationId?: string;
  dataCenter: string;
}

export function getDataCenterFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.endsWith('.in')) return 'IN';
    if (hostname.endsWith('.eu')) return 'EU';
    if (hostname.endsWith('.com.au')) return 'AU';
    if (hostname.endsWith('.jp')) return 'JP';
    if (hostname.endsWith('.ca')) return 'CA';
    return 'US';
  } catch {
    return 'US';
  }
}

export function isZohoConfigured(): boolean {
  return zohoTokenService.isConfigured();
}

export function validateZohoConfig(): { isValid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!config.ZOHO_CLIENT_ID || config.ZOHO_CLIENT_ID === 'placeholder_client_id') {
    missing.push('ZOHO_CLIENT_ID');
  }
  if (!config.ZOHO_CLIENT_SECRET || config.ZOHO_CLIENT_SECRET === 'placeholder_client_secret') {
    missing.push('ZOHO_CLIENT_SECRET');
  }
  if (!config.ZOHO_REFRESH_TOKEN || config.ZOHO_REFRESH_TOKEN === 'placeholder_refresh_token') {
    missing.push('ZOHO_REFRESH_TOKEN');
  }
  if (!config.ZOHO_ORGANIZATION_ID) {
    missing.push('ZOHO_ORGANIZATION_ID');
  }

  return {
    isValid: missing.length === 0,
    missing
  };
}

export function getSanitizedZohoConfig(): SanitizedZohoConfig {
  return {
    product: config.ZOHO_PRODUCT,
    clientId:
      config.ZOHO_CLIENT_ID && config.ZOHO_CLIENT_ID !== 'placeholder_client_id'
        ? `${config.ZOHO_CLIENT_ID.slice(0, 8)}...`
        : 'Not Configured',
    clientSecretConfigured:
      Boolean(config.ZOHO_CLIENT_SECRET) && config.ZOHO_CLIENT_SECRET !== 'placeholder_client_secret',
    redirectUri: config.ZOHO_REDIRECT_URI,
    refreshTokenConfigured: Boolean(zohoTokenService.getEffectiveRefreshToken()),
    scopes: config.ZOHO_OAUTH_SCOPES.split(',').map((s) => s.trim()).filter(Boolean),
    accountsUrl: config.ZOHO_ACCOUNTS_URL,
    apiBaseUrl: config.ZOHO_API_BASE_URL,
    organizationIdConfigured: Boolean(config.ZOHO_ORGANIZATION_ID),
    organizationId: config.ZOHO_ORGANIZATION_ID || undefined,
    dataCenter: getDataCenterFromUrl(config.ZOHO_ACCOUNTS_URL)
  };
}

export function verifyScopeCoverage(requiredScopes: string[]): { hasCoverage: boolean; missingScopes: string[] } {
  const configuredScopes = config.ZOHO_OAUTH_SCOPES.split(',').map((s) => s.trim().toLowerCase());
  const hasFullAccess = configuredScopes.some((s) => s.includes('fullaccess'));

  if (hasFullAccess) {
    return { hasCoverage: true, missingScopes: [] };
  }

  const missingScopes = requiredScopes.filter((req) => {
    const reqLower = req.toLowerCase();
    const parts = reqLower.split('.');
    const moduleName = parts.length > 1 ? parts[1] : parts[0];
    const op = parts.length > 2 ? parts[2] : 'all';

    // Direct exact match
    if (configuredScopes.includes(reqLower)) return false;

    // Direct base module .all match (e.g. ERP.contacts.ALL covers ERP.contacts.READ)
    const baseModule = parts[0] + '.' + moduleName;
    if (configuredScopes.includes(`${baseModule}.all`)) return false;

    // Cross-product equivalent module match with .ALL or matching operation
    const coversModule = configuredScopes.some((s) => {
      const sParts = s.split('.');
      const sModule = sParts.length > 1 ? sParts[1] : sParts[0];
      const sOp = sParts.length > 2 ? sParts[2] : '';
      return sModule === moduleName && (sOp === 'all' || sOp === op);
    });
    if (coversModule) return false;

    return true;
  });

  return {
    hasCoverage: missingScopes.length === 0,
    missingScopes
  };
}
