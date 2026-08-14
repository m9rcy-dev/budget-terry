# Budget Terry V2 — Product & Engineering Plan

**Status:** Draft for review  
**Primary goal:** Build a modern personal budgeting platform for Web, iOS, and Android that makes everyday money tracking simple while providing useful insight into spending, bills, budgets, and savings goals.

---

## 1. Vision

Budget Terry V2 is a personal budgeting application designed to answer four simple questions:

1. Where is my money going?
2. What bills are coming up?
3. Am I staying within my budget?
4. Am I making progress toward my savings goals?

The product should avoid becoming an overly complicated accounting system. It should be fast to use, easy to understand, and useful during a normal payday/budgeting routine.

The same backend and domain model should support:

- Web application
- iOS application
- Android application

The mobile applications will use React Native.

---

# 2. Product Principles

## 2.1 Simplicity first

Common actions should require as few interactions as practical:

- Add expense
- Add income
- View remaining budget
- Record a bill
- Mark a bill as paid
- Contribute toward a goal

## 2.2 Useful information over raw data

The application should turn transactions into useful answers:

- Spending by category
- Spending by period
- Budget remaining
- Upcoming bills
- Savings progress
- Cash-flow overview
- Changes compared with previous periods

## 2.3 Mobile-first, web-friendly

Most daily interactions are expected to happen on mobile.

The web application should be especially useful for:

- Dashboard review
- Monthly planning
- Reporting
- Category/budget management
- Calendar overview
- Account administration

## 2.4 Privacy and security by design

Financial information is sensitive even when the application is not connected directly to a bank.

Security should be considered from the beginning rather than added later.

## 2.5 Resumable development

Development must be structured so an AI coding session or developer can stop after any completed task and resume later without reconstructing previous decisions.

Every implementation phase must leave:

- Working code
- Passing quality gates
- Updated documentation
- Updated project status
- Clear next task

---

# 3. Initial Scope

## Core V2 Features

### Accounts

Allow users to represent where money exists.

Examples:

- Everyday account
- Savings account
- Credit card
- Cash
- Travel savings

Initial accounts may be manually managed.

Future versions can support bank integrations.

---

## Income

Users can record income such as:

- Salary
- Bonus
- Refund
- Interest
- Side income
- Other income

Income fields should include:

- Amount
- Date
- Account
- Category/source
- Notes
- Recurrence

---

## Expenses

Users can record expenses.

Example categories:

- Mortgage / Rent
- Groceries
- Restaurants
- Utilities
- Electricity
- Internet
- Transport
- Fuel
- Insurance
- Health
- Entertainment
- Shopping
- Travel
- Subscriptions
- Miscellaneous

Expense fields:

- Amount
- Date
- Category
- Account
- Merchant/payee
- Notes
- Tags
- Recurring indicator
- Optional linked bill

Users must be able to:

- Add
- Edit
- Delete
- Search
- Filter
- Categorise
- View expense history

---

# 4. Budgeting

Users can create budgets for a period.

Initial supported periods:

- Weekly
- Fortnightly
- Monthly

A budget may apply to:

- Overall spending
- Individual category
- Multiple selected categories

Example:

```text
Monthly Budget

Groceries       $800
Dining          $250
Fuel            $300
Entertainment   $150
Shopping        $300
```

Budget Terry should display:

```text
Groceries

Budget:     $800
Spent:      $615
Remaining:  $185
Used:       76.9%
```

Visual states can indicate:

- Healthy
- Approaching limit
- Over budget

The exact thresholds should eventually be configurable.

---

# 5. Bills

Bills represent known or expected payments.

Examples:

- Electricity
- Mortgage
- Insurance
- Internet
- Phone
- Netflix
- Rates
- Car registration

Bill fields:

- Name
- Amount
- Due date
- Category
- Account
- Recurrence
- Auto-pay indicator
- Notes
- Payment status

Statuses:

```text
UPCOMING
DUE_SOON
DUE_TODAY
OVERDUE
PAID
SKIPPED
```

---

# 6. Bills Calendar

Provide calendar views showing upcoming financial obligations.

Supported views:

- Month
- Week
- Agenda/list

Calendar entries should visually distinguish:

- Paid bills
- Upcoming bills
- Overdue bills
- Expected income
- Optional savings contributions

Selecting an entry should open its details.

Example:

```text
August 2026

12 Aug
    Electricity     $184

15 Aug
    Salary        +$4,100
    Mortgage       $1,250

18 Aug
    Internet          $85

24 Aug
    Insurance        $143
```

Future enhancement:

- Push reminders
- Email reminders
- Local mobile notifications

---

# 7. Savings Goals

Users can create savings goals.

Examples:

- Japan holiday
- Emergency fund
- New car
- House deposit
- Christmas
- New computer

Goal fields:

- Name
- Target amount
- Current saved amount
- Target date
- Contribution schedule
- Preferred contribution
- Account
- Notes

Example:

```text
Japan Holiday

Target:         $8,000
Saved:          $3,250
Remaining:      $4,750
Progress:       40.6%
Target date:    Oct 2027
```

---

# 8. Payday Contributions

A key feature should allow a user to allocate money toward goals every payday.

Example:

```text
Fortnightly Pay: $4,100

Emergency Fund      $200
Japan Holiday       $250
Car Maintenance      $50
--------------------------------
Goals Allocation    $500
```

The application should support:

- Manual contribution
- Suggested contribution
- Recurring contribution rule

Future capability:

```text
Whenever salary is received:
    $250 -> Travel
    $200 -> Emergency Fund
    $50  -> Car Maintenance
```

Automated bank transfers are outside the initial scope.

---

# 9. Dashboard

The dashboard is the primary application screen.

It should answer:

```text
How much came in?
How much went out?
What is left?
Where did it go?
What bills are coming?
How are my goals progressing?
```

Suggested dashboard components:

### Current Period

```text
Income          $8,200
Expenses        $5,440
Savings           $900
Remaining       $1,860
```

### Spending Breakdown

Example:

```text
Housing         35%
Food            18%
Transport       11%
Utilities        9%
Shopping         8%
Entertainment    6%
Other           13%
```

### Budget Status

