# 📮 OCR Service - Postman API Routes

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication
Tất cả các endpoints đều yêu cầu JWT token trong header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 🔐 1. Login (Lấy JWT Token)

### POST `/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

**Lưu ý:** Copy `access_token` để dùng cho các requests tiếp theo.

---

## 📸 2. Tạo OCR Job (Scan Receipt)

### POST `/ocr/scan`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "fileUrl": "https://example.com/receipt.jpg"
}
```

**Example URLs for Testing:**
```json
{
  "fileUrl": "https://i.imgur.com/sample-receipt.jpg"
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-uuid",
  "status": "queued",
  "fileUrl": "https://example.com/receipt.jpg",
  "resultJson": null,
  "createdAt": "2025-12-29T08:00:00.000Z",
  "completedAt": null
}
```

**Status Flow:**
- `queued` → `processing` → `completed` hoặc `failed`

---

## 📋 3. Lấy Lịch Sử OCR Jobs

### GET `/ocr/jobs`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | - | Filter by status: `queued`, `processing`, `completed`, `failed` |
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 10 | Items per page (max: 100) |

**Example Requests:**

1. **Get all jobs (page 1):**
   ```
   GET /ocr/jobs
   ```

2. **Get completed jobs:**
   ```
   GET /ocr/jobs?status=completed
   ```

3. **Get page 2 with 20 items:**
   ```
   GET /ocr/jobs?page=2&limit=20
   ```

4. **Get failed jobs:**
   ```
   GET /ocr/jobs?status=failed
   ```

**Response:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "user-uuid",
      "status": "completed",
      "fileUrl": "https://example.com/receipt.jpg",
      "resultJson": {
        "rawText": "RECEIPT\nTotal: 50000 VND\nDate: 29/12/2024",
        "confidence": 85.5,
        "expenseData": {
          "amount": 50000,
          "description": "RECEIPT",
          "spentAt": "2024-12-29T00:00:00.000Z",
          "category": "food",
          "confidence": 85.5
        }
      },
      "createdAt": "2025-12-29T08:00:00.000Z",
      "completedAt": "2025-12-29T08:00:15.000Z"
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3,
    "timestamp": "2025-12-29T08:30:00.000Z"
  }
}
```

---

## 🔍 4. Lấy Chi Tiết 1 OCR Job

### GET `/ocr/jobs/:jobId`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**URL Parameters:**
- `jobId` (required): UUID của OCR job

**Example Request:**
```
GET /ocr/jobs/550e8400-e29b-41d4-a716-446655440000
```

**Response (Success):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-uuid",
  "status": "completed",
  "fileUrl": "https://example.com/receipt.jpg",
  "resultJson": {
    "rawText": "RECEIPT\nTotal: 50000 VND\nDate: 29/12/2024",
    "confidence": 85.5,
    "expenseData": {
      "amount": 50000,
      "description": "RECEIPT",
      "spentAt": "2024-12-29T00:00:00.000Z",
      "category": "food",
      "confidence": 85.5
    }
  },
  "createdAt": "2025-12-29T08:00:00.000Z",
  "completedAt": "2025-12-29T08:00:15.000Z"
}
```

**Response (Not Found):**
```json
{
  "statusCode": 404,
  "message": "OCR job with ID 550e8400-e29b-41d4-a716-446655440000 not found",
  "error": "Not Found"
}
```

**Response (Forbidden - Not Owner):**
```json
{
  "statusCode": 403,
  "message": "You do not have access to this OCR job",
  "error": "Forbidden"
}
```

---

## 💰 5. Kiểm Tra Expense Đã Tạo

### GET `/expenses`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters:**
- `isFromOcr=true` - Filter expenses created from OCR

**Example Request:**
```
GET /expenses?isFromOcr=true
```

**Response:**
```json
{
  "data": [
    {
      "id": "expense-uuid",
      "userId": "user-uuid",
      "description": "RECEIPT",
      "amount": 50000,
      "category": "food",
      "spentAt": "2024-12-29",
      "ocrJobId": "550e8400-e29b-41d4-a716-446655440000",
      "isFromOcr": true,
      "ocrConfidence": 85.5,
      "createdAt": "2025-12-29T08:00:15.000Z",
      "updatedAt": "2025-12-29T08:00:15.000Z"
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 10
  }
}
```

---

## 🧪 Testing Workflow

### Step 1: Login
```bash
POST http://localhost:3000/api/v1/auth/login
Body: { "email": "user@example.com", "password": "password123" }
```
→ Copy `access_token`

### Step 2: Create OCR Job
```bash
POST http://localhost:3000/api/v1/ocr/scan
Headers: Authorization: Bearer YOUR_TOKEN
Body: { "fileUrl": "https://example.com/receipt.jpg" }
```
→ Copy `id` (jobId)

### Step 3: Check Job Status
```bash
GET http://localhost:3000/api/v1/ocr/jobs/{jobId}
Headers: Authorization: Bearer YOUR_TOKEN
```
→ Wait until `status` = `completed`

### Step 4: Verify Expense Created
```bash
GET http://localhost:3000/api/v1/expenses?isFromOcr=true
Headers: Authorization: Bearer YOUR_TOKEN
```
→ Should see new expense with `ocrJobId` matching

### Step 5: View All OCR History
```bash
GET http://localhost:3000/api/v1/ocr/jobs
Headers: Authorization: Bearer YOUR_TOKEN
```

---

## 📊 Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | No permission to access resource |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server error |

---

## 🔗 Swagger Documentation

Để xem interactive API docs:
```
http://localhost:3000/docs
```

Swagger UI cho phép bạn:
- ✅ Test tất cả endpoints trực tiếp
- ✅ Xem request/response schemas
- ✅ Authorize với JWT token
- ✅ Export Postman collection

---

## 📝 Postman Collection Import

Bạn có thể import collection này vào Postman:

1. Mở Postman
2. Click **Import**
3. Paste URL: `http://localhost:3000/docs-json`
4. Postman sẽ tự động tạo collection từ Swagger spec

---

## 🐛 Troubleshooting

### Error: "Cannot connect to OCR service"
- Kiểm tra OCR service đang chạy: `docker-compose ps`
- Check logs: `docker-compose logs -f ocr-service`

### Error: "Job stuck in 'processing' status"
- Check worker logs: `docker-compose logs -f ocr-service`
- Verify RabbitMQ connection: `http://localhost:15672`

### Error: "Expense not created after OCR completed"
- Check expense service logs: `docker-compose logs -f expense-service`
- Verify RabbitMQ event emission
- Check database: `SELECT * FROM "Expense" WHERE "isFromOcr" = true`

---

## 📌 Quick Reference

```bash
# Base URL
http://localhost:3000/api/v1

# OCR Endpoints
POST   /ocr/scan              # Create OCR job
GET    /ocr/jobs              # List all jobs
GET    /ocr/jobs/:jobId       # Get job details

# Auth
POST   /auth/login            # Get JWT token
POST   /auth/register         # Register new user

# Expenses
GET    /expenses              # List expenses
GET    /expenses?isFromOcr=true  # OCR-created expenses
```
