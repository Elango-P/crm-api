import { Request, Response, NextFunction } from 'express';
import { zohoTokenService } from '../services/zohoTokenService.js';
import { zohoBooksService } from '../services/zohoBooksService.js';
import { getSanitizedZohoConfig, isZohoConfigured } from '../config/zohoConfig.js';
import { logger } from '../utils/logger.js';

export class ZohoController {
  /**
   * GET /api/zoho/auth
   * Generates authorization URL and redirects user (or returns JSON with URL)
   */
  async getAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customRedirectUri = typeof req.query.redirect_uri === 'string' ? req.query.redirect_uri : undefined;
      const { url, state } = zohoTokenService.getAuthorizationUrl(customRedirectUri);

      logger.info({ state, redirectUri: customRedirectUri }, 'Generated Zoho OAuth authorization URL');

      // If requested as JSON, e.g. for frontend SPA or API clients
      if (req.query.format === 'json' || req.headers.accept?.includes('application/json')) {
        res.json({
          success: true,
          authorizationUrl: url,
          state,
          instructions: 'Visit authorizationUrl in a browser to grant permissions to Zoho Books'
        });
        return;
      }

      res.redirect(url);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/zoho/callback
   * Receives OAuth authorization code and exchanges it for tokens
   */
  async handleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        logger.warn({ error, error_description }, 'Zoho authorization was denied or failed');
        res.status(400).json({
          error: 'AccessDenied',
          message: `Zoho OAuth authorization was denied or encountered an error: ${error}`,
          details: error_description || null
        });
        return;
      }

      if (!code || typeof code !== 'string') {
        res.status(400).json({
          error: 'BadRequest',
          message: 'Missing required OAuth authorization code in query parameter'
        });
        return;
      }

      if (!state || typeof state !== 'string') {
        res.status(400).json({
          error: 'BadRequest',
          message: 'Missing required OAuth state parameter in query parameter'
        });
        return;
      }

      const result = await zohoTokenService.exchangeAuthorizationCode(code, state);

      res.status(200).json({
        success: true,
        message: 'Zoho OAuth authorization successful.',
        hasRefreshToken: result.hasRefreshToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        instructions: result.instructions,
        isConfigured: isZohoConfigured()
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/zoho/token/refresh
   * Manually refreshes the access token using the stored refresh token
   */
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await zohoTokenService.refreshManually();

      res.json({
        success: true,
        message: 'Zoho access token refreshed successfully and cached in memory.',
        data: {
          expiresInSeconds: result.expiresIn,
          expiresAt: result.expiresAt
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/zoho/config
   * Returns sanitized Zoho integration status (never exposes client secret or tokens)
   */
  async getConfigStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sanitized = getSanitizedZohoConfig();
      res.json({
        success: true,
        data: sanitized
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/zoho/organization
   * Fetches organization information from Zoho Books
   */
  async getOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = typeof req.query.organization_id === 'string' ? req.query.organization_id : undefined;
      const data = await zohoBooksService.getOrganizationDetails(orgId);

      res.json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/zoho/contacts
   * Lists contacts with pagination and query filters
   */
  async listContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const per_page = req.query.per_page ? parseInt(req.query.per_page as string, 10) : undefined;
      const sort_column = typeof req.query.sort_column === 'string' ? req.query.sort_column : undefined;
      const sort_order = req.query.sort_order === 'A' || req.query.sort_order === 'D' ? req.query.sort_order : undefined;
      const search_text = typeof req.query.search_text === 'string' ? req.query.search_text : undefined;
      const contact_name = typeof req.query.contact_name === 'string' ? req.query.contact_name : undefined;
      const email = typeof req.query.email === 'string' ? req.query.email : undefined;

      const result = await zohoBooksService.listContacts({
        page,
        per_page,
        sort_column,
        sort_order,
        search_text,
        contact_name,
        email
      });

      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/zoho/contacts/:contactId
   * Retrieves single contact by ID
   */
  async getContactById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { contactId } = req.params;
      const result = await zohoBooksService.getContactById(contactId);

      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/zoho/contacts
   * Creates a new contact in Zoho Books
   */
  async createContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await zohoBooksService.createContact(req.body);

      res.status(201).json({
        success: true,
        message: 'Contact created successfully in Zoho Books',
        data: result.contact
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/zoho/contacts/:contactId
   * Updates an existing contact in Zoho Books
   */
  async updateContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { contactId } = req.params;
      const result = await zohoBooksService.updateContact(contactId, req.body);

      res.json({
        success: true,
        message: 'Contact updated successfully in Zoho Books',
        data: result.contact
      });
    } catch (err) {
      next(err);
    }
  }
}

export const zohoController = new ZohoController();
