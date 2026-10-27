/**
 * Browser Test Runner Summary Logic Unit Tests
 * Tests formatting, table generation, failure reporting, and exit code determination.
 */

'use strict';

const assert = require('assert');
const { formatAndEvaluateSummary } = require('./browser/run_browser_tests');

console.log('========================================================================');
console.log('         TEST: BROWSER RUNNER SUMMARY FORMATTING & EXIT CODES           ');
console.log('========================================================================\n');

function runTests() {
  assert(typeof formatAndEvaluateSummary === 'function', 'formatAndEvaluateSummary harus berupa fungsi');

  // Test Case A: Semua Lulus -> Tabel tercetak, exit code 0
  console.log('--- Test (a): Semua Suite Lulus ---');
  {
    const logs = [];
    const tableData = [];
    const customLogger = {
      log: (...args) => logs.push(args.join(' ')),
      error: (...args) => logs.push(args.join(' ')),
      table: (data) => tableData.push(data)
    };

    const suitesA = [
      { name: 'Redaction Suite', status: 'lulus', duration: '2.50s' },
      { name: 'Sign Flow Suite', status: 'lulus', duration: '1.20s' }
    ];

    const resA = formatAndEvaluateSummary(suitesA, 0, customLogger);
    assert.strictEqual(resA.exitCode, 0, 'Exit code harus 0 jika semua suite lulus');
    assert.strictEqual(resA.failures.length, 0, 'Failures harus kosong');
    assert.strictEqual(resA.passedCount, 2, 'Jumlah lulus harus 2');
    assert.strictEqual(tableData.length, 1, 'Tabel ringkasan harus tercetak via logger.table');
    assert.strictEqual(tableData[0].length, 2, 'Tabel harus memuat 2 baris');
    assert.strictEqual(tableData[0][0].Status, 'LULUS', 'Status harus LULUS');
    const fullLog = logs.join('\n');
    assert(fullLog.includes('SEMUA BROWSER TEST SUITE LULUS LENGKAP'), 'Pesan sukses harus tercetak');
    console.log('  ✓ Test (a) LULUS: Exit code 0, tabel tercetak, pesan sukses diverifikasi.');
  }

  // Test Case B: Satu Gagal -> Tabel tercetak, suite gagal disebut, exit code 1
  console.log('\n--- Test (b): Satu Suite Gagal ---');
  {
    const logs = [];
    const errors = [];
    const tableData = [];
    const customLogger = {
      log: (...args) => logs.push(args.join(' ')),
      error: (...args) => errors.push(args.join(' ')),
      table: (data) => tableData.push(data)
    };

    const suitesB = [
      { name: 'Redaction Suite', status: 'lulus', duration: '2.50s' },
      { name: 'Sign Flow Suite', status: 'gagal', duration: '0.80s', error: new Error('Canvas hash mismatch') }
    ];

    const resB = formatAndEvaluateSummary(suitesB, 0, customLogger);
    assert.strictEqual(resB.exitCode, 1, 'Exit code harus 1 jika ada suite yang gagal');
    assert.strictEqual(resB.failures.length, 1, 'Failures harus berisi 1 suite');
    assert.strictEqual(resB.failures[0].name, 'Sign Flow Suite', 'Nama suite gagal harus tepat');
    assert.strictEqual(tableData.length, 1, 'Tabel ringkasan tetap harus tercetak saat ada kegagalan');
    const fullErr = errors.join('\n');
    assert(fullErr.includes('Sign Flow Suite'), 'Nama suite gagal harus dicetak ke error log');
    assert(fullErr.includes('Canvas hash mismatch'), 'Pesan error harus dicetak ke error log');
    console.log('  ✓ Test (b) LULUS: Exit code 1, tabel tercetak, suite gagal & error dilaporkan.');
  }

  // Test Case C: Ada yang Dilewati -> Jumlah dilewati disebut
  console.log('\n--- Test (c): Ada Suite yang Dilewati ---');
  {
    const logs = [];
    const tableData = [];
    const customLogger = {
      log: (...args) => logs.push(args.join(' ')),
      error: (...args) => logs.push(args.join(' ')),
      table: (data) => tableData.push(data)
    };

    const suitesC = [
      { name: 'Suite 1', status: 'lulus', duration: '1.00s' },
      { name: 'Suite 2', status: 'dilewati', duration: '0.00s' }
    ];

    const resC = formatAndEvaluateSummary(suitesC, 3, customLogger);
    assert.strictEqual(resC.exitCode, 0, 'Exit code 0 jika tidak ada yang gagal');
    assert.strictEqual(resC.skippedCount, 1, 'Jumlah suite dilewati harus 1');
    assert.strictEqual(tableData[0][1].Status, 'DILEWATI', 'Status tabel harus DILEWATI');
    const fullLog = logs.join('\n');
    assert(fullLog.includes('1 dilewati'), 'Jumlah dilewati harus dilaporkan pada total');
    assert(fullLog.includes('Total skenario WebKit dilewati lokal: 3'), 'Total WebKit dilewati harus dicetak');
    console.log('  ✓ Test (c) LULUS: Jumlah suite dilewati dan skenario WebKit dilaporkan dengan benar.');
  }

  console.log('\n========================================================================');
  console.log('SUMMARY TEST RESULTS: All 3 cases passed!                               ');
  console.log('✅ [PASS] Browser Runner Summary Logic PASSED                           ');
  console.log('========================================================================\n');
}

runTests();