Show categories approaching or exceeding budget.

### Upcoming Bills

Show the next 3–5 bills.

### Goals

Show progress for active savings goals.

### Spending Trend

Compare:

- Current month
- Previous month
- Average

---

# 10. Reporting and Analytics

Initial reports:

- Spending by category
- Spending by month
- Income vs expenses
- Budget vs actual
- Savings contributions
- Goal progress
- Recurring expense summary
- Highest expense categories

Filters:

- Date range
- Account
- Category
- Tag

Charts should help interpretation rather than merely decorate the UI.

---

# 11. Recommended Technology Stack

## Language Recommendation

Use **TypeScript** rather than untyped JavaScript.

Although the ecosystem remains JavaScript, TypeScript provides compile-time checking and makes shared contracts significantly safer across:

- Web
- Mobile
- Backend
- Shared libraries

Preferred:

```text
TypeScript
```

rather than:

```text
JavaScript
```

---

# 12. Frontend — Web

Recommended:

```text
Next.js
React
TypeScript
```

Use the modern Next.js App Router.

Supporting libraries should be kept minimal and introduced only when required.

Possible choices:

```text
TanStack Query       server-state/data fetching
React Hook Form      forms
Zod                  validation
Recharts             charts
date-fns             dates
```

UI options:

```text
Tailwind CSS
+
a small component system
```

Potential component systems:

- shadcn/ui
- Radix primitives
- custom Budget Terry design system

Avoid coupling business logic directly to UI components.

---

# 13. Mobile

Recommended:

```text
React Native
TypeScript
Expo
```

Targets:

```text
iOS
Android
```

Expo should be preferred unless a requirement later demands unsupported native functionality.

Possible libraries:

```text
Expo Router
TanStack Query
React Hook Form
Zod
SecureStore
```

Mobile-specific features may later include:

- Face ID / Touch ID / biometrics
- Push notifications
- Offline transaction entry
- Camera receipt capture

---

# 14. Backend Decision

Two viable approaches are being considered.

---

## Option A — Node.js / NestJS

Recommended initial choice.

Stack:

```text
Node.js
NestJS
TypeScript
PostgreSQL
Prisma ORM
```

Advantages:

- Same language across entire product
- Shared TypeScript models/types
- Good modular structure
- Dependency injection
- Guards/interceptors/middleware
- Strong testing conventions
- Natural fit for REST APIs
- Familiar layered architecture
- Easier context switching between web/mobile/backend

Potential structure:

```text
Controller
    ↓
Application Service
    ↓
Domain
    ↓
Repository
    ↓
PostgreSQL
```

Recommended for Budget Terry V2.

---

## Option B — Python / FastAPI

Alternative stack:

```text
Python
FastAPI
SQLAlchemy
Alembic
PostgreSQL
Pydantic
```

Advantages:

- Very clean API development
- Excellent data-processing ecosystem
- Good fit if analytics, forecasting, or AI becomes important
- Strong typing through Python annotations/Pydantic
- Excellent pytest ecosystem

Trade-off:

The project will use two primary languages:

```text
TypeScript
Python
```

This introduces some duplication around DTOs/contracts.

---

# 15. Backend Decision ADR

Before backend implementation begins, create:

```text
docs/adr/ADR-001-backend-language.md
```

The ADR should compare:

```text
NestJS
vs
FastAPI
```

Decision criteria:

| Criterion              |     Weight |
| ---------------------- | ---------: |
| Development speed      |       High |
| Maintainability        |       High |
| Testing                |       High |
| Shared contracts       |       High |
| Mobile/web integration |       High |
| Analytics capability   |     Medium |
| Developer familiarity  |     Medium |
| Deployment simplicity  |     Medium |
| Runtime performance    | Low/Medium |

Initial recommendation:

```text
NestJS + TypeScript
```

The architecture described in this plan should remain applicable if FastAPI is selected instead.

---

# 16. Database

Recommended:

```text
PostgreSQL
```

Reasons:

- Mature relational database
- Strong transaction semantics
- Excellent reporting/querying
- JSON support when appropriate
- Portable deployment
- Good tooling

Money must NEVER be stored using floating point.

Preferred representation:

```text
DECIMAL / NUMERIC
```

or integer minor units where appropriate.

Example:

```text
NZD 12.34

amount_minor = 1234
currency = NZD
```

A clear project-wide money representation must be selected early and documented.

---

# 17. Core Data Model

Initial entities:

```text
User

Account
Category

Transaction
    Income
    Expense

Budget
BudgetCategory

Bill
BillOccurrence

SavingsGoal
GoalContribution

RecurringRule

Tag
TransactionTag
```

Potential later entities:

```text
Household
HouseholdMember

BankConnection
ImportedTransaction

Notification
Receipt

AuditEvent
```

---

# 18. Transaction Model

Prefer a generalized transaction model.

```text
Transaction

id
userId
accountId

type
    INCOME
    EXPENSE
    TRANSFER

amount
currency

transactionDate
categoryId

merchant
description

createdAt
updatedAt
```

Transfers should eventually be represented as linked transactions or a dedicated transfer model so that moving money between accounts is not incorrectly counted as spending.

---

# 19. Bill Occurrences

Do not rely only on a recurring bill definition.

Separate:

```text
Bill
```

from:

```text
BillOccurrence
```

Example:

```text
Bill
Electricity
Monthly

BillOccurrence
2026-08-12
$184
PAID
```

This allows an individual payment to differ from its normal recurring amount.

---

# 20. Authentication

Initial approach:

```text
Email + Password
```

Recommended future support:

```text
Passkeys
Apple Sign In
Google Sign In
```

Session strategy may use:

```text
short-lived access token
+
refresh/session token
```

For the web application, prefer secure HTTP-only cookies where appropriate.

For mobile, sensitive tokens should use secure platform storage.

---

# 21. API Style

Start with REST.

Example:

```text
/api/v1/accounts
/api/v1/transactions
/api/v1/categories
/api/v1/budgets
/api/v1/bills
/api/v1/goals
/api/v1/reports
```

Example endpoints:

```text
POST   /api/v1/transactions
GET    /api/v1/transactions
GET    /api/v1/transactions/:id
PATCH  /api/v1/transactions/:id
DELETE /api/v1/transactions/:id
```

