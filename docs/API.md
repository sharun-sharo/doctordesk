# Doctor Desk – API Documentation

Base URL: `/api/v1` (e.g. `http://localhost:5000/api/v1`)

All protected endpoints require header: `Authorization: Bearer <access_token>`

---

## Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Body: `{ "email", "password" }` → `{ user, accessToken, refreshToken }` |
| POST | `/auth/refresh` | Body: `{ "refreshToken" }` → new tokens |
| POST | `/auth/logout` | No body. Invalidates refresh tokens. |
| GET | `/auth/me` | Returns current user (requires auth). |
| POST | `/auth/forgot-password` | Body: `{ "email" }` |
| POST | `/auth/reset-password` | Body: `{ "token", "newPassword" }` |

---

## Dashboard (authenticated, staff)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard/stats` | Total patients, upcoming/today appointments, revenue, last 30 days appointments. |
| GET | `/dashboard/revenue-chart?months=6` | Monthly revenue for charts. |
| GET | `/dashboard/patient-chart?months=6` | New patients per month. |

---

## Users (Super Admin only, except doctors list)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | List users (query: `role_id`, `search`, `page`, `limit`). |
| GET | `/users/doctors` | List active doctors (all staff). |
| GET | `/users/:id` | Get one user. |
| POST | `/users` | Create user. Body: `email`, `password`, `name`, `phone?`, `role_id` (2=Admin, 3=Doctor, 4=Receptionist). |
| PUT | `/users/:id` | Update. Body: `name?`, `phone?`, `is_active?`, `password?`. |
| DELETE | `/users/:id` | Soft delete (deactivate). |

---

## Patients (staff)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/patients` | List. Query: `search`, `gender`, `page`, `limit`. |
| GET | `/patients/:id` | One patient. |
| GET | `/patients/:id/medical-history` | Appointments + prescriptions. |
| POST | `/patients` | Create. Body: `name`, `phone`, `email?`, `date_of_birth?`, `gender?`, `address?`, `blood_group?`, `allergies?`, `medical_notes?`. |
| PUT | `/patients/:id` | Update (same fields). |
| DELETE | `/patients/:id` | Soft delete. |

---

## Appointments (staff)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/appointments` | List. Query: `doctor_id?`, `patient_id?`, `status?`, `date_from?`, `date_to?`, `page`, `limit`. Doctor sees only own. |
| GET | `/appointments/slots` | Query: `doctor_id`, `date` → array of available start times. |
| GET | `/appointments/:id` | One appointment. |
| POST | `/appointments` | Create. Body: `patient_id`, `doctor_id`, `appointment_date`, `start_time`, `end_time?`, `notes?`. |
| PUT | `/appointments/:id` | Update. Body: `appointment_date?`, `start_time?`, `end_time?`, `status?`, `notes?`. |
| DELETE | `/appointments/:id` | Cancel (soft delete + status cancelled). |

---

## Prescriptions (staff)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/prescriptions` | List. Query: `patient_id?`, `doctor_id?`, `page`, `limit`. |
| GET | `/prescriptions/:id` | One prescription. |
| POST | `/prescriptions` | Create. Body: `patient_id`, `doctor_id?` (required if not doctor), `appointment_id?`, `diagnosis?`, `notes?`, `medicines` (array of `{ name, dosage?, duration?, instructions? }`). |
| PUT | `/prescriptions/:id` | Update. Body: `diagnosis?`, `notes?`, `medicines?`. |

---

## Invoices (staff)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/invoices` | List. Query: `patient_id?`, `payment_status?`, `page`, `limit`. Doctor sees only own (via appointment). |
| GET | `/invoices/:id` | One invoice with items. |
| GET | `/invoices/:id/download` | PDF download (same auth). |
| POST | `/invoices` | Create. Body: `patient_id`, `appointment_id?`, `items` (array of `{ item_type?, description?, quantity?, unit_price?, medicine_id? }`), `tax_percent?`, `discount?`. |
| PATCH | `/invoices/:id/payment` | Update payment. Body: `paid_amount`, `payment_status?` (pending|partial|paid). |

---

## Medicines / Inventory (staff)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/medicines` | List. Query: `search?`, `low_stock?` (1), `page`, `limit`. |
| GET | `/medicines/low-stock` | Medicines where quantity ≤ min_stock. |
| GET | `/medicines/:id` | One medicine. |
| POST | `/medicines` | Create. Body: `name`, `generic_name?`, `batch_number?`, `unit?`, `price_per_unit?`, `quantity?`, `min_stock?`, `expiry_date?`. |
| PUT | `/medicines/:id` | Update (no quantity change here). |
| POST | `/medicines/:id/adjust-stock` | Body: `type` (in|out|adjust), `quantity`, `reason?`. |
| DELETE | `/medicines/:id` | Soft delete. |

---

## Reports (staff)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/reports/revenue` | Query: `period?` (daily|monthly), `from?`, `to?`. Doctor = own revenue. |
| GET | `/reports/appointment-summary` | Query: `from?`, `to?`. Count by status. |
| GET | `/reports/doctor-performance` | Query: `from?`, `to?`. **Super Admin only.** Appointments and revenue per doctor. |

---

## Activity (Super Admin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/activity/logs` | Activity logs. Query: `user_id?`, `entity_type?`, `action?`, `page`, `limit`. |
| GET | `/activity/login-history` | Login history. Query: `user_id?`, `page`, `limit`. |

---

## Errors

- `400` – Validation error. Body: `{ success: false, message, errors?: [] }`.
- `401` – Missing or invalid token.
- `403` – Insufficient permissions.
- `404` – Resource not found.
- `429` – Rate limit exceeded.
- `500` – Server error (message only in development).

All JSON responses use `{ success: boolean, message?: string, data?: any }`.
