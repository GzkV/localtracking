# Moon.Time — UI Views

This document inventories every UI view the app needs: the two core views (Dashboard and Calendar), plus the supporting views required by the existing local-first, privacy-first architecture. Each view documents its purpose, key components, user interactions, data displayed/captured, navigation relationships, and relevant existing code and art assets.

## Context

Moon.Time is a local-first PWA (served from [`web/`](../web/)) for period and medication tracking. All data is encrypted client-side (Argon2id via [`web/js/auth-worker.js`](../web/js/auth-worker.js)) and stored in IndexedDB (`keyval-store`) via [`web/js/data-manager.js`](../web/js/data-manager.js). Cycle predictions are computed locally by [`web/js/period-prediction.js`](../web/js/period-prediction.js) (`predict()`, `cycleLengths()`, `median()`), and reminders are handled by [`web/js/notification-manager.js`](../web/js/notification-manager.js). The current UI is a single page ([`web/index.html`](../web/index.html)) whose forms are toggled by [`web/js/main.js`](../web/js/main.js); the views below describe how that functionality maps to discrete screens, whether implemented as separate routes or as in-page view switching.

Art assets live in [`assets-src/werewolf/item-pack/`](../assets-src/werewolf/item-pack/) (source artwork, not yet served; must be copied into `web/` before use). Reusable icon candidates are noted per view.

---

## 1. Dashboard / Home (Logging & Recent History)

**Purpose:** The central landing view after unlock. Primary place to log today's entries (period day, symptoms, medication doses) and glance at recent history and the next-period estimate.

**Key UI components:**
- Header with app logo and profile label (existing `#logo`, `#profile-label`).
- "Today" quick-log card:
  - Period toggle: "Period started today" / "Period ended today" (maps to existing `#period-start` / `#period-end` date inputs, defaulting to today).
  - Symptom checklist/chips (flow intensity, cramps, mood, headache, fatigue, etc.).
  - Medication dose checklist: today's scheduled medications with "taken" checkboxes (data from the existing `#medication-list` model).
- Next-period estimate card (existing `#prediction` / `#prediction-result` section, `aria-live="polite"`).
- Recent history list: last ~7–14 days of entries (existing `#period-list`, extended with symptom/dose entries).
- Privacy note banner (existing `.privacy-note` text).

**User interactions:**
- One-tap logging of period start/end; tap a symptom chip to toggle; tap a medication to mark a dose taken.
- Tap a history item → Entry Detail/Edit view.
- Tap prediction card → Calendar view for full cycle context.
- Pull-to-refresh / re-render on data change (data flows through `data-manager` get/set).

**Data displayed / inputs captured:**
- Displays: prediction summary (estimated date, range, confidence from `predict()`), recent entries, today's scheduled medications.
- Captures: period start/end dates, `exceptional` flag (existing `#period-exceptional`), symptom selections, dose-taken timestamps.

**Navigation relationships:**
- Default route after Login/Unlock. Links to Calendar, Medications, Settings, About/Privacy via nav bar.

**Relevant code/assets:**
- [`web/index.html`](../web/index.html) (`#saved-data`, `#prediction`, `#period-list`), [`web/js/main.js`](../web/js/main.js), [`web/js/data-manager.js`](../web/js/data-manager.js), [`web/js/period-prediction.js`](../web/js/period-prediction.js).
- Icons: `home-icon-cyan.png` / `home-icon-teal.png` (nav), `blood-drop-icon-pink-pale.png` (period log), `potion-drop-icon-peach-lavender.png` (medication dose), `moon-phase-icon-cyan-glow.png` (prediction card).

---

## 2. Calendar (Cycle Predictions)

**Purpose:** Monthly calendar showing recorded period days, symptoms, and medication doses, overlaid with upcoming predictions: next period estimate (date + range), estimated fertile window, and cycle-day indicators.