Use OpenAPI documentation.

---

# 22. Monorepo

Recommended project organization:

```text
budget-terry-v2/
│
├── apps/
│   ├── web/
│   ├── mobile/
│   └── api/
│
├── packages/
│   ├── domain/
│   ├── api-client/
│   ├── validation/
│   ├── types/
│   ├── config/
│   └── ui/
│
├── docs/
│   ├── architecture/
│   ├── adr/
│   ├── api/
│   ├── product/
│   └── development/
│
├── scripts/
│
├── docker/
│
├── .github/
│   └── workflows/
│
├── README.md
├── AGENTS.md
├── CONTRIBUTING.md
├── CHANGELOG.md
├── PROJECT_STATUS.md
├── ROADMAP.md
└── package.json
```

Possible monorepo tools:

```text
pnpm workspaces
+
Turborepo
```

Nx is also valid but may add unnecessary complexity initially.

---

# 23. Shared Packages

## packages/types

Shared TypeScript types.

Example:

```ts
export interface Expense {
  id: string;
  amount: number;
  categoryId: string;
  transactionDate: string;
}
```

Avoid blindly sharing persistence models with frontend clients.

Prefer explicit API contracts.

---

## packages/validation

Shared Zod validation where appropriate.

Example:

```text
CreateExpenseSchema
CreateGoalSchema
CreateBillSchema
```

---

## packages/api-client

Generated or maintained typed API client.

Preferred long-term flow:

```text
OpenAPI
     ↓
generated TypeScript client
     ↓
Web + React Native
```

This reduces duplicated request/response models.

---

## packages/ui

Only put genuinely reusable presentation primitives here.

Do not force web and React Native to share components when platform behavior differs.

---

# 24. Backend Architecture

Use modular architecture.

Example:

```text
src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── accounts/
│   ├── transactions/
│   ├── categories/
│   ├── budgets/
│   ├── bills/
│   ├── goals/
│   └── reports/
│
├── common/
├── config/
├── database/
└── main.ts
```

Inside a module:

```text
transactions/
├── domain/
├── application/
├── infrastructure/
├── presentation/
└── tests/
```

Do not introduce excessive Clean Architecture boilerplate prematurely.

The primary objective is separation of concerns, not the number of folders.

---

# 25. Clean Code Rules

Code should prioritize:

```text
Readable
Simple
Testable
Predictable
Small
Explicit
```

Rules:

- Functions should have one clear responsibility.
- Prefer descriptive names.
- Avoid hidden side effects.
- Avoid unnecessary abstractions.
- Avoid premature optimization.
- Avoid generic utility dumping grounds.
- Keep domain rules independent from HTTP/controller concerns.
- Keep database access outside controllers.
- Avoid business logic inside React components.
- Validate input at system boundaries.
- Treat lint warnings seriously.
- Delete dead code.
- Prefer composition over inheritance.
- Do not duplicate domain rules across clients.
- Keep methods short enough to understand easily.
- Comments should explain **why**, not restate obvious code.

---

# 26. Method and API Documentation

Public or non-obvious methods must be documented.

Documentation should explain:

```text
Purpose
Inputs
Outputs
Errors
Important side effects
Important business rules
```

Do not add meaningless comments such as:

```ts
// Gets the account
getAccount();
```

Prefer documentation where context is needed:

```ts
/**
 * Returns the user's available balance after reserving
 * allocations required for unpaid bills in the selected period.
 */
```

---

# 27. README Requirements

The root README must always remain usable.

It should include:

```text
# Budget Terry V2

Overview

Architecture summary

Prerequisites

Repository structure

Local development setup

Environment configuration

Database setup

How to run API

How to run Web

How to run iOS

How to run Android

How to run tests

How to run integration tests

How to run lint

How to run formatter

How to run type checking

How to run the complete quality gate

How to create database migrations

Troubleshooting

Contributing
```

Each app may also have its own README.

Example:

```text
apps/api/README.md
apps/web/README.md
apps/mobile/README.md
```

---

# 28. Documentation Structure

```text
docs/
├── architecture/
│   ├── overview.md
│   ├── backend.md
│   ├── frontend.md
│   ├── mobile.md
│   ├── data-model.md
│   └── security.md
│
├── adr/
│   ├── ADR-001-backend-language.md
│   ├── ADR-002-database.md
│   └── ADR-003-authentication.md
│
├── product/
│   ├── requirements.md
│   ├── user-stories.md
│   └── terminology.md
│
├── development/
│   ├── setup.md
│   ├── testing.md
│   ├── quality-gates.md
│   └── release-process.md
│
└── api/
    └── overview.md
```

---

# 29. Testing Strategy

Testing is mandatory.

The project should contain:

```text
Unit tests
Integration tests
API tests
UI/component tests
End-to-end tests
```

Testing should follow the testing pyramid.

---

# 30. Unit Tests

Unit tests should cover domain/business logic heavily.

Examples:

```text
Budget calculation
Remaining budget
Goal progress
Recurring bill generation
Bill status
Category totals
Income vs expense calculations
Date period boundaries
Transfer handling
Currency validation
```

Example:

```text
Given:
Budget = $500
Expenses = $325

Expect:
Remaining = $175
Usage = 65%
```

---

# 31. Integration Tests

Integration tests should verify components working together.

Examples:

```text
API + PostgreSQL

Create transaction
    ↓
persist
    ↓
query
    ↓
correct response
```

Tests should cover:

- Database migrations
- Repository behavior
- Transactions
- Constraints
- Authentication
- API validation
- Recurring bill creation

Use a real PostgreSQL instance for important integration tests.

Recommended:

```text
Testcontainers
```

---

# 32. API Tests

Every important endpoint requires:

```text
Successful request
Validation failure
Authentication failure
Authorization failure
Not found
Conflict where applicable
Persistence verification
```

---

# 33. Web Tests

Suggested tools:

```text
Vitest/Jest
React Testing Library
Playwright
```

Component tests should focus on user-visible behavior.

Avoid testing implementation details.

---

# 34. Mobile Tests

Suggested:

