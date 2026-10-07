# Release Fix - Step by Step Test Guide

## Overview
This document provides step-by-step testing procedures to verify the one-click release fix for merchandiser reports. The fix allows VMs to release reports in a single action without manually advancing through lifecycle states.

## Prerequisites
- **User:** VM (Visual Merchandiser) account logged in
- **Report:** Assigned report with status ACCEPTED or DRAFT
- **Questions:** At least one mandatory question configured in the project
- **Tools:** Browser DevTools > Network tab open (to inspect API calls)

---

## Test 1: One-Click Release from NOT_STARTED State

### Scenario
VM releases a report that hasn't been started yet (status: ACCEPTED, lifecycle: NOT_STARTED)

### Steps
1. Navigate to an assigned report with **status ACCEPTED** (lifecycle indicator shows "Not Started" as active)
2. Fill in **ALL mandatory questions** with valid answers
3. Scroll to the bottom and click the green **"Speichern und freigeben"** button
4. In the confirmation dialog, click **"Bestätigen"**
5. Wait for the operation to complete

### Expected Results
- ✅ Toast notification: "Report erfolgreich gespeichert und freigegeben!"
- ✅ Lifecycle indicator at the top shows **"Released"** as active (all three dots filled)
- ✅ All form fields become **disabled/read-only**
- ✅ "Speichern und freigeben" button becomes **disabled**
- ✅ In DevTools Network tab, verify the following API calls in sequence:
  1. **PUT** `/api/reports/{id}` with `status: { id: 5 }` (transition to IN_PROGRESS)
  2. **PUT/PATCH** `/api/reports/{id}` with report data (save answers/photos)
  3. **PATCH** `/api/reports/{id}/close` (release/close report)

### Notes
- The auto-advance to IN_PROGRESS happens silently (no toast for that step)
- The entire flow completes in one user action

---

## Test 2: One-Click Release from IN_PROGRESS State

### Scenario
VM releases a report that's already in progress (status: DRAFT/IN_PROGRESS/DUE)

### Steps
1. Navigate to a report with **status DRAFT, IN_PROGRESS, or DUE** (lifecycle shows "In Progress" as active)
2. Fill in ALL mandatory questions
3. Click **"Speichern und freigeben"** → **"Bestätigen"**

### Expected Results
- ✅ Toast: "Report erfolgreich gespeichert und freigegeben!"
- ✅ Lifecycle indicator shows **"Released"**
- ✅ Form becomes read-only
- ✅ In DevTools Network tab, verify:
  - **NO** PUT call to transition to IN_PROGRESS (skipped because already there)
  - Save call and close call execute normally

### Notes
- The auto-advance logic detects the report is already IN_PROGRESS and skips that step
- Existing workflow is preserved

---

## Test 3: Released Lifecycle Dot Click from NOT_STARTED

### Scenario
VM clicks the "Released" lifecycle dot at the top when report is in NOT_STARTED state

### Steps
1. Report in **status ACCEPTED** (lifecycle: NOT_STARTED)
2. Fill in all mandatory questions
3. Click the **"Released" lifecycle dot** at the top of the page (third dot in the indicator)
4. In the confirmation dialog, click **"Bestätigen"**

### Expected Results
- ✅ **"Released" dot is clickable** (not disabled) even from NOT_STARTED
- ✅ Confirmation dialog opens
- ✅ Same success flow as Test 1 (auto-advances to IN_PROGRESS, saves, releases)
- ✅ Toast: "Report erfolgreich gespeichert und freigegeben!"

### Notes
- Previously the Released dot was disabled when reportState !== IN_PROGRESS
- Now it's clickable from NOT_STARTED and handles auto-advance

---

## Test 4: Release Blocked - Mandatory Questions Unanswered

### Scenario
VM attempts to release without completing mandatory questions

### Steps
1. Report in **any editable state** (ACCEPTED, DRAFT, IN_PROGRESS)
2. **Leave at least one mandatory question blank** or unanswered
3. Click **"Speichern und freigeben"** → **"Bestätigen"**

### Expected Results
- ✅ **Error toast:** "Bitte beantworten Sie alle Pflichtfragen: {question list}"
- ✅ Toast duration: 6 seconds
- ✅ Report remains in **editable state** (no status change)
- ✅ Lifecycle indicator **unchanged**
- ✅ No API calls made to advance state or close report
- ✅ "Speichern und freigeben" button remains enabled after dismissing error

### Notes
- Validation happens before any API calls
- VM can fill in the missing questions and retry

---

## Test 5: Release Blocked - Report Already Released

### Scenario
VM attempts to release an already-released report

### Steps
1. Navigate to a report with **status FINISHED, OPENED_BY_CLIENT, or VALID** (lifecycle: RELEASED)
2. Observe the button states

### Expected Results
- ✅ **"Speichern und freigeben" button is disabled** (grayed out)
- ✅ All form fields are **read-only**
- ✅ If somehow clicked (e.g., via browser console), toast warning: "Dieser Bericht ist bereits geschlossen und kann nicht mehr geändert werden"

### Notes
- Read-only reports cannot be edited or re-released

---

## Test 6: Release Blocked - Assignment Not Accepted

### Scenario
VM attempts to release a report that's still in ASSIGNED status (anfrage/request pending)

