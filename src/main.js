import { analyzeRecords, mapForImport, parseCsv, serializeCsv } from './engine.js';

const byId = (id) => document.getElementById(id);
const elements = {
  dropZone: byId('dropZone'),
  fileInput: byId('fileInput'),
  browseButton: byId('browseButton'),
  sampleButton: byId('sampleButton'),
  fileMessage: byId('fileMessage'),
  mappingPanel: byId('mappingPanel'),
  fileName: byId('fileName'),
  mapping: {
    email: byId('mapEmail'),
    firstName: byId('mapFirstName'),
    lastName: byId('mapLastName'),
    company: byId('mapCompany')
  },
  checkButton: byId('checkButton'),
  resultsPanel: byId('resultsPanel'),
  tableHead: byId('tableHead'),
  tableBody: byId('tableBody')
};

const sampleCsv = [
  'First Name,Last Name,Email,Company',
  'Maya,Chen,maya.chen@example.test,Northstar Studio',
  'Mateo,Ruiz,mateo.ruiz@example.test,Canopy Works',
  'Rina,Patel,rina.patel@example.test,Common Ground',
  'Alex,Morgan,alex.morgan@example.test,Fieldnote Labs',
  'Sam,,sam.fieldnote@example.test,',
  'Noah,Reed,noah.reed@example.test,Little Current',
  'Jo,Diaz,not-an-email,Good Measure',
  'Maya,Chen,MAYA.CHEN@example.test,Northstar Studio'
].join('\n');

let dataset = null;
let results = [];
let activeFilter = 'all';
let activeMapping = {};

elements.browseButton.addEventListener('click', (event) => {
  event.stopPropagation();
  elements.fileInput.click();
});
elements.dropZone.addEventListener('click', (event) => {
  if (event.target.closest('button')) return;
  elements.fileInput.click();
});
elements.dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    elements.fileInput.click();
  }
});
elements.fileInput.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (file) loadFile(file);
});
elements.sampleButton.addEventListener('click', () => loadText(sampleCsv, 'sample-contacts.csv'));
elements.checkButton.addEventListener('click', runChecks);
byId('resetButton').addEventListener('click', resetDesk);
document.querySelectorAll('.filter-tab').forEach((button) => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('.filter-tab').forEach((tab) => tab.classList.toggle('active', tab === button));
    renderRows();
  });
});
byId('exportReady').addEventListener('click', () => exportRows('ready'));
byId('exportReview').addEventListener('click', () => exportRows('review'));

for (const eventName of ['dragenter', 'dragover']) {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add('is-dragging');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove('is-dragging');
  });
}
elements.dropZone.addEventListener('drop', (event) => {
  const file = event.dataTransfer?.files?.[0];
  if (file) loadFile(file);
});

async function loadFile(file) {
  if (!file.name.toLowerCase().endsWith('.csv')) return showError('Choose a .csv file to continue.');
  if (file.size > 10 * 1024 * 1024) return showError('This file is over 10 MB. Try a smaller export.');
  try {
    loadText(await file.text(), file.name);
  } catch {
    showError('We could not read this file. Try saving it again as UTF-8 CSV.');
  }
}

function loadText(text, fileName) {
  try {
    dataset = parseCsv(text);
    results = [];
    elements.fileName.textContent = fileName;
    elements.fileMessage.textContent = dataset.records.length + ' rows found · ' + dataset.headers.length + ' columns · file stays in your browser';
    elements.fileMessage.classList.remove('error-message');
    populateMappings(dataset.headers);
    elements.mappingPanel.classList.remove('hidden');
    elements.resultsPanel.classList.add('hidden');
    elements.mappingPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    showError(error.message);
  }
}

function populateMappings(headers) {
  const normalized = headers.map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const suggestions = {
    email: ['email', 'emailaddress', 'workemail'],
    firstName: ['firstname', 'givenname'],
    lastName: ['lastname', 'surname', 'familyname'],
    company: ['company', 'accountname', 'organization', 'organisation']
  };
  for (const [field, select] of Object.entries(elements.mapping)) {
    select.replaceChildren();
    const skip = document.createElement('option');
    skip.value = '';
    skip.textContent = field === 'email' ? 'Choose a column' : 'Not mapped';
    select.append(skip);
    headers.forEach((header, index) => {
      const option = document.createElement('option');
      option.value = header;
      option.textContent = header;
      select.append(option);
      if (suggestions[field].includes(normalized[index])) select.value = header;
    });
  }
}