```text
Jest
React Native Testing Library
```

Later add mobile E2E using one selected framework after the application architecture stabilizes.

---

# 35. End-to-End Critical Journeys

At minimum automate these critical journeys:

### Expense

```text
Login
→ Add expense
→ Expense appears in transaction history
→ Dashboard total changes
→ Category total changes
```

### Budget

```text
Create monthly budget
→ Add expenses
→ Remaining budget recalculates
```

### Bill

```text
Create recurring bill
→ Bill appears in calendar
→ Mark paid
→ Status changes
```

### Goal

```text
Create savings goal
→ Add contribution
→ Progress updates
```

---

# 36. Quality Gate

No task is considered complete unless the quality gate passes.

Recommended command:

```bash
pnpm quality
```

It should execute:

```text
format-check
lint
typecheck
unit-test
integration-test
build
```

Potential script:

```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:integration": "...",
    "build": "turbo run build",
    "quality": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm build"
  }
}
```

Exact commands should evolve with the project.

---

# 37. Definition of Done

Every implementation task is complete only when:

- [ ] Acceptance criteria are satisfied.
- [ ] Code follows project conventions.
- [ ] Unit tests exist where applicable.
- [ ] Integration tests exist where applicable.
- [ ] Existing tests still pass.
- [ ] Linter passes.
- [ ] Formatter check passes.
- [ ] Type checking passes.
- [ ] Application builds.
- [ ] Documentation is updated.
- [ ] PROJECT_STATUS.md is updated.
- [ ] No known blocker is hidden.
- [ ] Quality gate passes.

---

# 38. Continuous Integration

Use GitHub Actions or equivalent CI.

Pipeline:

```text
Checkout
   ↓
Install
   ↓
Formatting Check
   ↓
Lint
   ↓
Type Check
   ↓
Unit Tests
   ↓
Integration Tests
   ↓
Build
   ↓
E2E where appropriate
```

Pull requests must not merge when required checks fail.

---

# 39. Security Baseline

At minimum:

- Password hashing using a proven password hashing algorithm/library
- Strong authentication/session handling
- TLS in production
- Secure token storage
- Secure cookie configuration
- CSRF consideration for cookie-authenticated web flows
- Input validation
- Output sanitisation where applicable
- Rate limiting for sensitive endpoints
- Secrets only through environment/secret management
- No secrets committed to Git
- Dependency vulnerability scanning
- Authorization checks on every user-owned resource
- Audit/security logging where valuable

Critical rule:

```text
A user must never be able to retrieve another user's financial records.
```

Integration tests should explicitly test this.

---

# 40. Observability

Use structured logging.

Recommended request context:

```text
correlationId
userId where safe
requestPath
statusCode
duration
```

Never log:

```text
passwords
auth tokens
sensitive secrets
full financial payloads unnecessarily
```

Later introduce:

- Metrics
- Error tracking
- Health endpoints
- Performance monitoring

---

# 41. Configuration

Use environment-specific configuration.

Example:

```text
.env.example
```

Never commit:

```text
.env
production secrets
private keys
tokens
```

Example:

```env
DATABASE_URL=
AUTH_SECRET=
API_PORT=
LOG_LEVEL=
```

Startup should validate required configuration.

---

# 42. Local Development

Target experience:

```bash
git clone ...
cd budget-terry-v2
pnpm install
docker compose up -d
pnpm db:migrate
pnpm dev
```

Docker Compose should initially provide:

```text
PostgreSQL
```

Potential later additions:

```text
Redis
Mailpit
```

Only add infrastructure when requirements justify it.

---

# 43. Resumable Development Protocol

This section is mandatory for AI-assisted implementation.

The project must always expose its current state through files rather than relying on chat history.

Core files:

```text
PLAN.md
ROADMAP.md
PROJECT_STATUS.md
AGENTS.md
CHANGELOG.md
```

---

# 44. PROJECT_STATUS.md

This is the primary resume file.

Required template:

````markdown
# Project Status

Last Updated:
Current Phase:
Current Task:

## Completed

- ...

## In Progress

- ...

## Next Task

- ...

## Known Issues

- ...

## Decisions Made

- ...

## Commands Verified

```bash
pnpm quality
```
````

## Last Quality Gate

PASS / FAIL

## Resume Instructions

1. Read PLAN.md.
2. Read PROJECT_STATUS.md.
3. Read recent ADRs.
4. Run git status.
5. Run the relevant tests.
6. Continue with the Next Task.

````

Update this file at the end of every implementation session.

---

# 45. Session Handoff File

For long tasks, optionally create:

```text
docs/development/session-handoff.md
````

Template:

```markdown
# Session Handoff

## Objective

...

## Work Completed

...

## Files Changed

...

## Tests Added

...

## Tests Run

...

## Current Failure

...

## Important Context

...

## Exact Next Step

...

## Suggested Next Prompt

...
```

The final section makes continuation particularly easy for another AI session.

---

# 46. Task Structure

Tasks should be small enough to complete within one coding session whenever possible.

Avoid:

```text
Implement budgeting
```

Prefer:

```text
BUD-021 Add budget database schema

BUD-022 Add create-budget endpoint

BUD-023 Add budget calculation service

BUD-024 Add budget unit tests

BUD-025 Add budget API integration tests

BUD-026 Add budget web screen
```

Each task should have:

```text
ID
Title
Objective
Scope
Out of Scope
Acceptance Criteria
Tests Required
Documentation Required
Dependencies
```

---

# 47. AGENTS.md

Create an AI/developer instruction file in repository root.

It should instruct agents to:

1. Read `PLAN.md`.
2. Read `PROJECT_STATUS.md`.
3. Read relevant ADRs.
4. Inspect existing implementation before coding.
5. Do not rewrite working architecture without justification.
6. Implement only the requested task.
7. Add/update tests.
8. Run the quality gate.
9. Update documentation.
10. Update `PROJECT_STATUS.md`.
11. Leave the repository resumable.
12. Never claim tests passed unless they were actually executed.
13. Record blockers explicitly.
14. Avoid unrelated refactoring.

---

# 48. Git Strategy

Keep the strategy simple.

```text
main
  |
  +-- feature/BUD-xxx-description
