import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { z } from 'zod';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { withExponentialBackoff } from '../utils/backoff.js';
import { zohoTokenService } from './zohoTokenService.js';
import { ZohoApiResponse, ZohoContactPayload } from '../types/zoho.js';

export const contactInputSchema = z.object({
  contact_name: z.string().min(1, 'contact_name is required'),
  company_name: z.string().optional(),
  contact_type: z.enum(['customer', 'vendor']).default('customer'),
  customer_sub_type: z.enum(['individual', 'business']).default('business'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional().default(''),
  website: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional().default(''),
  currency_id: z.string().optional(),
  payment_terms: z.number().int().optional(),
  billing_address: z
    .object({
      attention: z.string().optional(),
      address: z.string().optional(),
      street2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().optional(),
      phone: z.string().optional()
    })
    .optional(),
  shipping_address: z
    .object({
      attention: z.string().optional(),
      address: z.string().optional(),
      street2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().optional(),
      phone: z.string().optional()
    })
    .optional(),
  contact_persons: z
    .array(
      z.object({
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        phone: z.string().optional(),
        mobile: z.string().optional(),
        is_primary_contact: z.boolean().optional()
      })
    )
    .optional(),
  custom_fields: z
    .array(
      z.object({
        label: z.string().optional(),
        api_name: z.string().optional(),
        value: z.any()
      })
    )
    .optional()
});

export const contactUpdateSchema = contactInputSchema.partial();

export interface PaginationParams {
  page?: number;
  per_page?: number;
  sort_column?: string;
  sort_order?: 'A' | 'D';
  search_text?: string;
  contact_name?: string;
  email?: string;
}

export class ZohoBooksService {
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
   * Internal generic request helper with auth token attachment, retry for transient errors, and Zoho error parsing
   */
  async request<T = any>(reqConfig: AxiosRequestConfig, options: { isSafeForRetry?: boolean } = {}): Promise<T> {
    // If not configured, provide mock responses in local dev
    if (!zohoTokenService.isConfigured()) {
      return this.getMockResponse<T>(reqConfig);
    }

    const isGet = (reqConfig.method || 'get').toLowerCase() === 'get';
    const canRetry = options.isSafeForRetry !== undefined ? options.isSafeForRetry : isGet;

    const executeCall = async () => {
      const accessToken = await zohoTokenService.getValidAccessToken();

      const headers = {
        ...(reqConfig.headers || {}),
        Authorization: `Zoho-oauthtoken ${accessToken}`
      };

      const params = { ...(reqConfig.params || {}) };

      // Ensure organization_id is attached for endpoints that require it (unless it is /organizations)
      const url = reqConfig.url || '';
      if (!url.startsWith('/organizations') && config.ZOHO_ORGANIZATION_ID && !params.organization_id) {
        params.organization_id = config.ZOHO_ORGANIZATION_ID;
      }

      try {
        const response = await this.axiosInstance.request<ZohoApiResponse<T>>({
          ...reqConfig,
          headers,
          params
        });

        const body = response.data;

        // Zoho Books returns HTTP 200 with { code: 0, message: "success", ... }
        if (body.code !== undefined && body.code !== 0) {
          logger.warn({ code: body.code, message: body.message, url }, 'Zoho Books API reported non-zero code');
          const error = new Error(`Zoho Books Error (${body.code}): ${body.message}`);
          (error as any).statusCode = 400;
          (error as any).zohoCode = body.code;
          throw error;
        }

        return body as unknown as T;
      } catch (err: any) {
        // If 401 Unauthorized, invalidate token so next retry gets a fresh token
        if (err.response?.status === 401) {
          logger.warn('Zoho returned 401 Unauthorized. Invalidating cached access token.');
          zohoTokenService.invalidateToken();
        }

        // Rethrow formatted error
        if (err.response?.data?.message) {
          const zohoErr = new Error(`Zoho Books API Error: ${err.response.data.message}`);
          (zohoErr as any).statusCode = err.response.status;
          (zohoErr as any).zohoCode = err.response.data.code;
          throw zohoErr;
        }

        throw err;
      }
    };

    if (canRetry) {
      return withExponentialBackoff(executeCall, {
        maxRetries: 3,
        baseDelayMs: 1000,
        operationName: 'Zoho Books API Request'
      });
    }

    return executeCall();
  }

  /**
   * 1. Get organization information
   * Calls GET /organizations or GET /organizations/{organization_id}
   */
  async getOrganizations(): Promise<any> {
    return this.request({
      method: 'GET',
      url: '/organizations'
    });
  }

  async getOrganizationDetails(orgId?: string): Promise<any> {
    const targetOrgId = orgId || config.ZOHO_ORGANIZATION_ID;
    if (!targetOrgId) {
      // Return organization list if no specific ID is configured
      return this.getOrganizations();
    }

    return this.request({
      method: 'GET',
      url: `/organizations/${targetOrgId}`
    });
  }

  /**
   * 2. List contacts with pagination and filters
   */
  async listContacts(params: PaginationParams = {}): Promise<{
    contacts: any[];
    page_context: {
      page: number;
      per_page: number;
      has_more_page: boolean;
      total?: number;
      sort_column?: string;
      sort_order?: string;
    };
  }> {
    const queryParams: Record<string, any> = {
      page: params.page || 1,
      per_page: Math.min(200, Math.max(1, params.per_page || 50)),
      sort_column: params.sort_column || 'created_time',
      sort_order: params.sort_order || 'D'
    };

    if (params.search_text) queryParams.search_text = params.search_text;
    if (params.contact_name) queryParams.contact_name = params.contact_name;
    if (params.email) queryParams.email = params.email;

    return this.request({
      method: 'GET',
      url: '/contacts',
      params: queryParams
    });
  }

  /**
   * 3. Get a contact by ID
   */
  async getContactById(contactId: string): Promise<{ contact: any }> {
    if (!contactId || typeof contactId !== 'string') {
      const error = new Error('Contact ID is required and must be a string');
      (error as any).statusCode = 400;
      throw error;
    }

    return this.request({
      method: 'GET',
      url: `/contacts/${encodeURIComponent(contactId)}`
    });
  }

  /**
   * 4. Create a contact
   */
  async createContact(rawPayload: unknown): Promise<{ contact: any; message: string }> {
    const parsed = contactInputSchema.safeParse(rawPayload);
    if (!parsed.success) {
      const error = new Error(`Validation Error: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      (error as any).statusCode = 400;
      (error as any).details = parsed.error.format();
      throw error;
    }

    // Do NOT automatically retry non-idempotent create requests
    return this.request(
      {
        method: 'POST',
        url: '/contacts',
        data: parsed.data
      },
      { isSafeForRetry: false }
    );
  }

  /**
   * 5. Update a contact
   */
  async updateContact(contactId: string, rawPayload: unknown): Promise<{ contact: any; message: string }> {
    if (!contactId || typeof contactId !== 'string') {
      const error = new Error('Contact ID is required and must be a string');
      (error as any).statusCode = 400;
      throw error;
    }

    const parsed = contactUpdateSchema.safeParse(rawPayload);
    if (!parsed.success) {
      const error = new Error(`Validation Error: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      (error as any).statusCode = 400;
      (error as any).details = parsed.error.format();
      throw error;
    }

    return this.request({
      method: 'PUT',
      url: `/contacts/${encodeURIComponent(contactId)}`,
      data: parsed.data
    });
  }

  /**
   * Generates safe mock responses when running in dev without active Zoho credentials
   */
  private getMockResponse<T>(reqConfig: AxiosRequestConfig): T {
    const url = reqConfig.url || '';
    const method = (reqConfig.method || 'get').toUpperCase();

    logger.debug({ method, url }, 'Generating mock response for unconfigured Zoho environment');

    if (url.startsWith('/organizations')) {
      return {
        code: 0,
        message: 'success (mocked)',
        organizations: [
          {
            organization_id: config.ZOHO_ORGANIZATION_ID || 'mock_org_1001',
            name: 'Demo Zoho Books Organization',
            is_default_org: true,
            language_code: 'en',
            fiscal_year_start_month: 4,
            time_zone: 'Asia/Kolkata',
            currency_code: 'INR',
            currency_symbol: '₹',
            data_center: 'IN'
          }
        ],
        organization: {
          organization_id: config.ZOHO_ORGANIZATION_ID || 'mock_org_1001',
          name: 'Demo Zoho Books Organization',
          currency_code: 'INR'
        }
      } as any;
    }

    const isContactList = url === '/contacts' || url.startsWith('/contacts?');

    if (isContactList && method === 'GET') {
      return {
        code: 0,
        message: 'success (mocked)',
        page_context: {
          page: 1,
          per_page: 50,
          has_more_page: false,
          total: 1
        },
        contacts: [
          {
            contact_id: 'mock_contact_101',
            contact_name: 'Delta Automation Tech',
            company_name: 'Delta Automation Tech',
            contact_type: 'customer',
            email: 'siddharth@deltaautomation.in',
            phone: '+91 98450 12345',
            status: 'active'
          }
        ]
      } as any;
    }

    if (url.startsWith('/contacts/') && method === 'GET') {
      const contactId = url.replace('/contacts/', '').split('?')[0];
      return {
        code: 0,
        message: 'success (mocked)',
        contact: {
          contact_id: contactId,
          contact_name: 'Delta Automation Tech',
          company_name: 'Delta Automation Tech',
          email: 'siddharth@deltaautomation.in',
          phone: '+91 98450 12345',
          status: 'active'
        }
      } as any;
    }

    if (url.startsWith('/contacts') && method === 'POST') {
      const body = reqConfig.data || {};
      return {
        code: 0,
        message: 'The contact has been added (mocked).',
        contact: {
          contact_id: `mock_contact_${Date.now()}`,
          ...body,
          created_time: new Date().toISOString()
        }
      } as any;
    }

    if (url.startsWith('/contacts') && method === 'PUT') {
      const contactId = url.split('/')[2];
      const body = reqConfig.data || {};
      return {
        code: 0,
        message: 'The contact details have been updated (mocked).',
        contact: {
          contact_id: contactId,
          ...body,
          last_modified_time: new Date().toISOString()
        }
      } as any;
    }

    return {
      code: 0,
      message: 'Operation simulated successfully (mocked)'
    } as any;
  }
}

export const zohoBooksService = new ZohoBooksService();