**Key UI components:**
- Month grid with prev/next month controls (icons: `chevron-left-icon-dark.png`, `chevron-right-icon-slate.png`).
- Day cells with layered markers:
  - Period days (blood-drop marker, e.g. `blood-drop-icon-cyan-pink.png`).
  - Predicted next period span (highlighted range using `predict()` output: `date`, `min`/`max` window, `confidence`).
  - Fertile window estimate (derived from typical cycle length: ~14 days before predicted next period, ±2 days; moon-phase icons such as `moon-icon-full-cyan.png` for estimated ovulation).
  - Symptom/dose dots.
- Legend explaining markers and the confidence label ("low / moderate / higher" from `predict()`).
- Selected-day detail panel (mini version of Entry Detail view).
- Disclaimer: predictions are estimates, not contraception or medical advice (existing `.privacy-note` copy).

**User interactions:**
- Swipe/click to change month; tap a day to view or add an entry for that date; long-press/tap predicted day to see range and confidence.
- Toggle layers (period / fertile window / medications).

**Data displayed / inputs captured:**
- Displays: historical cycles, predicted next period date ± range, fertile window, per-day entries.
- Captures: tapping an empty day can pre-fill the Entry form's date.

**Navigation relationships:**
- Reachable from Dashboard (prediction card, nav bar). Day tap → Entry Detail/Edit; back → Dashboard.

**Relevant code/assets:**
- [`web/js/period-prediction.js`](../web/js/period-prediction.js) (`predict()` returns `{ available, typical, min, max, confidence, date, error }`; exceptional cycles excluded via the `exceptional` flag).
- Icons: `calendar-icon-grid.png`, `calendar-check-icon-cyan.png`, `calendar-wolf-moon-icon.png` (header/nav), moon-phase set (`moon-icon-new.png` … `moon-icon-full.png`) for cycle/fertile indicators.

---

## 3. Onboarding / Profile Creation

**Purpose:** First-run view to create a local encrypted profile (no server account).

**Key components:** profile name input (`#register-profile-name`), secret phrase + confirmation (`#register-password`, `#register-password-confirm`), passphrase generator (`#generate-passphrase-suggestion` with word-count selector, backed by [`web/js/passphrase/random-phrase.js`](../web/js/passphrase/random-phrase.js)), privacy explainer.

**Interactions:** validate name ≥2 chars and phrase ≥12 chars; optional generated passphrase; submit → creates profile via `auth-worker` and lands on Dashboard.

**Data:** captures profile name and secret phrase (never stored in plaintext; Argon2id key info stored per SPECS).

**Navigation:** shown when no profiles exist; links to Restore Backup and About/Privacy.

**Code/assets:** [`web/index.html`](../web/index.html) (`#create-profile`), [`web/js/auth-worker.js`](../web/js/auth-worker.js); icon `user-icon-teal.png`, motif `crescent-star-motif-lavender.png`.

---

## 4. Login / Passphrase Unlock

**Purpose:** Unlock an existing local profile on app launch.

**Key components:** profile selector (`#profile-names`), secret phrase input (`#login-password`), "Create Another Local Profile" button, link to Restore Backup.

**Interactions:** select profile, enter phrase, submit → `auth-worker` verifies against stored `loginChallenge`; failure shows inline error; success → Dashboard.

**Data:** captures secret phrase only; displays saved profile names.

**Navigation:** entry point when profiles exist but session is locked; → Dashboard, Onboarding, Restore Backup.

**Code/assets:** [`web/index.html`](../web/index.html) (`#login`), [`web/js/auth-worker.js`](../web/js/auth-worker.js); icon `moon-icon-crescent-left-bright.png` (lock screen branding).

---

## 5. Medication Management

**Purpose:** CRUD for medications and their schedules (existing `#medications` section, promoted to its own view).

**Key components:** medication list (`#medication-list`) with edit/delete actions; editor form (`#medication-editor`): name, dose, schedule/frequency, start/end dates, notes; feedback line (`#medication-feedback`).

**Interactions:** add new medication; tap list item to edit (populates `#medication-id`); cancel edit (`#cancel-medication-btn`); delete with confirmation.