```

Each branch should correspond to a focused feature/task.

Commit examples:

```text
feat(budget): add monthly budget creation
fix(bills): correct overdue status calculation
test(goals): add contribution integration tests
docs(api): document transaction endpoint
```

Prefer conventional commits.

---

# 49. API Versioning

Start:

```text
/api/v1
```

Do not create V2 until an actual breaking API requirement exists.

---

# 50. Error Model

Use a consistent API error format.

Example:

```json
{
  "code": "BUDGET_NOT_FOUND",
  "message": "Budget was not found.",
  "correlationId": "..."
}
```

Validation may include field errors.

Clients should not depend on arbitrary backend exception text.

---

# 51. Date and Time Rules

Financial applications often fail around dates.

Define these rules explicitly:

- Store timestamps consistently.
- Preserve user timezone preferences.
- Bills use user-local due dates.
- Budget periods are evaluated in user-local timezone.
- Never infer timezone silently.
- Clearly distinguish a date from a timestamp.

Tests must include month boundaries and daylight-saving changes.

---

# 52. Currency

Initial product may default to:

```text
NZD
```

but the data model should store currency explicitly.

Do not implement full multi-currency conversion in MVP unless required.

Future:

```text
NZD
AUD
USD
EUR
...
```

Transfers between currencies will require exchange-rate handling and should be a separate feature.

---

# 53. UX Navigation

Suggested web navigation:

```text
Dashboard
Transactions
Budgets
Bills
Calendar
Goals
Reports
Accounts
Settings
```

Suggested mobile tabs:

```text
Home
Transactions
+
Calendar
Goals
```

The centre action can provide quick entry:

```text
Add Expense
Add Income
Add Bill
Add Contribution
```

---

# 54. Accessibility

Web and mobile should consider:

- Screen readers
- Semantic labels
- Keyboard navigation on web
- Sufficient contrast
- Dynamic font scaling
- Large touch targets
- Avoid communicating state by colour alone

Accessibility checks should become part of UI quality reviews.

---

# 55. Performance

Initial targets:

- Dashboard should feel immediate.
- Paginate large transaction histories.
- Avoid retrieving all transactions for every report.
- Aggregate reporting server-side where appropriate.
- Add database indexes based on actual queries.
- Avoid premature caching.

Likely useful indexes:

```text
transaction(user_id, transaction_date)
transaction(user_id, category_id, transaction_date)
bill_occurrence(user_id, due_date)
goal(user_id, status)
```

Validate actual query plans before adding excessive indexes.

---

# 56. Offline Mobile — Later Phase

Potential later capability:

```text
User adds expense while offline
        ↓
stored locally
        ↓
network restored
        ↓
sync API
```

This requires:

- Local persistence
- Sync state
- Conflict handling
- Idempotency

Do not add this complexity to the MVP unless necessary.

---

# 57. Notifications — Later Phase

Notification examples:

```text
Electricity bill due tomorrow
Dining budget is 90% used
Travel goal reached 75%
Payday contribution due
```

Channels:

```text
Push
In-app
Email
```

Notification preference management will be required.

---

# 58. Future Bank Integration

Not part of initial V2.

Possible future flow:

```text
Bank
   ↓
Open Banking Provider
   ↓
Imported transaction
   ↓
Auto categorisation
   ↓
