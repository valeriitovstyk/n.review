/**
 * Бекенд відгуків про тата — Google Apps Script, прив'язаний до Google Таблиці.
 *
 * Секрети НЕ зберігаються в коді. Задай їх у редакторі скрипта:
 *   Project Settings (шестерня) → Script Properties:
 *     KID_PIN   — PIN, який вводить дитина, щоб опублікувати відгук
 *     OWNER_PIN — PIN тата для відповідей і видалення
 *
 * Розгортання: Deploy → New deployment → Web app
 *   Execute as: Me    Who has access: Anyone
 */

const SHEET_NAME = 'Відгуки';
const HEADERS = ['id', 'createdAt', 'author', 'rating', 'text', 'tags', 'helpful', 'reply', 'replyAt', 'hidden'];
const MAX_FAILS = 15;          // невдалих спроб PIN
const FAIL_WINDOW_SEC = 600;   // за 10 хвилин → тимчасове блокування

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'list';
  if (action === 'list') return json_({ ok: true, reviews: listReviews_() });
  return json_({ ok: false, error: 'unknown_action' });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents || '{}'); }
  catch (err) { return json_({ ok: false, error: 'bad_json' }); }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return json_({ ok: false, error: 'busy' });
  try {
    switch (body.action) {
      case 'add':   return json_(addReview_(body));
      case 'like':  return json_(like_(body));
      case 'reply': return json_(reply_(body));
      case 'hide':  return json_(hide_(body));
      case 'checkOwner': return json_(checkPin_('OWNER_PIN', body.pin) ? { ok: true } : { ok: false, error: lastPinError_ });
      default:      return json_({ ok: false, error: 'unknown_action' });
    }
  } finally {
    lock.releaseLock();
  }
}

/* ---------- actions ---------- */

function listReviews_() {
  const sh = sheet_();
  const values = sh.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const r = rowToObj_(values[i]);
    if (!r.id || r.hidden) continue;
    out.push({
      id: r.id, createdAt: Number(r.createdAt) || 0, author: String(r.author),
      rating: Number(r.rating), text: String(r.text), tags: parseTags_(r.tags),
      helpful: Number(r.helpful) || 0, reply: String(r.reply || ''), replyAt: Number(r.replyAt) || 0
    });
  }
  return out;
}

function addReview_(b) {
  if (!checkPin_('KID_PIN', b.pin) && !checkPin_('OWNER_PIN', b.pin, true)) return { ok: false, error: lastPinError_ };
  const rating = Math.round(Number(b.rating));
  const author = clean_(b.author, 40);
  if (!(rating >= 1 && rating <= 5)) return { ok: false, error: 'bad_rating' };
  if (!author) return { ok: false, error: 'no_author' };
  const tags = (Array.isArray(b.tags) ? b.tags : []).slice(0, 10).map(t => clean_(t, 40)).filter(Boolean);
  const id = Utilities.getUuid();
  sheet_().appendRow([id, Date.now(), safe_(author), rating, safe_(clean_(b.text, 2000)), JSON.stringify(tags), 0, '', '', '']);
  return { ok: true, id: id };
}

function like_(b) {
  const delta = Number(b.delta) > 0 ? 1 : -1;
  const found = findRow_(b.id);
  if (!found) return { ok: false, error: 'not_found' };
  const col = HEADERS.indexOf('helpful') + 1;
  const v = Math.max(0, (Number(found.sheet.getRange(found.row, col).getValue()) || 0) + delta);
  found.sheet.getRange(found.row, col).setValue(v);
  return { ok: true, helpful: v };
}

function reply_(b) {
  if (!checkPin_('OWNER_PIN', b.pin)) return { ok: false, error: lastPinError_ };
  const found = findRow_(b.id);
  if (!found) return { ok: false, error: 'not_found' };
  const text = clean_(b.text, 2000);
  found.sheet.getRange(found.row, HEADERS.indexOf('reply') + 1).setValue(safe_(text));
  found.sheet.getRange(found.row, HEADERS.indexOf('replyAt') + 1).setValue(text ? Date.now() : '');
  return { ok: true };
}

function hide_(b) {
  if (!checkPin_('OWNER_PIN', b.pin)) return { ok: false, error: lastPinError_ };
  const found = findRow_(b.id);
  if (!found) return { ok: false, error: 'not_found' };
  found.sheet.getRange(found.row, HEADERS.indexOf('hidden') + 1).setValue('так');
  return { ok: true };
}

/* ---------- helpers ---------- */

let lastPinError_ = 'bad_pin';

function checkPin_(prop, pin, silent) {
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('pin_fails') || 0);
  if (fails >= MAX_FAILS) { lastPinError_ = 'locked'; return false; }
  const expected = PropertiesService.getScriptProperties().getProperty(prop);
  if (!expected) { lastPinError_ = 'not_configured'; return false; }
  if (String(pin || '') === String(expected)) return true;
  if (!silent) cache.put('pin_fails', String(fails + 1), FAIL_WINDOW_SEC);
  lastPinError_ = 'bad_pin';
  return false;
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function findRow_(id) {
  if (!id) return null;
  const sh = sheet_();
  const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (let i = 1; i < ids.length; i++) if (ids[i][0] === id) return { sheet: sh, row: i + 1 };
  return null;
}

function rowToObj_(row) {
  const o = {};
  HEADERS.forEach((h, i) => o[h] = row[i]);
  return o;
}

function parseTags_(v) {
  try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a.map(String) : []; }
  catch (e) { return []; }
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

// Не дає тексту відгуку виконатися як формула в таблиці
function safe_(s) {
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Запусти один раз вручну з редактора, щоб створити аркуш і видати дозволи. */
function setup() {
  sheet_();
}