**Data:** captures name (≤100 chars), dose (≤50), schedule (≤100), start/end dates, notes (≤500); displays current medications and active/inactive status by date range.

**Navigation:** from Dashboard nav; dose logging itself happens on Dashboard/Calendar.

**Code/assets:** [`web/index.html`](../web/index.html) (`#medications`), [`web/js/main.js`](../web/js/main.js); icons `potion-drop-icon-peach-purple.png`, `settings-gear-icon-cyan.png` (edit affordance).

---

## 6. Entry Detail / Edit

**Purpose:** View, correct, or delete a single day's recorded data (period, symptoms, doses).

**Key components:** date header; period start/end editors; `exceptional cycle` checkbox (`#period-exceptional`); symptom editor; dose-taken list; save/delete buttons; undo affordance (icon `undo-icon-left.png`).

**Interactions:** edit fields and save (re-encrypts via `data-manager`); delete entry with confirmation; marking a cycle exceptional excludes it from prediction inputs.

**Data:** displays/captures the full entry record for one date.

**Navigation:** entered from Dashboard history list or Calendar day cell; back returns to origin.

**Code/assets:** [`web/js/data-manager.js`](../web/js/data-manager.js), [`web/js/period-prediction.js`](../web/js/period-prediction.js) (exceptional-flag semantics); icons `calendar-check-icon.png`, `undo-icon-left-alt.png`.

---

## 7. Settings

**Purpose:** Account/security and app preferences.

**Key components:**
- Security: Change Passphrase form (`#change-secure-passphrase`), Logout (`#logout-btn`), Delete Local Profile (`#delete-profile-btn`).
- Backup: Download Encrypted Backup (`#export-backup-btn`), link to Restore Backup.
- Notifications: enable button (`#request-notification-btn`), period reminder days input (`#period-reminder-days`, 0–30), reminder feedback (`#reminder-feedback`).
- Storage persistence notice (`#storage-persistence-notice`).

**Interactions:** change passphrase (re-keys encrypted data via `auth-worker`); export/import JSON backups; request Notification permission and schedule reminders via [`web/js/notification-manager.js`](../web/js/notification-manager.js); destructive actions require confirmation.

**Data:** captures reminder preferences and passphrase changes; displays profile label and storage status.

**Navigation:** from Dashboard nav; → Restore Backup, About, Privacy.

**Code/assets:** [`web/index.html`](../web/index.html), [`web/js/notification-manager.js`](../web/js/notification-manager.js); icons `settings-gear-icon-blue.png`, `bell-icon-gold.png` (reminders), `bell-icon-dark.png` (notifications off state).

---

## 8. Notifications / Reminders (Permission & Banner)

**Purpose:** System-level reminder UX: permission request flow and the in-app notification banner/dialog (existing `#notification-banner`, `role="dialog"`).

**Key components:** permission explainer, enable button, reminder timing configuration (period reminder days before estimate), in-app banner for due reminders with dismiss/snooze.

**Interactions:** grant/deny permission; dismiss or act on a reminder (e.g., "Log period start" deep-link to Dashboard).

**Data:** displays upcoming reminder times derived from `predict().date` minus `period-reminder-days`.

**Navigation:** modal over any view; CTA deep-links to Dashboard or Calendar.

**Code/assets:** [`web/js/notification-manager.js`](../web/js/notification-manager.js), [`web/sw.js`](../web/sw.js) (push/notification click handling); icons `bell-icon-amber.png`, `bell-icon-cyan.png`.

---

## 9. Restore Backup

**Purpose:** Import an encrypted JSON backup into a new or existing profile (existing `#restore-backup` form).

**Key components:** file picker (`#backup-file`, accepts `.json`), backup passphrase input, optional new profile name, warning note that passphrases are not included in backups.

**Interactions:** choose file, enter passphrase, submit → decrypt and merge/restore; errors shown inline.

**Navigation:** from Onboarding, Login, and Settings; success → Dashboard.

