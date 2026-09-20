# Playwright SAP BDD

End-to-end UI automation for SAP S/4HANA Cloud using Playwright, TypeScript, and
Gherkin scenarios through [`playwright-bdd`](https://github.com/vitalets/playwright-bdd).

The primary test flow creates a standard purchase order with a line item and an
attachment in the SAP **Manage Purchase Orders** application.

## Prerequisites

- Node.js 18 or later
- npm
- Access to the target SAP S/4HANA Cloud tenant
- A SAP user account with permission to create purchase orders

## Installation

Install the project dependencies:

```bash
npm install
```

Playwright browser binaries are normally installed by the package setup. If the
browsers are not available on a new machine, install them explicitly:

```bash
npx playwright install
```

## Configuration

Create a `.env` file in the repository root. The Playwright configuration
requires all three variables below when it is loaded:

```dotenv
SAP_CLOUD_BASE_URL=https://your-tenant.example.com
SAP_CLOUD_USERNAME=your-username
SAP_CLOUD_PASSWORD=your-password
```

Do not commit `.env` or any file containing credentials. These files are ignored
by `.gitignore`.

## Running tests

The default test command generates executable tests from the Gherkin features
and then runs Playwright:

```bash
npm test
```

The configured browser runs headed, maximized, and records a trace and video.
To run the generated tests directly after generation:

```bash
npx bddgen
npx playwright test
```

Useful Playwright commands include:

```bash
# Run with the Playwright UI
npx playwright test --ui

# Run in debug mode
npx playwright test --debug

# Run a single generated test by name
npx playwright test -g "Create Standard Purchase Order"

# Open the latest HTML report
npx playwright show-report
```

The repository also contains standalone demonstration tests under
`tests/` and `tests-examples/`. The configured `npm test` flow is centered on
the BDD feature directory and its generated test directory.

## BDD workflow

1. Add or update a feature under `tests/bdd/features/`.
2. Add matching step definitions under `tests/bdd/step-definitions/`.
3. Run `npx bddgen` to generate Playwright tests.
4. Run `npx playwright test` or `npm test`.

The current feature is:

`tests/bdd/features/create-purchase-order.feature`

It covers:

- Logging into SAP S/4HANA Cloud
- Opening Manage Purchase Orders
- Entering purchase order header data
- Adding a material line item
- Setting storage location and delivery date
- Uploading `test-data/purchase-order/order-confirmation.pdf`
- Submitting the order
- Verifying the success message and created purchase order number

Gherkin data tables are converted to typed objects by
`utils/create-instance.ts`. Field names are converted from labels such as
`Purchasing Doc Type` to camel case (`purchasingDocType`).

## Project structure

```text
.
├── fixtures/
│   └── fixtures.ts                  # BDD fixtures and page-object factory
├── model/
│   ├── pages/                       # SAP page objects
│   ├── ui/                          # Reusable UI helpers
│   └── purchase-order.data.ts       # Purchase order data types
├── test-data/                       # Files used by test scenarios
├── tests/
│   ├── bdd/features/                # Gherkin feature files
│   ├── bdd/step-definitions/        # Step implementations
│   └── example.spec.ts              # Standalone Playwright example
├── tests-examples/                  # Additional Playwright examples
├── utils/                           # Shared conversion and timing helpers
├── playwright.config.ts             # Playwright and BDD configuration
├── tsconfig.json                    # TypeScript compiler configuration
└── package.json                     # Scripts and dependencies
```

## Reports and artifacts

The test configuration produces:

- `playwright-report/` — Playwright HTML report
- `cucumber-report/` — Cucumber HTML report
- `test-results/` — test attachments and execution output
- `blob-report/` — blob reporter output when enabled
- `playwright/.auth/` — optional authentication state

These generated files are ignored by Git. Failed tests capture screenshots;
traces and videos are enabled by the current Playwright configuration to aid
diagnosis.

## Page-object conventions

SAP interactions are kept in page objects under `model/pages/`. Step definitions
should coordinate the scenario and call page-object methods rather than
containing low-level selectors. Shared fixtures in `fixtures/fixtures.ts`
provide:

- `open` — creates a typed page-object instance for the current Playwright page
- `scenarioContext` — per-scenario state storage

## Code generation

The package includes a convenience script for SAP-aware Playwright code
generation:

```bash
npm run codegen
```

Before using it, replace the placeholder values in the `codegen` script in
`package.json`, or run the equivalent command directly:

```bash
npx playwright codegen "https://your-tenant.example.com" --sap-login "username" "password"
```

Avoid placing real credentials in shell history or committed files.

## Troubleshooting

### Missing environment variables

The configuration fails fast if `SAP_CLOUD_BASE_URL`,
`SAP_CLOUD_USERNAME`, or `SAP_CLOUD_PASSWORD` is missing. Check the root `.env`
file and rerun the command.

### Generated tests are stale

Regenerate the BDD output before running a feature:

```bash
npx bddgen
```

If necessary, remove the generated `.features-gen/` directory and generate it
again.

### Investigating a failure

Open the Playwright report:

```bash
npx playwright show-report
```

Use the attached screenshot, video, or trace from `test-results/` to inspect the
browser state at the point of failure.

Added a line to test PR - 6
