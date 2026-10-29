import { Router } from 'express';
import { zohoController } from '../controllers/zohoController.js';
import { requireAdminAuth } from '../middleware/auth.js';
import { adminRateLimiter } from '../middleware/rateLimiter.js';

export const zohoRouter = Router();

// Apply rate limiting across Zoho API endpoints
zohoRouter.use(adminRateLimiter);

/**
 * OAuth 2.0 Endpoints
 */
// 1. GET /api/zoho/auth - Initiates OAuth flow, redirects to Zoho consent screen
zohoRouter.get('/auth', (req, res, next) => zohoController.getAuth(req, res, next));

// 2. GET /api/zoho/callback - OAuth callback handler exchanging code for tokens
zohoRouter.get('/callback', (req, res, next) => zohoController.handleCallback(req, res, next));

// 3. POST /api/zoho/token/refresh - Manually triggers access token renewal (protected)
zohoRouter.post('/token/refresh', requireAdminAuth, (req, res, next) =>
  zohoController.refreshToken(req, res, next)
);

// 4. GET /api/zoho/config - View sanitized configuration status (no secrets exposed)
zohoRouter.get('/config', (req, res, next) => zohoController.getConfigStatus(req, res, next));

/**
 * Zoho Books API Endpoints
 */
// 5. GET /api/zoho/organization - Fetch organization details
zohoRouter.get('/organization', (req, res, next) => zohoController.getOrganization(req, res, next));

// 6. GET /api/zoho/contacts - List contacts with pagination and filters
zohoRouter.get('/contacts', (req, res, next) => zohoController.listContacts(req, res, next));

// 7. GET /api/zoho/contacts/:contactId - Get single contact by ID
zohoRouter.get('/contacts/:contactId', (req, res, next) =>
  zohoController.getContactById(req, res, next)
);

// 8. POST /api/zoho/contacts - Create a new contact in Zoho Books
zohoRouter.post('/contacts', (req, res, next) => zohoController.createContact(req, res, next));

// 9. PUT /api/zoho/contacts/:contactId - Update an existing contact in Zoho Books
zohoRouter.put('/contacts/:contactId', (req, res, next) =>
  zohoController.updateContact(req, res, next)
);
