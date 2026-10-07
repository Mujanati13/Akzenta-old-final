# Bug Fix 1 — Missing DataSet Snapshot on Report Open

**Related requirement**: 3.1 — "Load report data set (questions from project definition). If no data set exists: create a new one."

**Problem**: When a merchandiser opened a report, the questions were always read live from `report.project.questions`. This meant that if the project definition was later modified (questions added, removed, or changed), all existing reports that were already in progress would reflect those changes, potentially invalidating partially completed answers.

**Fix**: On report load, the system now checks if a `dataset` object exists on the report. If absent (first time opening), it clones the current project questions and POSTs them to `report/:id/init-dataset` to persist a snapshot. All subsequent question rendering, answer initialization, and answer saving use `reportQuestions` getter which resolves to `dataset.questions ?? project.questions ?? []`. If the backend endpoint is unavailable, it falls back gracefully to `project.questions`.

**Files**: `report.service.ts` (new `initReportDataset` method), `report-edit.component.ts` (dataset init flow in `loadReportDetails`, `initReportDataset`, `finalizeAfterLoad`, `reportQuestions` getter), `report-edit.component.html` (uses `reportQuestions` instead of `report.project.questions`)

---

# Bug Fix 2 — Missing Validation on Required Questions Before Publication

**Related requirement**: 3.2 — "Validation: Required fields must be completed before publication."

**Problem**: The `question.isRequired` flag was displayed visually with a red asterisk (*), but it was never enforced. Both `saveReportPhotos()` and `confirmSaveAndApprove()` allowed saving and releasing the report without checking whether mandatory questions were answered. This meant reports could be marked as "Freigegeben" (Released) with unanswered required fields.

**Fix**: Added `getUnansweredRequiredQuestions()` method that iterates all report questions, checks each `isRequired` flag against the current `questionAnswers` values, and returns a list of unanswered questions. The validation is called at the start of `confirmSaveAndApprove()` — if any required questions are unanswered, the release is blocked and a toast notification lists which questions need answers. Individual validation rules per type: text (non-empty), boolean (true or false), select (non-null), multiselect (non-empty array). The save-only action (`saveReportPhotos`) remains unblocked to allow incremental saving.

**Files**: `report-edit.component.ts` (new `getUnansweredRequiredQuestions()` method, validation check in `confirmSaveAndApprove()`)
