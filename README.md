# Firebase to Zoho ERP Production Synchronization API

A standalone, production-ready Node.js & TypeScript backend service that automatically synchronizes CRM data stored in **Google Cloud Firestore** to **Zoho ERP (Zoho Books / Zoho Inventory / Zoho CRM)**.

The service operates independently of your frontend CRM application, running scheduled incremental synchronization and reconciliation jobs in the background, backed by a secured REST administrative API.

---

## 1. Key Capabilities & Architecture

- **Autonomous Background Sync**: Operates independently of the frontend CRM using reliable cron scheduling (`croner`). No manual button clicking required.
- **Dual Sync Modes**:
  - **Initial Full Sync**: Batch reads all eligible CRM documents, maps schema, creates corresponding Zoho records, and records source-to-destination mappings.
  - **Incremental Sync**: Continuously detects modified and newly created records using Firestore high-watermark timestamps (`updatedAt > watermark`).
- **Distributed Idempotency & Locking**:
  - Uses Google Cloud Firestore atomic transactions for distributed mutual exclusion (`_sync_locks`) with TTL leases.
  - Safe for multi-instance deployments (e.g. AWS ECS Fargate autoscaling, Kubernetes) without running duplicate jobs or creating duplicate Zoho records.
  - Requires **ZERO extra databases** (no PostgreSQL or Redis needed).
- **Timeout & Duplicate Recovery**:
  - Generates deterministic SHA-256 payload hashes to skip unchanged documents.
  - In the event of an ambiguous network timeout, queries Zoho by external identifier / reference number to discover if the record was already created before attempting retries.
- **OAuth 2.0 Auto-Refresh**: In-memory token caching with proactive renewal (5-minute safety buffer) and automatic re-authentication on 401 challenge.
- **Enterprise Security**:
  - Structured JSON logging (`pino`) with automatic redaction of access tokens, client secrets, private keys, and authorization headers.
  - Timing-safe admin API key verification to prevent timing attacks.
  - Request rate limiting and safe error masking in production.

---

## 2. Source CRM Data Model (Cloud Firestore)

Based on inspection of the CRM repository, the source data resides in Google Cloud Firestore under the following collections:

### Customers (`customers`)
```typescript
{
  id: string;               // e.g., 'c-1'
  name: string;             // Customer Company / Account Name
  contact: string;          // Primary contact person
  email: string;            // Validated business email
  phone: string;            // Telephone / Mobile
  company: string;          // Company name
  tenantId?: string;        // Optional multi-tenant discriminator
  createdAt: string;        // ISO-8601 timestamp
  updatedAt: string;        // ISO-8601 timestamp
}
```

### RFQs & Orders (`rfqs`)
```typescript
{
  id: string;               // e.g., 'rfq-001'
  rfqNumber: string;        // e.g., 'RFQ-2026-001'
  customerId: string;       // Foreign key to customers.id
  customerName: string;     // Denormalized customer name
  productName: string;      // Deliverable title
  partNumber: string;       // Assembly identifier
  quantity: number;
  targetDeliveryDate: string; // YYYY-MM-DD
  status: RfqStatus;        // 'Draft' | 'Approved' | 'Quoted to Customer' | 'Sales Order' | ...
  stage: Stage;             // Pipeline lifecycle stage
  assignee: string;
  department: string;
  totalValue: number;
  salesOrderNumber?: string;// e.g., 'SO-2026-014' (when converted)
  invoiceId?: string;       // e.g., 'INV-2026-091' (when invoiced)
  notes: string[];
  productLines: Array<{     // Line items mapped to Zoho Items
    sku: string;            // e.g., 'CPA-08-A'
    description: string;
    qty: number;
    unitPrice: number;
    total: number;
  }>;
  createdAt: string;
  updatedAt: string;
}
```

---

## 3. Destination Entity Mapping (Zoho ERP)

