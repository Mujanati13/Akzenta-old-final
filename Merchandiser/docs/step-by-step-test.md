# Step-by-Step Test Plan: VM Registration & Login Flow

## Prerequisites

- Backend running: `npm run start:dev` in `Backend/`
- Frontend running: `npm start` in `Merchandiser/`
- Database seeded: `npm run seed:run:relational` + `npm run seed:german-cities`
- SMTP mail server accessible (check `.env` `MAIL_HOST`)

---

## Test 1: Registration — Personal Info Step

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.1 | Navigate to `/register` | Form loads with 3-step stepper |
| 1.2 | Click country dropdown | List shows all European countries (not just 4) |
| 1.3 | Select "Deutschland" | City field activates |
| 1.4 | **Type partial city name** (e.g. "Ber") | Autocomplete shows suggestions (e.g. "Berlin") |
| 1.5 | Select "Berlin" from suggestions | Field populates; value is numeric ID |
| 1.6 | Clear city, type "MeineStadt" (non-existent) | Autocomplete shows no match; free text is accepted |
| 1.7 | **Phone field** — change country code to `+33` | Dropdown shows French flag/code |
| 1.8 | Enter French phone `612345678` | Validator accepts it (no error) |
| 1.9 | Enter German phone `017612345678` with code `+49` | Validator accepts it |

---

## Test 2: Registration — Complete Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 2.1 | Fill step 1 (name, email, phone with `+49 17612345678`, country=Deutschland, city=Berlin) | Step validates and proceeds |
| 2.2 | Step 2 — select 1+ qualifications | "Nächste" enables |
| 2.3 | Step 3 — enter password (min 6 chars), confirm | Submit button enables |
| 2.4 | Click "Registrierung abschließen" | **API call**: `POST /auth/email/register` |
| 2.5 | Verify request payload in browser devtools | `email` is lowercase; `phone` = `+4917612345678` (code prepended); city sent as `cityId: <number>` if selected, or `cityName: "..."` if free text |
| 2.6 | Success view appears | "Registrierung erfolgreich!" with email message |

---

## Test 3: Confirmation Email

| Step | Action | Expected Result |
|------|--------|-----------------|
| 3.1 | Check the configured mail server inbox | Email from configured sender with subject "Registrierung bestätigen – Akzente" |
| 3.2 | Click "E-Mail bestätigen" button in email | Opens `<merchandiser-domain>/confirm-email?hash=<jwt>` |
| 3.3 | Verify URL domain in email | Points to `MERCHANDISER_FRONTEND_DOMAIN` (NOT `FRONTEND_DOMAIN`) |
| 3.4 | Confirmation page shows spinner, then green checkmark | **API call**: `POST /auth/email/confirm` with `{ hash }` |
| 3.5 | After confirmation, auto-redirect to `/login` | Countdown (10s) then redirect |

---

## Test 4: Login After Confirmation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 4.1 | On `/login`, enter the registered email + password | **API call**: `POST /auth/merchandiser/login` |
| 4.2 | Verify request at backend | `auth.service.ts` → `validateMerchandiserLogin()` → `performLogin()` |
| 4.3 | **Key check**: `user.provider === 'email'` | No longer throws `needLoginViaProvider` |
| 4.4 | Login succeeds, redirects to `/dashboard` | User is authenticated |

---

## Test 5: Password Reset

| Step | Action | Expected Result |
|------|--------|-----------------|
| 5.1 | On `/login`, click "Passwort vergessen?" | Shows email input |
| 5.2 | Enter registered email | **API call**: `POST /auth/forgot/password` with `{ email, userType: 3 }` |
| 5.3 | Check mail server | Reset email received with link to `<domain>/password-change?hash=...` |
| 5.4 | Click link | Opens password change form (not "invalid link") |
| 5.5 | Enter new password, confirm, submit | **API call**: `POST /auth/reset/password` |
| 5.6 | Success view, redirect to `/login` after 2s | Can log in with new password |

---

## Test 6: Edge Cases

| Step | Action | Expected Result |
|------|--------|-----------------|
| 6.1 | Register with duplicate email | Error: "Diese E-Mail-Adresse ist bereits registriert" |
| 6.2 | Login with wrong password | Error: "Das eingegebene Passwort ist falsch" |
| 6.3 | Login before confirming email | Error: "Konto nicht bestätigt" with resend button |
| 6.4 | Register with city as free text (not from dropdown) | City is auto-created in DB (backend `findOrCreateByName`) |
| 6.5 | Phone with French number `+33 612345678` | Validator accepts; stored with `+33` prefix |
| 6.6 | Country dropdown when API fails | Falls back to 20 hardcoded countries |

---

## Test 7: Backend Log Verification

| Step | Command | Expected |
|------|---------|----------|
| 7.1 | Check backend console on startup | No errors |
| 7.2 | Check for warning in auth-cookie.util.ts | If `MERCHANDISER_FRONTEND_DOMAIN` equals `FRONTEND_DOMAIN`, shows: `[Auth] MERCHANDISER_FRONTEND_DOMAIN is not set or equals FRONTEND_DOMAIN...` |
| 7.3 | Register a VM user | Backend log shows user creation with `provider: 'email'` |

---

## Quick Smoke Test

```bash
# 1. Restart backend
cd Backend && npm run start:dev

# 2. Run seeds (if not already done)
npm run seed:run:relational
npm run seed:german-cities

# 3. Start frontend
cd ../Merchandiser && npm start

# 4. Open browser at http://localhost:4200/register
#    Register a new VM user
#    Confirm email
#    Login
#    Reset password
```

---

## Verification Checklist

| # | Fix | Where | How to verify |
|---|-----|-------|---------------|
| 1 | Provider field | Backend | Check backend log during registration; test login (Test 4) |
| 2 | Env config warning | Backend | Check console for warning message (Test 7.2) |
| 3 | City autocomplete | Frontend | Type in city field (Test 1.4-1.6); verify API sends `cityName` for free text (Test 2.5) |
| 4 | More countries | Frontend | Country dropdown shows 20+ countries (Test 1.2) |
| 5 | Password reset | Backend | Complete Test 5 — if login works (Fix #1), password reset works too |
| 6 | Phone country code | Frontend | Phone country code dropdown visible (Test 1.7); international numbers accepted (Test 1.8) |