function runChecks() {
  if (!dataset) return;
  try {
    const mapping = Object.fromEntries(Object.entries(elements.mapping).map(([field, select]) => [field, select.value]));
    activeMapping = mapping;
    results = analyzeRecords(dataset.records, mapping);
    activeFilter = 'all';
    document.querySelectorAll('.filter-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.filter === 'all'));
    renderSummary();
    renderRows();
    elements.mappingPanel.classList.add('hidden');
    elements.resultsPanel.classList.remove('hidden');
    elements.resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    showError(error.message);
  }
}

function renderSummary() {
  const ready = results.filter((row) => row.status === 'ready').length;
  const review = results.filter((row) => row.status !== 'ready').length;
  byId('readyCount').textContent = ready;
  byId('reviewCount').textContent = review;
  byId('totalCount').textContent = results.length;
  byId('readyTabCount').textContent = ready;
  byId('reviewTabCount').textContent = review;
  byId('allTabCount').textContent = results.length;
}

function renderRows() {
  const fields = dataset ? dataset.headers.slice(0, 4) : [];
  elements.tableHead.replaceChildren();
  const headerRow = document.createElement('tr');
  for (const title of ['ROW', ...fields, 'CHECK']) {
    const th = document.createElement('th');
    th.textContent = title;
    headerRow.append(th);
  }
  elements.tableHead.append(headerRow);
  elements.tableBody.replaceChildren();
  const filtered = results.filter((row) => activeFilter === 'all' || (activeFilter === 'ready' ? row.status === 'ready' : row.status !== 'ready'));
  const rows = filtered.slice(0, 100);
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = fields.length + 2;
    td.className = 'empty-state';
    td.textContent = activeFilter === 'ready' ? 'No ready rows in this view.' : 'No rows to review. Nice.';
    tr.append(td);
    elements.tableBody.append(tr);
    return;
  }
  for (const record of rows) {
    const tr = document.createElement('tr');
    const rowNumber = document.createElement('td');
    rowNumber.className = 'row-index';
    rowNumber.textContent = String(record.rowNumber).padStart(2, '0');
    tr.append(rowNumber);
    for (const field of fields) {
      const td = document.createElement('td');
      td.textContent = record.values[field] || '—';
      if (field === elements.mapping.email.value) td.classList.add('email-cell');
      tr.append(td);
    }
    const checkCell = document.createElement('td');
    const issues = [...record.errors, ...record.warnings];
    const badge = document.createElement('span');
    badge.className = 'status-pill status-' + record.status;
    badge.textContent = record.status === 'ready' ? 'READY' : record.status === 'error' ? 'FIX' : 'CHECK';
    checkCell.append(badge);
    if (issues.length) {
      const issue = document.createElement('span');
      issue.className = 'issue-copy';
      issue.textContent = issues[0];
      checkCell.append(issue);
    }
    tr.append(checkCell);
    elements.tableBody.append(tr);
  }
}

function exportRows(kind) {
  const rows = kind === 'ready' ? results.filter((row) => row.status === 'ready') : results.filter((row) => row.status !== 'ready');
  const mapped = mapForImport(dataset.headers, rows, activeMapping);
  const notes = new Map(mapped.records.map((row, index) => [row.rowNumber, [...rows[index].errors, ...rows[index].warnings]]));
  const csv = serializeCsv(mapped.headers, mapped.records, kind === 'review' ? notes : new Map());
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = kind === 'ready' ? 'import-preflight-ready.csv' : 'import-preflight-review.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function showError(message) {
  elements.fileMessage.textContent = message;
  elements.fileMessage.classList.add('error-message');
}

function resetDesk() {
  dataset = null;
  results = [];
  activeMapping = {};
  elements.fileInput.value = '';
  elements.mappingPanel.classList.add('hidden');
  elements.resultsPanel.classList.add('hidden');
  elements.fileMessage.textContent = 'Your file stays in this tab. It is not uploaded or saved.';
  elements.fileMessage.classList.remove('error-message');
  document.querySelector('.workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