User confirmation
```

Keep manual transactions first so Budget Terry remains useful without any banking integration.

---

# 59. Future Smart Features

Possible later enhancements:

### Automatic categorisation

```text
Countdown → Groceries
BP → Fuel
Netflix → Entertainment
```

### Spending anomaly detection

```text
Your electricity bill is 34% higher than usual.
```

### Forecasting

```text
At current spending, your available discretionary balance
at the end of the month is estimated at $740.
```

### Goal recommendations

```text
To reach Japan Holiday by October 2027:
Save approximately $294 per fortnight.
```

These features should be implemented only after trustworthy base financial data exists.

---

# 60. Development Roadmap

Each phase should end with:

```text
working code
+
tests
+
documentation
+
passing quality gate
+
PROJECT_STATUS update
```

---

## Phase 0 — Product and Architecture

Tasks:

- [ ] Review this plan.
- [ ] Confirm MVP scope.
- [ ] Confirm TypeScript usage.
- [ ] Decide NestJS vs FastAPI.
- [ ] Create ADR-001 backend decision.
- [ ] Confirm PostgreSQL.
- [ ] Decide money representation.
- [ ] Decide authentication approach.
- [ ] Create initial UX wireframes.
- [ ] Define terminology.
- [ ] Create initial data model.

Deliverable:

```text
Approved architecture baseline
```

---

## Phase 1 — Repository Bootstrap

Tasks:

- [ ] Create monorepo.
- [ ] Configure pnpm.
- [ ] Configure Turborepo.
- [ ] Create web app.
- [ ] Create mobile app.
- [ ] Create API app.
- [ ] Create shared packages.
- [ ] Configure TypeScript.
- [ ] Configure ESLint.
- [ ] Configure Prettier.
- [ ] Configure test framework.
- [ ] Configure Docker Compose/PostgreSQL.
- [ ] Add root scripts.
- [ ] Add README.
- [ ] Add AGENTS.md.
- [ ] Add PROJECT_STATUS.md.
- [ ] Add CI workflow.

Exit criteria:

```text
pnpm quality
```

passes on an application skeleton.

---

## Phase 2 — Database Foundation

Tasks:

- [ ] Database client setup.
- [ ] Migration framework.
- [ ] User schema.
- [ ] Account schema.
- [ ] Category schema.
- [ ] Transaction schema.
- [ ] Bill schema.
- [ ] Bill occurrence schema.
- [ ] Budget schema.
- [ ] Goal schema.
- [ ] Goal contribution schema.
- [ ] Seed default categories.
- [ ] Integration-test database setup.

Exit criteria:

- Migrations work from empty PostgreSQL.
- Integration tests can create/drop isolated test data.
- Database documentation is complete.

---

## Phase 3 — Authentication

Tasks:

- [ ] Register.
- [ ] Login.
- [ ] Logout.
- [ ] Session/token management.
- [ ] Password hashing.
- [ ] Auth middleware/guard.
- [ ] Current-user endpoint.
- [ ] Web login.
- [ ] Mobile login.
- [ ] Authorization integration tests.

Critical test:

```text
User A cannot access User B data.
```

---

## Phase 4 — Accounts and Categories

Tasks:

- [ ] Create account.
- [ ] Edit account.
- [ ] Archive account.
- [ ] List accounts.
- [ ] Default categories.
- [ ] Custom categories.
- [ ] Account/category web UI.
- [ ] Account/category mobile UI.
- [ ] Unit/integration tests.

---

## Phase 5 — Transactions

Tasks:

- [ ] Create expense.
- [ ] Create income.
- [ ] Edit transaction.
- [ ] Delete transaction.
- [ ] Transaction listing.
- [ ] Pagination.
- [ ] Filters.
- [ ] Search.
- [ ] Category totals.
- [ ] Web transaction UI.
- [ ] Mobile quick expense.
- [ ] API tests.
- [ ] E2E transaction journey.

This is the first milestone where the product becomes genuinely useful.

---

## Phase 6 — Dashboard V1

Tasks:

- [ ] Current-period income.
- [ ] Current-period expenses.
- [ ] Net balance.
- [ ] Spending by category.
- [ ] Recent transactions.
- [ ] Dashboard API aggregation.
- [ ] Web dashboard.
- [ ] Mobile dashboard.
- [ ] Dashboard tests.

---

## Phase 7 — Budgets

Tasks:

- [ ] Create budget.
- [ ] Category budget allocation.
- [ ] Edit budget.
- [ ] Budget-period calculation.
- [ ] Spending against budget.
- [ ] Remaining amount.
- [ ] Percentage used.
- [ ] Budget warnings.
- [ ] Web budget UI.
- [ ] Mobile budget UI.
- [ ] Budget tests.
- [ ] Budget E2E journey.

---

## Phase 8 — Bills

Tasks:

- [ ] Create one-off bill.
- [ ] Create recurring bill.
- [ ] Generate bill occurrences.
- [ ] Mark bill paid.
- [ ] Mark bill skipped.
- [ ] Detect overdue bill.
- [ ] Link bill payment to transaction.
- [ ] Bill list.
- [ ] Web bill UI.
- [ ] Mobile bill UI.
- [ ] Recurrence tests.
- [ ] Integration tests.

---

## Phase 9 — Calendar

Tasks:

- [ ] Calendar API.
- [ ] Monthly view.
- [ ] Weekly view.
- [ ] Agenda view.
- [ ] Bill indicators.
- [ ] Income indicators.
- [ ] Paid/unpaid state.
- [ ] Calendar detail interaction.
- [ ] Web calendar.
- [ ] Mobile calendar.
- [ ] Calendar tests.

---

## Phase 10 — Savings Goals

Tasks:

- [ ] Create goal.
- [ ] Edit goal.
- [ ] Archive/complete goal.
- [ ] Add contribution.
- [ ] Contribution history.
- [ ] Goal progress.
- [ ] Remaining target.
- [ ] Required contribution calculation.
- [ ] Payday contribution rules.
- [ ] Goal web UI.
- [ ] Goal mobile UI.
- [ ] Goal tests.
- [ ] E2E goal journey.

---

## Phase 11 — Analytics

Tasks:

- [ ] Spending-by-category report.
- [ ] Spending trend.
- [ ] Budget vs actual.
- [ ] Income vs expenses.
- [ ] Recurring expense report.
- [ ] Goal contribution report.
- [ ] Date filters.
- [ ] Account/category filters.
- [ ] Charts.
- [ ] Reporting performance tests.

---

## Phase 12 — UX Polish

Tasks:

- [ ] Responsive review.
- [ ] Mobile UX review.
- [ ] Loading states.
- [ ] Empty states.
- [ ] Error states.
- [ ] Accessibility review.
- [ ] Form consistency.
- [ ] Navigation consistency.
- [ ] Design tokens.
- [ ] Dark mode decision.
- [ ] Performance review.

---

## Phase 13 — Security Hardening

Tasks:

- [ ] Threat model.
- [ ] Auth security review.
- [ ] Authorization tests.
- [ ] Dependency scan.
- [ ] Secret scan.
- [ ] Rate limiting.
- [ ] Security headers.
- [ ] Session expiration.
- [ ] Logging review.
- [ ] Sensitive-data review.
- [ ] Backup/restore strategy.

---

## Phase 14 — Deployment

Targets:

```text
Web
API
PostgreSQL
iOS
Android
```

Tasks:

- [ ] Development environment.
- [ ] Test/staging environment.
- [ ] Production environment.
- [ ] Database backups.
- [ ] Migration deployment strategy.
- [ ] API health checks.
- [ ] Web deployment.
- [ ] Mobile build pipeline.
- [ ] Apple App Store setup.
- [ ] Google Play setup.
- [ ] Release documentation.

---

# 61. MVP Boundary

Recommended MVP:

```text
Authentication
Accounts
Categories
Income
Expenses
Dashboard
Budgets
Bills
Calendar
Savings Goals
Basic reports
```

Not required for MVP:

```text
Bank integration
AI categorisation
Receipt OCR
Shared household budgets
Multi-currency conversion
Investment tracking
Open Banking
Advanced forecasting
Offline sync
```

Keeping those outside MVP substantially reduces delivery risk.

---

# 62. Suggested Release Milestones

## Milestone A — Foundation

Phases:

```text
0–4
```

Result:

Infrastructure, authentication, accounts, categories.

## Milestone B — Usable Budget App

Phases:

```text
5–7
```

Result:

Transactions, dashboard, budgets.

## Milestone C — Financial Planner

Phases:

```text
8–10
```

Result:

Bills, calendar, savings goals.

## Milestone D — V2 Beta

Phases:

```text
11–13
```

Result:

Analytics, polish, security hardening.

## Milestone E — Production

Phase:

```text
14
```

---

# 63. Recommended Initial Architecture

```text
                    ┌────────────────────┐
                    │     Web App        │
                    │ Next.js + React    │
                    └─────────┬──────────┘
                              │
                              │ HTTPS / REST
                              │
