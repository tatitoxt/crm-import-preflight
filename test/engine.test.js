import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRecords, detectDelimiter, escapeCsvCell, mapForImport, parseCsv, serializeCsv } from '../src/engine.js';

test('parses quoted commas, quotes, CRLF, and a UTF-8 BOM', () => {
  const parsed = parseCsv('\uFEFFName,Email,Company\r\n"Maya ""M"", Chen",maya@example.com,"Northstar, Inc."\r\n');
  assert.deepEqual(parsed.headers, ['Name', 'Email', 'Company']);
  assert.equal(parsed.records[0].values.Name, 'Maya "M", Chen');
  assert.equal(parsed.records[0].values.Company, 'Northstar, Inc.');
  assert.equal(parsed.records[0].rowNumber, 2);
});

test('detects semicolon delimited exports', () => {
  assert.equal(detectDelimiter('Email;Company\nmaya@example.com;Northstar'), ';');
  assert.equal(parseCsv('Email;Company\nmaya@example.com;Northstar').records.length, 1);
});

test('rejects unfinished quotes and duplicate headers', () => {
  assert.throws(() => parseCsv('Email,Name\n"broken,maya'), /unfinished quoted field/);
  assert.throws(() => parseCsv('Email,email\none,two'), /must be unique/);
});

test('marks missing or malformed emails as errors and duplicate emails as review', () => {
  const { records } = parseCsv('Email,Name\nMAYA@example.com,Maya\nmaya@example.com,Duplicate\nnot-an-email,Sam\n,No email');
  const checked = analyzeRecords(records, { email: 'Email' });
  assert.deepEqual(checked.map((row) => row.status), ['review', 'review', 'error', 'error']);
  assert.match(checked[0].warnings[0], /more than once/);
  assert.match(checked[2].errors[0], /invalid/);
  assert.match(checked[3].errors[0], /missing/);
});

test('requires an email column mapping', () => {
  assert.throws(() => analyzeRecords([], {}), /Choose the column/);
});

test('maps selected fields to stable import headers and preserves unmapped columns', () => {
  const { headers, records } = parseCsv('correo,nombre,region\nmaya@example.com,Maya,Sur');
  const mapped = mapForImport(headers, records, { email: 'correo', firstName: 'nombre' });
  assert.deepEqual(mapped.headers, ['First Name', 'Email', 'region']);
  assert.deepEqual(mapped.records[0].values, { 'First Name': 'Maya', Email: 'maya@example.com', region: 'Sur' });
});

test('quotes CSV output and guards cells that spreadsheet apps may treat as formulas', () => {
  assert.equal(escapeCsvCell('=1+1'), "'=1+1");
  assert.equal(escapeCsvCell('Northstar, Inc.'), '"Northstar, Inc."');
  const csv = serializeCsv(['Email', 'Company'], [{ rowNumber: 2, values: { Email: 'maya@example.com', Company: 'Northstar, Inc.' } }]);
  assert.equal(csv, 'Email,Company\r\nmaya@example.com,"Northstar, Inc."\r\n');
});
