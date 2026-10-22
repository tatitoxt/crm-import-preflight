# Import Preflight

Import Preflight is a small browser tool for checking a contact CSV before a CRM migration or import. It lets you map the email column, flags missing or malformed email values and repeated addresses, then exports rows that are ready and rows to review.

Run it with npm test, then npm run serve and open http://localhost:4173. Choose Try a sample or select a CSV file.

The file is read in your browser tab. It is not uploaded, stored, or sent to a service. Use synthetic data for the sample; avoid putting client data into public demos.

## Run locally

Requirements: Node.js 20+ and Python 3.

    npm test
    npm run serve

No build step, API key, database, or account is required.

## What it checks

- A mapped email value is present and has a basic email shape.
- Repeated email addresses are flagged without choosing which record to keep.
- CSV quoting, escaped quotes, line endings, UTF-8 BOMs, and comma or semicolon separators.
- Review exports include a notes column; formula-like values are escaped for spreadsheet use.

This is a preflight aid, not a CRM importer or a replacement for reviewing the source and target schemas. It does not connect to Salesforce, Attio, or any CRM API.

## Tests

    npm test

The suite uses Node's built-in test runner and covers parsing, delimiter detection, validation, duplicates, error handling, and safe CSV output.

## Privacy boundary

All parsing and checks run in the browser. The app has no server-side upload route, database, local storage, analytics, or external API calls. The external font stylesheet is presentation-only; CSV contents are never sent to it.

## License

MIT. See LICENSE.
