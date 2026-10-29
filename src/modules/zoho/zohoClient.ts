import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { withExponentialBackoff } from '../../utils/backoff.js';
import { zohoTokenManager } from './zohoTokenManager.js';
import { ZohoApiResponse } from '../../types/zoho.js';

export class ZohoClient {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: config.ZOHO_API_BASE_URL.replace(/\/+$/, ''),
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Execute an authenticated request with retry and backoff
   */
  async request<T = any>(reqConfig: AxiosRequestConfig): Promise<ZohoApiResponse<T>> {
    // Dry run check for mutation operations
    const method = (reqConfig.method || 'get').toLowerCase();
    if (config.SYNC_DRY_RUN && ['post', 'put', 'patch', 'delete'].includes(method)) {
      logger.info(
        {
          dryRun: true,
          method,
          url: reqConfig.url,
          data: reqConfig.data
        },
        'DRY RUN: Skipping real Zoho API write call'
      );
      return {
        code: 0,
        message: 'DRY RUN: Mutation simulated successfully',
        data: { id: `mock_zoho_${Date.now()}` } as any
      };
    }

    // If in development mode without real Zoho credentials, simulate successful API response
    if (!zohoTokenManager.isConfigured()) {
      return {
        code: 0,
        message: 'Mock Zoho response',
        contact: { contact_id: `mock_contact_${Date.now()}` },
        item: { item_id: `mock_item_${Date.now()}` },
        salesorder: { salesorder_id: `mock_so_${Date.now()}` },
        invoice: { invoice_id: `mock_inv_${Date.now()}` },
        estimate: { estimate_id: `mock_est_${Date.now()}` },
        quote: { quote_id: `mock_quote_${Date.now()}` },
        bom: { bom_id: `mock_bom_${Date.now()}` }
      } as any;
    }

    return withExponentialBackoff(
      async () => {
        const token = await zohoTokenManager.getValidAccessToken();

        // Attach organization_id for Books & Inventory if present
        const params = { ...(reqConfig.params || {}) };
        if (config.ZOHO_ORGANIZATION_ID && !params.organization_id) {
          params.organization_id = config.ZOHO_ORGANIZATION_ID;
        }

        const headers = {
          ...(reqConfig.headers || {}),
          Authorization: `Zoho-oauthtoken ${token}`
        };

        try {
          const response = await this.axiosInstance.request<ZohoApiResponse<T>>({
            ...reqConfig,
            params,
            headers
          });

          // Check if response has Zoho specific error code
          if (response.data && typeof response.data.code === 'number' && response.data.code !== 0) {
            throw new Error(`Zoho API Error (${response.data.code}): ${response.data.message}`);
          }

          return response.data;
        } catch (error: any) {
          if (error.response?.data?.message) {
            error.message = `Zoho API Error (${error.response.data.code || error.response.status}): ${error.response.data.message}`;
          }
          // If 401 Unauthorized, invalidate token and trigger retry
          if (error.response?.status === 401) {
            logger.warn('Received 401 Unauthorized from Zoho API. Invalidating token.');
            zohoTokenManager.invalidateToken();
          }

          throw error;
        }
      },
      {
        operationName: `Zoho API [${method.toUpperCase()} ${reqConfig.url}]`,
        maxRetries: 3
      }
    );
  }

  async get<T = any>(url: string, params?: Record<string, any>): Promise<ZohoApiResponse<T>> {
    return this.request<T>({ method: 'GET', url, params });
  }

  async post<T = any>(url: string, data?: any, params?: Record<string, any>): Promise<ZohoApiResponse<T>> {
    return this.request<T>({ method: 'POST', url, data, params });
  }

  async put<T = any>(url: string, data?: any, params?: Record<string, any>): Promise<ZohoApiResponse<T>> {
    return this.request<T>({ method: 'PUT', url, data, params });
  }

  async delete<T = any>(url: string, params?: Record<string, any>): Promise<ZohoApiResponse<T>> {
    return this.request<T>({ method: 'DELETE', url, params });
  }
}

export const zohoClient = new ZohoClient();