┌────────────────────┐        │        ┌────────────────────┐
│ iOS                │────────┼────────│ Android            │
│ React Native       │        │        │ React Native       │
└────────────────────┘        │        └────────────────────┘
                              │
                     ┌────────▼─────────┐
                     │    API           │
                     │ NestJS           │
                     │ TypeScript       │
                     └────────┬─────────┘
                              │
                     ┌────────▼─────────┐
                     │ PostgreSQL       │
                     └──────────────────┘
```

Shared contracts:

```text
               packages/
                    │
        ┌───────────┼───────────┐
        │           │           │
      types     validation   api-client
```

---

# 64. Recommended Stack Summary

```text
Language:
    TypeScript

Web:
    Next.js
    React

Mobile:
    React Native
    Expo

Backend:
    NestJS
    Node.js

Alternative Backend:
    FastAPI
    Python

Database:
    PostgreSQL

ORM:
    Prisma (NestJS option)
    SQLAlchemy (FastAPI option)

API:
    REST
    OpenAPI

Validation:
    Zod frontend/shared
    Backend boundary validation

Testing:
    Vitest/Jest
    React Testing Library
    React Native Testing Library
    Supertest or equivalent
    Testcontainers
    Playwright

Monorepo:
    pnpm
    Turborepo

Code Quality:
    ESLint
    Prettier
    TypeScript strict mode

CI:
    GitHub Actions

Containers:
    Docker / Docker Compose
```

---

# 65. First Implementation Tasks

After this plan is approved, do not immediately attempt the entire application.

Start with these tasks:

```text
BUD-001 Finalise product MVP
BUD-002 Create ADR-001 backend language
BUD-003 Create architecture overview
BUD-004 Define money/date conventions
BUD-005 Create monorepo
BUD-006 Configure code quality
BUD-007 Add PostgreSQL local environment
BUD-008 Configure CI
BUD-009 Create database foundation
BUD-010 Implement first vertical slice
```

The first vertical slice should be:

```text
Create Expense
      ↓
API
      ↓
Database
      ↓
Return Expense
      ↓
Display Expense
```

Implement this end-to-end on web before spreading effort across every feature.

Then implement the equivalent mobile flow.

This validates the architecture early.

---

# 66. AI Session Resume Protocol

At the start of every future coding session, use approximately this instruction:

```text
Continue development of Budget Terry V2.

Before making changes:

1. Read PLAN.md.
2. Read PROJECT_STATUS.md.
3. Read AGENTS.md.
4. Read relevant ADRs.
5. Inspect git status and recent changes.
6. Run or inspect the current quality gate.

Work only on the task listed under "Next Task" unless there is a documented blocker.

Follow clean-code principles and existing architecture.
Do not introduce unnecessary dependencies or unrelated refactors.

Add appropriate unit and integration tests.
Update documentation when behavior, architecture, configuration, or setup changes.

Before finishing:
- run the relevant tests;
- run the complete quality gate where feasible;
- update PROJECT_STATUS.md;
- record any failures or blockers honestly;
- write an exact Next Task;
- leave the repository in a resumable state.
```

This prompt should continue to work even when the previous development chat is unavailable.

---

# 67. Important Engineering Rule

The project should always prefer:

```text
A small completed vertical slice
```

over:

```text
many partially implemented layers
```

For example, this is preferable:

```text
Expense creation
API ✓
Database ✓
Web ✓
Tests ✓
Documentation ✓
```

to:

```text
All database tables ✓
All controllers partly written
No UI
Few tests
Broken build
```

That principle is particularly important when development occurs across limited AI coding sessions.

---

# 68. Final Architectural Recommendation

For Budget Terry V2, the recommended starting architecture is:

```text
Next.js + TypeScript           Web

React Native + Expo
+ TypeScript                   iOS / Android

NestJS + TypeScript            Backend

PostgreSQL                     Database

REST + OpenAPI                 API contract

pnpm + Turborepo               Monorepo

Testcontainers                 Integration testing

GitHub Actions                 CI / quality gate
```

The strongest reason to select NestJS over Python for the initial implementation is not raw performance. It is reducing cognitive and maintenance overhead by keeping the application primarily in one language while allowing strong typed contracts across the backend, web, and mobile applications.

Python/FastAPI remains a good future option for separate analytics, forecasting, machine-learning, or financial intelligence services if those needs become substantial.

---

# 69. Review Questions

Before implementation, review and decide:

- [ ] Should Budget Terry initially support one user only or full multi-user accounts from day one?
- [ ] Is NZD the only currency required for V2?
- [ ] Should budgets be monthly only initially, or weekly/fortnightly as well?
- [ ] Should salary/payday recurrence be part of MVP?
- [ ] Should bills automatically create expenses when marked paid?
- [ ] Should goal contributions create transactions/transfers?
- [ ] Should multiple financial accounts be included in MVP?
- [ ] Is household/shared budgeting required later?
- [ ] Is bank integration explicitly postponed?
- [ ] Confirm NestJS or FastAPI.
- [ ] Confirm Expo for React Native.
- [ ] Confirm Next.js for web.
- [ ] Confirm PostgreSQL.
- [ ] Confirm monorepo approach.

Once these are resolved, record important decisions as ADRs instead of relying on conversation history.

# 70. Visual Design Theme — Warm Ledger

Budget Terry V2 should avoid looking like a generic AI-generated SaaS dashboard. Avoid excessive purple/blue gradients, glassmorphism, glowing cards, oversized rounded cards, decorative charts, and generic admin-dashboard layouts.

The working theme is **Warm Ledger**: calm, practical, warm, trustworthy, readable, and data-focused. The application should feel somewhere between a modern banking application and a carefully designed budgeting notebook.

## Colour System

| Purpose                      | Colour            | Hex             |
| ---------------------------- | ----------------- | --------------- |
| Application background       | Warm off-white    | `#F7F7F4`       |
| Surface/cards                | White             | `#FFFFFF`       |
| Primary text                 | Charcoal          | `#202220`       |
| Secondary text               | Muted grey        | `#70746F`       |
| Primary accent               | Deep forest green | `#285943`       |
| Secondary accent             | Muted sage        | `#87A693`       |
| Warning / approaching budget | Warm amber        | To be finalized |
| Overspent / overdue          | Muted red         | To be finalized |
| Positive / income            | Green             | To be finalized |