### Steps
1. Report with **status ASSIGNED** (awaiting VM acceptance)
2. Try clicking **"Speichern und freigeben"**

### Expected Results
- ✅ Button is **disabled**
- ✅ If clicked, toast warning: "Bitte zuerst die Anfrage annehmen oder ablehnen."

### Notes
- VM must first accept the assignment before editing/releasing

---

## Test 7: API Failure on Auto-Advance Step

### Scenario
Simulate network failure during the auto-advance to IN_PROGRESS

### Steps
1. Report in **status ACCEPTED**
2. Fill mandatory questions
3. Open DevTools > Network tab
4. **Block** or simulate failure for PUT `/api/reports/{id}` (e.g., using network throttling or request blocking)
5. Click **"Speichern und freigeben"** → **"Bestätigen"**

### Expected Results
- ✅ **Error toast:** "Status konnte nicht geändert werden"
- ✅ `savingAndApproving` flag resets (button no longer shows spinner)
- ✅ **No subsequent API calls** attempted (save and close are skipped)
- ✅ Report remains in **ACCEPTED/NOT_STARTED** state
- ✅ Form remains **editable**

### Notes
- Error handling prevents cascading failures
- VM can retry after resolving network issues

---

## Test 8: Save Without Release (Gray Button)

### Scenario
VM saves progress without releasing

### Steps
1. Report in any editable state
2. Make changes to answers or upload photos
3. Click the gray **"Speichern"** button (not "Speichern und freigeben")

### Expected Results
- ✅ Toast: "Report saved successfully" (or equivalent)
- ✅ Report status/lifecycle **unchanged**
- ✅ Only the save API call is made (no auto-advance, no close)
- ✅ Form remains **editable**

### Notes
- The auto-advance logic only applies to the release flow, not regular saves

---

## Test 9: Manual Lifecycle Progression (Existing Flow)

### Scenario
VM manually clicks through lifecycle states before releasing

### Steps
1. Report in **status ACCEPTED** (NOT_STARTED)
2. Fill mandatory questions
3. Click the **"In Progress"** lifecycle dot
4. Verify toast: "Bericht wird jetzt bearbeitet"
5. Click the **"Released"** lifecycle dot → **"Bestätigen"**

### Expected Results
- ✅ Step 3 transitions to IN_PROGRESS (toast shown)
- ✅ Step 5 releases the report (no auto-advance needed since already IN_PROGRESS)
- ✅ Manual workflow still works as before

### Notes
- The fix preserves the manual progression workflow
- VMs can still use the dots for step-by-step control

---

## Test 10: Confirmation Dialog Cancellation

### Scenario
VM opens the release confirmation dialog but cancels

### Steps
1. Report in any editable state with mandatory questions filled
2. Click **"Speichern und freigeben"**
3. In the confirmation dialog, click **"Abbrechen"** (Cancel)

### Expected Results
- ✅ Dialog closes
- ✅ **No API calls made**
- ✅ Report status **unchanged**
- ✅ Form remains **editable**
- ✅ Can retry by clicking the button again

---

## Regression Tests

### Test R1: Existing Released Reports
- ✅ Reports released before the fix remain accessible and read-only
- ✅ No data corruption or state issues

### Test R2: Client-Side Report Viewing
- ✅ Clients can still view released reports
- ✅ No impact on the report-detail component (read-only view)

### Test R3: Other Report States
- ✅ Reports in NEW, FINISHED, VALID, etc. behave as before
- ✅ No unintended side effects on non-editable states

---

## Summary Checklist

| Test | Description | Status |
|------|-------------|--------|
| 1 | One-click release from NOT_STARTED | ⬜ |
| 2 | One-click release from IN_PROGRESS | ⬜ |
| 3 | Released dot clickable from NOT_STARTED | ⬜ |
| 4 | Mandatory questions validation | ⬜ |
| 5 | Already released protection | ⬜ |
| 6 | Assignment not accepted protection | ⬜ |
| 7 | Auto-advance API failure handling | ⬜ |
| 8 | Save without release (gray button) | ⬜ |
| 9 | Manual lifecycle progression | ⬜ |
| 10 | Confirmation dialog cancellation | ⬜ |
| R1 | Existing released reports | ⬜ |
| R2 | Client-side viewing | ⬜ |
| R3 | Other report states | ⬜ |

---

## Known Issues / Edge Cases

1. **Concurrent edits:** If two VMs edit the same report simultaneously, last write wins. No locking mechanism.
2. **Large file uploads:** Auto-advance + save + close with many large photos may take time. The `savingAndApproving` spinner shows progress.
3. **Backend validation:** If the backend rejects the close for any reason (e.g., business rules), the error toast shows "Fehler beim Freigeben des Reports."

---

## Developer Notes

- **File:** `src/app/pages/clients/report-edit/report-edit.component.ts`
- **Changes:**
  - Line 2038: `canTransitionTo()` allows RELEASED from NOT_STARTED
  - Line 2268: `confirmSaveAndApprove()` auto-advances to IN_PROGRESS before save+close chain
- **API sequence:** `transitionReportToInProgress()` → `updateReportWithFiles()` → `closeReport()`
- **Error handling:** Each step has independent error handling; failure at any step aborts the chain