| Firebase CRM Entity | Zoho Books / Inventory Target | Key Mapping Logic |
|---|---|---|
| `customers` | `/contacts` | Maps to Zoho Contact (`contact_name`, `company_name`, `email`, `phone`, `contact_persons`). Stores Firebase ID in custom field and notes. |
| `rfqs.productLines` | `/items` | Maps SKU to Zoho Item (`sku`, `name`, `rate`, `product_type: 'goods'`). Prevents item duplicates via SKU lookup. |
| `rfqs` | `/salesorders` | Resolves mapped Zoho Customer ID and Item IDs, maps `salesorder_number`, `reference_number` (RFQ#), line items, and delivery date. |

Supported target adapters:
- `zoho_books` (Default: Zoho Books REST API v3)
- `zoho_inventory` (Zoho Inventory REST API v3)
- `zoho_crm` (Zoho CRM API v6)

---

## 4. Environment Variables Reference

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Description | Default / Example |
|---|---|---|
| `NODE_ENV` | Environment mode (`development`, `test`, `production`) | `production` |
| `PORT` | API server listen port | `4000` |
| `LOG_LEVEL` | Logging verbosity (`info`, `debug`, `warn`, `error`) | `info` |
| `ADMIN_API_KEY` | Secret token for securing administrative sync endpoints | Secure 32+ char token |
| `FIREBASE_PROJECT_ID` | Google Cloud / Firebase project ID | `my-portfolio-e1326` |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin service account client email | `firebase-adminsdk@...` |
| `FIREBASE_PRIVATE_KEY` | Firebase Admin private key (PEM format with `\n`) | `"-----BEGIN PRIVATE KEY-----\n..."` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Alternatively, path to service account JSON file | `./service-account.json` |
| `TENANT_ID` | Optional tenant ID to isolate multi-tenant data | *(Empty for single-tenant)* |
| `ZOHO_PRODUCT` | Destination product (`zoho_books`, `zoho_inventory`, `zoho_crm`) | `zoho_books` |
| `ZOHO_CLIENT_ID` | Zoho OAuth 2.0 Client ID | From Zoho API Console |
| `ZOHO_CLIENT_SECRET` | Zoho OAuth 2.0 Client Secret | From Zoho API Console |
| `ZOHO_REFRESH_TOKEN` | Zoho OAuth 2.0 Refresh Token (Offline access) | Generated via OAuth flow |
| `ZOHO_ACCOUNTS_URL` | Regional accounts endpoint | `https://accounts.zoho.com` |
| `ZOHO_API_BASE_URL` | Base REST endpoint for Zoho Books | `https://www.zohoapis.com/books/v3` |
| `ZOHO_ORGANIZATION_ID` | Zoho Books organization ID | `123456789` |
| `SYNC_SCHEDULE` | Cron expression for incremental sync | `*/5 * * * *` (every 5 min) |
| `RECONCILIATION_SCHEDULE` | Cron expression for full daily reconciliation | `0 2 * * *` (daily at 2am) |
| `SYNC_BATCH_SIZE` | Documents per batch query | `50` |
| `SYNC_MAX_RETRIES` | Max attempts for failed records | `5` |
| `SYNC_DRY_RUN` | If `true`, validates and logs without modifying Zoho | `false` |
| `SYNC_LOCK_TTL_SECONDS` | Lease duration for distributed lock in seconds | `300` |

---

## 5. Local Development & Testing

### Installation
```bash
npm install
```

### Run Tests
```bash
npm test
```
The test suite validates:
- Firebase record retrieval, watermark queries, and pagination.
- Field transformations, Zod schema validation, and missing field merge protection.
- Zoho OAuth token refresh and expiration caching.
- Idempotency hashing and timeout duplicate recovery.
- Exponential backoff and retry handling on rate-limiting (429) and server errors (500).
- Distributed locking and mutual exclusion.
- REST endpoints and security authorization checks.

### Run in Development Mode
```bash
npm run dev
```

### Build for Production
```bash
npm run build
npm start
```

---

## 6. REST API Reference

All administrative endpoints under `/api/v1/sync` require authentication using the header:
`x-api-key: <ADMIN_API_KEY>` or `Authorization: Bearer <ADMIN_API_KEY>`.

### 1. Service Health Check
```http
GET /health
```
**Response (200 OK):**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-10-28T05:10:00.000Z",
  "environment": "production",
  "dependencies": {
    "firebase": {
      "status": "connected",
      "projectId": "my-portfolio-e1326",
      "databaseType": "firestore"
    },
    "zoho": {
      "product": "zoho_books",
      "accountsUrl": "https://accounts.zoho.com",
      "isConfigured": true
    },
    "scheduler": {
      "isRunning": true,
      "syncSchedule": "*/5 * * * *",
      "reconciliationSchedule": "0 2 * * *",
      "dryRun": false
    }
  }
}
```

### 2. Synchronization Status & Metrics
```http
GET /api/v1/sync/status
x-api-key: <ADMIN_API_KEY>
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "isConfigured": { "firebase": true, "zoho": true },
    "stats": {
      "totalSynced": 14,
      "totalFailed": 0,
      "totalPending": 0
    },
    "checkpoints": {
      "customer": {
        "id": "customer",
        "lastWatermark": "2026-10-27T11:00:00.000Z",
        "lastSyncCompletedAt": "2026-10-28T05:00:00.000Z",
        "totalProcessedCount": 10
      },
      "sales_order": {
        "id": "sales_order",
        "lastWatermark": "2026-10-27T11:00:00.000Z",
        "lastSyncCompletedAt": "2026-10-28T05:00:00.000Z",
        "totalProcessedCount": 4
      }
    },
    "lastJob": {
      "id": "edd3b2f1-7fc9-46be-bb86-dc1f6da1c208",
      "jobType": "INCREMENTAL",
      "status": "SUCCESS",
      "totalProcessed": 14,
      "totalCreated": 14,
      "totalUpdated": 0,
      "totalFailed": 0,
      "startedAt": "2026-10-28T05:00:00.000Z",
      "completedAt": "2026-10-28T05:00:03.000Z"
    }
  }
}
```

### 3. Synchronization Audit Logs
```http
GET /api/v1/sync/logs?limit=10
x-api-key: <ADMIN_API_KEY>
```

### 4. Trigger Manual Sync
```http
POST /api/v1/sync/run
x-api-key: <ADMIN_API_KEY>
Content-Type: application/json

