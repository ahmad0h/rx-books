# RxBooks — task list

`[x]` done · `[ ]` to do. Last updated 9 Oct 2026.

## Phases

1. [x] **Skeleton**: NestJS + MySQL backend and one React / Ant Design frontend, all in Docker, with CI.
2. [x] **Login**: admin and client roles, login page, role-protected consoles, change password, demo users.
3. [x] **Pharmacies**: add and edit pharmacies (name, owner name, phone and email). Each one gets an owner login with the temporary password `123456`.
4. [x] **Chart of accounts**: 46 accounts seeded from the COA reference. Admins add, edit and deactivate accounts.
5. [ ] **Pharmacy accounts**: each pharmacy's real bank and card accounts (bank, type, last 4 digits), linked to a chart-of-accounts code (1010, 2010…).
6. [x] **Rules**: shared and pharmacy rules with add, edit, delete (retire) and restore, plus a test box and save checks. The 69 shared rules are seeded from the pilot sheet; Lakeside has 9 demo rules.
7. [ ] **Transaction upload**: upload a bank CSV, preview, save. Re-uploading the same file must not create duplicates.
8. [ ] **Auto-categorization + review**: rules categorize matching rows. Admins review, approve or fix the rest.
9. [ ] **AI suggestions**: AI suggests an account for rows no rule matches; the admin accepts or changes it.
10. [ ] **Owner questions**: the admin asks the pharmacy owner about unclear rows; the owner answers in the client console.
11. [ ] **Statement matching**: check uploaded transactions against the bank statement totals.
12. [ ] **Trial balance + monthly report**: trial balance, sign-off, monthly package for the owner.
13. [ ] **QuickBooks**: send approved entries to QuickBooks Online.
14. [ ] **Year-end**: year-end package and memo.
15. [ ] **Reminders + history**: email reminders and an audit history of changes.
16. [ ] **Import old data**: move clients, rules and ledgers from the Google Sheet.

## Left out for now (do later)

**Pharmacies and users**
- [ ] Replace the temporary `123456` owner password with invitations or a forced change at first login.
- [ ] Archive or deactivate a pharmacy.
- [ ] Show the pharmacy name in the client console.

**Chart of accounts**
- [ ] Accounts 1030 and 1520 from the reference notes are not seeded (they can be added in the admin screen).

**Rules** (before or during Phase 8)
- [ ] Amount-range rules (PRD 8.2), checked before keyword rules.
- [ ] Keep a version history when a rule is edited.
- [ ] The rest of the PRD 8.4 checks: city / airport codes, 2510 only for always-personal vendors, shared priority band 1300–1410, keyword that is a prefix of another. Let the founder override with a logged reason.
- [ ] Founder vs reviewer permissions (only the founder changes shared rules).
- [ ] Promote a pharmacy rule to a shared rule, with evidence.
- [ ] Add the `QORSHE` contractor rule (left out of the shared seed) to the right pharmacies during the Phase 16 import.
- [ ] Golden test in CI on shared-rule changes; nightly export of rules and the chart of accounts.

**Project**
- [ ] Commit the Rules work (Chart of accounts and Pharmacies are committed).
- [ ] The repo is on a personal GitHub account; the quotation says it should be owned by RxBooks.
- [ ] The frontend bundle is over 500 kB; split it by page later.