Forest green should be an accent rather than dominating the interface. Colour must never be the only indication of financial state.

## Visual Rules

- Corner radius should generally remain around 8–12px.
- Shadows should be subtle or omitted.
- Prefer sections, spacing, typography, and dividers over putting everything inside cards.
- Animations should be purposeful and restrained.
- Financial figures should be prominent and easy to scan.
- Use tabular numerals where supported.
- Candidate fonts: Inter, Geist, or native system fonts.

A core visual principle is:

> **The numbers are the design.**

Expense breakdowns should normally use readable ranked bars before pie/donut charts. Charts should be used where they genuinely improve interpretation, such as spending trends, budget vs actual, income vs expenses, and savings progress.

---

# 71. Budget Terry Product Personality

**Terry** should be a subtle part of the product personality.

Terry is **not** a chatbot, animated AI assistant, or cartoon mascot. Terry represents concise, useful observations derived from the user's budgeting data.

Examples:

```text
Terry noticed

You've spent $96 less on eating out
than this time last month.
```

```text
Looking good

Your bills are covered until
your next payday.
```

```text
Heads up

Your electricity bill is due Friday.
```

```text
Terry noticed

Groceries are at 82% of your monthly
budget with 9 days remaining.
```

```text
Nice progress

Your Japan 2027 goal has reached 50%.
```

Observations must be short, factual, helpful, non-judgmental, explainable, relevant, dismissible, and used sparingly. Avoid spending-shaming language.

---

# 72. Terry Observation Engine

The initial Terry implementation should **not require AI or an LLM**. Use deterministic financial rules first.

```text
Financial data
      ↓
Insight calculators
      ↓
Observation candidates
      ↓
Priority / relevance rules
      ↓
Terry observation
      ↓
Web / Mobile UI
```

Initial rules may include:

```text
BUDGET_80_PERCENT_USED
BUDGET_EXCEEDED
BILL_DUE_TOMORROW
BILL_OVERDUE
SPENDING_LOWER_THAN_LAST_MONTH
SPENDING_HIGHER_THAN_LAST_MONTH
GOAL_25_PERCENT
GOAL_50_PERCENT
GOAL_75_PERCENT
GOAL_COMPLETED
PAYDAY_APPROACHING
BILLS_COVERED_UNTIL_PAYDAY
UNUSUAL_CATEGORY_INCREASE
```

Potential model:

```text
TerryObservation

id
type
priority
title
message
effectiveDate
expiresAt
relatedEntityType
relatedEntityId
action
dismissible
```

Suggested priority:

1. Overdue bill
2. Bill due soon
3. Budget exceeded
4. Budget approaching limit
5. Payday/bill coverage
6. Goal milestone
7. Spending comparison
8. General positive observation

Normally show only one or a small number of Terry observations at a time.

---

# 73. Terry Notifications and Tone

Some observations may become in-app, push, or email notifications.

Users should be able to configure notifications for:

- Bills
- Budgets
- Goals
- Payday
- Spending observations

Terry's voice should be friendly, calm, concise, practical, neutral, and supportive without being patronizing.

Avoid phrases such as:

```text
I've been watching your spending...
You really need to stop spending...
I think you made a bad decision...
```

Prefer factual language such as:

```text
Heads up

Three bills totalling $412 are due
before your next payday.
```

Observations can provide useful actions:

```text
Terry noticed

Groceries are at 82% of your budget.

[View groceries]
```

```text
Heads up

Electricity is due tomorrow.

[View bill]    [Mark paid]
```

Actions should lead to normal application functionality, not a chatbot.

---

# 74. Themes and Design Tokens

Build the Warm Ledger **light theme first**. Dark mode should later be deliberately designed rather than simply colour-inverted.

Centralize design tokens for:

```text
Colours
Spacing
Typography
Radius
Elevation
Semantic financial states
```

Suggested semantic tokens:

```text
background
surface
textPrimary
textSecondary
border
accentPrimary
accentSecondary
financialPositive
financialWarning
financialNegative
financialNeutral
budgetHealthy
budgetApproaching
budgetExceeded
billUpcoming
billDue
billOverdue
billPaid
```

Web and React Native may implement these tokens differently while preserving the same visual language.

---

# 75. Design Quality Gate

Before a screen is complete:

- [ ] Uses Warm Ledger design tokens.
- [ ] Information hierarchy is clear.
- [ ] Financial figures are easy to scan.
- [ ] Colour is not the only state indicator.
- [ ] No unnecessary decorative charts.
- [ ] No excessive card usage.
- [ ] No unnecessary gradients or glass effects.
- [ ] Responsive behavior is verified.
- [ ] Mobile layout is verified where applicable.
- [ ] Accessibility requirements are checked.
- [ ] Empty, loading, and error states exist.
- [ ] Terry observations follow tone rules where present.
- [ ] Appropriate UI/component tests exist.

---

# 76. Design and Terry Backlog

```text
BUD-DES-001 Define Warm Ledger design tokens
BUD-DES-002 Create typography scale
BUD-DES-003 Create financial semantic colours
BUD-DES-004 Create core web UI primitives
BUD-DES-005 Create core mobile UI primitives
BUD-DES-006 Build dashboard visual prototype
BUD-DES-007 Build expense breakdown component
BUD-DES-008 Accessibility review

BUD-TRY-001 Define Terry observation domain model
BUD-TRY-002 Implement observation rule engine
BUD-TRY-003 Implement budget observations
BUD-TRY-004 Implement bill observations
BUD-TRY-005 Implement spending comparison observations
BUD-TRY-006 Implement goal milestone observations
BUD-TRY-007 Add dashboard Terry component
BUD-TRY-008 Add observation dismissal
BUD-TRY-009 Add Terry rule unit tests
BUD-TRY-010 Add Terry integration tests
BUD-TRY-011 Add notification preferences
BUD-TRY-012 Add mobile push notifications later
```

Terry should initially use deterministic rules rather than an LLM or external AI dependency.
