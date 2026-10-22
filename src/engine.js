export function parseCsv(input, delimiter = detectDelimiter(input)) {
  const text = String(input ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"' && cell.length === 0) {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
      if (char === '\r' && text[index + 1] === '\n') index += 1;
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error('The CSV contains an unfinished quoted field.');
  row.push(cell);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  if (rows.length === 0) throw new Error('The CSV is empty.');
  const headers = rows.shift().map((header) => header.trim());
  if (headers.some((header) => !header)) throw new Error('Every column needs a header.');
  if (new Set(headers.map((header) => header.toLowerCase())).size !== headers.length) {
    throw new Error('Column names must be unique.');
  }
  const records = rows.map((values, rowIndex) => {
    const record = {};
    headers.forEach((header, columnIndex) => {
      record[header] = (values[columnIndex] ?? '').trim();
    });
    return { rowNumber: rowIndex + 2, values: record };
  });
  return { headers, records, delimiter };
}

export function detectDelimiter(input) {
  const text = String(input ?? '').replace(/^\uFEFF/, '');
  let quoted = false;
  const counts = { ',': 0, ';': 0, '\t': 0 };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && text[index + 1] === '"' && quoted) {
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && (char === '\n' || char === '\r')) {
      break;
    } else if (!quoted && Object.hasOwn(counts, char)) {
      counts[char] += 1;
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

export function analyzeRecords(records, mapping) {
  if (!mapping.email) throw new Error('Choose the column that contains email addresses.');
  const frequencies = new Map();
  for (const record of records) {
    const email = normalizeEmail(record.values[mapping.email]);
    if (email) frequencies.set(email, (frequencies.get(email) ?? 0) + 1);
  }
  return records.map((record) => {
    const email = normalizeEmail(record.values[mapping.email]);
    const errors = [];
    const warnings = [];
    if (!email) {
      errors.push('Email is missing');
    } else if (!isValidEmail(email)) {
      errors.push('Email format looks invalid');
    } else if (frequencies.get(email) > 1) {
      warnings.push('Email appears more than once in this file');
    }
    const status = errors.length ? 'error' : warnings.length ? 'review' : 'ready';
    return { ...record, email, errors, warnings, status };
  });
}

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function mapForImport(headers, records, mapping) {
  const fields = [
    ['First Name', mapping.firstName],
    ['Last Name', mapping.lastName],
    ['Email', mapping.email],
    ['Company', mapping.company]
  ].filter(([, source]) => source);
  const mappedSources = new Set(fields.map(([, source]) => source));
  const outputHeaders = [...fields.map(([target]) => target), ...headers.filter((header) => !mappedSources.has(header))];
  const outputRecords = records.map((record) => {
    const values = Object.fromEntries(fields.map(([target, source]) => [target, record.values[source] ?? '']));
    for (const header of headers) {
      if (!mappedSources.has(header)) values[header] = record.values[header] ?? '';
    }
    return { ...record, values };
  });
  return { headers: outputHeaders, records: outputRecords };
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? ''));
}

export function serializeCsv(headers, records, issuesByRow = new Map()) {
  const outputHeaders = [...headers, ...(issuesByRow.size ? ['Import Preflight notes'] : [])];
  const lines = [outputHeaders.map(escapeCsvCell).join(',')];
  for (const record of records) {
    const cells = headers.map((header) => record.values[header] ?? '');
    if (issuesByRow.size) cells.push((issuesByRow.get(record.rowNumber) ?? []).join('; '));
    lines.push(cells.map(escapeCsvCell).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

export function escapeCsvCell(value) {
  let text = String(value ?? '');
  if (/^\s*[=+\-@]/.test(text)) text = "'" + text;
  if (/[",\r\n]/.test(text)) return '"' + text.replaceAll('"', '""') + '"';
  return text;
}