**Code/assets:** [`web/index.html`](../web/index.html) (`#restore-backup`), [`web/js/data-manager.js`](../web/js/data-manager.js); icon `undo-icon-diagonal-left.png`.

---

## 10. About & Privacy (existing static pages)

**Purpose:** Public informational pages describing the app's privacy model, local-first storage, and prediction disclaimers.

**Key components:** static content pages [`web/about.html`](../web/about.html) and [`web/privacy.html`](../web/privacy.html), linked from the header nav on every view.

**Interactions:** read-only; links back to Home.

**Navigation:** global footer/header links; reachable without unlocking a profile.

**Code/assets:** [`web/about.html`](../web/about.html), [`web/privacy.html`](../web/privacy.html); branding `wolf-icon-lavender-front.png`, `moonlit-wolf-banner-sprite.png`.

---

## View Inventory Summary

| # | View | Status | Primary code | Key assets |
|---|------|--------|--------------|------------|
| 1 | Dashboard / Home | Partial (in-page `#saved-data`) | `web/js/main.js`, `web/js/data-manager.js` | home, blood-drop, potion-drop icons |
| 2 | Calendar | Not yet implemented | `web/js/period-prediction.js` | calendar, moon-phase, chevron icons |
| 3 | Onboarding / Create Profile | Implemented (`#create-profile`) | `web/js/auth-worker.js` | user icon, crescent-star motif |
| 4 | Login / Unlock | Implemented (`#login`) | `web/js/auth-worker.js` | crescent moon icon |
| 5 | Medication Management | Implemented (`#medications`) | `web/js/main.js` | potion-drop, gear icons |
| 6 | Entry Detail / Edit | Partial (list + delete) | `web/js/data-manager.js` | calendar-check, undo icons |
| 7 | Settings | Partial (buttons in `#saved-data`) | `web/js/notification-manager.js` | gear, bell icons |
| 8 | Notifications / Reminders | Partial (`#notification-banner`) | `web/js/notification-manager.js`, `web/sw.js` | bell icons |
| 9 | Restore Backup | Implemented (`#restore-backup`) | `web/js/data-manager.js` | undo icon |
| 10 | About / Privacy | Implemented (static) | `web/about.html`, `web/privacy.html` | wolf icons, banner sprite |

## Navigation Map

```
                ┌────────────────────┐
                │  About / Privacy   │◄────────────── (global header links, all views)
                └────────────────────┘
                         ▲
   ┌──────────┐    ┌─────┴─────┐    ┌────────────────┐
   │ Onboarding│──►│   Login   │──►│ Restore Backup │
   └────┬─────┘    └─────┬─────┘    └───────┬────────┘
        │                │                  │
        └────────────────┼──────────────────┘
                         ▼
                 ┌───────────────┐
        ┌───────►│  Dashboard /  │◄───────┐
        │        │     Home      │        │
        │        └───┬───┬───┬───┘        │
        │            │   │   │            │
        │     ┌──────┘   │   └──────┐     │
        │     ▼          ▼          ▼     │
        │ ┌────────┐ ┌─────────┐ ┌───────┴───┐
        │ │Calendar│ │Entry    │ │Medication │
        │ └───┬────┘ │Detail/  │ │Management │
        │     │      │Edit     │ └───────────┘
        │     └─────►└─────────┘
        │
        │        ┌───────────┐        ┌──────────────────┐
        └────────│ Settings  │───────►│ Notifications /  │
                 └───────────┘        │ Reminders (modal)│
                                      └──────────────────┘
```

- **Dashboard** is the hub: Calendar, Medications, Settings, and Entry Detail all return to it.
- **Calendar → Entry Detail** via day-cell tap; **Dashboard → Entry Detail** via history-list tap.
- **Onboarding / Login / Restore Backup** form the pre-unlock flow; all converge on Dashboard after successful unlock.
- **Notifications** appear as a modal over any view and deep-link into Dashboard or Calendar.
- **About / Privacy** are reachable globally and require no authentication.