{
  "mode": "INCREMENTAL"   // or "FULL"
}
```

### 5. Retry Failed Records
```http
POST /api/v1/sync/retry-failed
x-api-key: <ADMIN_API_KEY>
```

---

## 7. Production AWS Deployment Guide

### Recommended AWS Architecture (ECS Fargate + Secrets Manager)

```
                     ┌────────────────────────────────────────┐
                     │          AWS Secrets Manager           │
                     │  (FIREBASE_PRIVATE_KEY, ZOHO Secrets)  │
                     └───────────────────┬────────────────────┘
                                         │ IAM Task Role
                                         ▼
┌─────────────────┐           ┌──────────────────────┐           ┌─────────────────┐
│ Cloud Firestore │ ◄───────► │   AWS ECS Fargate    │ ◄───────► │ Zoho Books API  │
│  (CRM Source +  │           │   (Container Tasks)  │           │   (Zoho ERP)    │
│  Sync Metadata) │           │   - sync-api (Web)   │           │                 │
└─────────────────┘           │   - sync-worker (Job)│           └─────────────────┘
                              └──────────────────────┘
```

### 1. Secret Management with AWS Secrets Manager
Never commit service account keys or Zoho client secrets to version control. In AWS:
1. Store credentials as a JSON secret in AWS Secrets Manager:
   ```json
   {
     "ADMIN_API_KEY": "YOUR_LONG_SECURE_TOKEN",
     "FIREBASE_PROJECT_ID": "my-portfolio-e1326",
     "FIREBASE_CLIENT_EMAIL": "firebase-adminsdk@...",
     "FIREBASE_PRIVATE_KEY": "-----BEGIN PRIVATE KEY-----\n...",
     "ZOHO_CLIENT_ID": "1000.XXXX",
     "ZOHO_CLIENT_SECRET": "XXXX",
     "ZOHO_REFRESH_TOKEN": "1000.XXXX.XXXX",
     "ZOHO_ORGANIZATION_ID": "123456789"
   }
   ```
2. Reference the secret in your ECS Task Definition `secrets` block so that AWS injects them directly into container environment variables at runtime.

### 2. Multi-Container Scaling & Mutual Exclusion
When deploying multiple replicas of the container for high availability:
- **No Overlapping Jobs**: The built-in `DistributedLock` automatically elects a temporary leaseholder in Firestore collection `_sync_locks`. Only one task executes synchronization at any given second.
- **Worker Separation**: You can run web traffic on `node dist/server.js` and dedicated background cron workers on `node dist/worker.js`.

### 3. Docker Deployment
Build and run using Docker:
```bash
docker build -t crm-sync-api:latest .
docker run -p 4000:4000 --env-file .env crm-sync-api:latest
```
Or with docker-compose:
```bash
docker compose up -d
```
