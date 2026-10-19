/**
 * Mirror Solar CRM - Terminal Attendance Excel/CSV Importer
 * Usage:
 *   node scripts/importAttendance.mjs <path-to-file.csv> [optional-month-YYYY-MM]
 *
 * Example:
 *   node scripts/importAttendance.mjs ./attendance_oct2026.csv 2026-10
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const firebaseConfig = {
  apiKey: "AIzaSyBZE0Zwwvyc963ddo_I8LTc8emlhayZ_NY",
  authDomain: "crm-webapp-d32bc.firebaseapp.com",
  projectId: "crm-webapp-d32bc",
  storageBucket: "crm-webapp-d32bc.firebasestorage.app",
  messagingSenderId: "940267952934",
  appId: "1:940267952934:web:18ba7928b92968bcdcbfe7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const args = process.argv.slice(2);
  const filePath = args[0];
  const targetMonth = args[1] || new Date().toISOString().substring(0, 7);

  if (!filePath) {
    console.log(`
===========================================================
  MIRROR SOLAR CRM - ATTENDANCE EXCEL/CSV CLI IMPORTER
===========================================================
Usage:
  node scripts/importAttendance.mjs <file.csv> [YYYY-MM]

Sample Formats Supported:
1. Daily Log Format:
   Date, Employee ID/Name, Status (P/H/L/A), In-Time, Out-Time, Notes
2. Monthly Matrix Format:
   Employee ID, Employee Name, 1, 2, 3 ... 31
===========================================================
`);
    process.exit(0);
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: File not found at path: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`Reading attendance file: ${resolvedPath}`);
  const fileContent = fs.readFileSync(resolvedPath, 'utf8');

  // Fetch active company employees for matching
  console.log("Fetching staff directory from Firestore...");
  const usersSnap = await getDocs(collection(db, 'users'));
  const companyEmployees = [];
  usersSnap.forEach(d => {
    const u = d.data();
    if (u.role === 'Employee' && (!u.dealerId || u.dealerId === null)) {
      companyEmployees.push({ id: d.id, ...u });
    }
  });
  console.log(`Found ${companyEmployees.length} active company staff in database.`);

  const lines = fileContent.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) {
    console.log("File is empty.");
    process.exit(0);
  }

  const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
  const splitLine = (line) => {
    const regex = new RegExp(`(?:^|${delimiter})("(?:[^"]|"")*"|[^${delimiter}]*)`, 'g');
    const row = [];
    let m;
    while ((m = regex.exec(line)) !== null) {
      let val = m[1] || '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      row.push(val.trim());
    }
    return row;
  };

  // Helper for matching employee names/aliases
  const matchEmployee = (raw) => {
    if (!raw) return null;
    const clean = raw.trim().toLowerCase();
    return companyEmployees.find(e => {
      const eName = e.name.toLowerCase();
      const eId = e.id.toLowerCase();
      if (eId === clean || eName === clean) return true;
      if (clean === 'kumari' && eName.includes('kumari')) return true;
      if (clean === 'gopal' && (eName.includes('gopal') || eName.includes('sai gopal'))) return true;
      if ((clean === 'shiva' || clean === 'siva') && (eName.includes('siva') || eName.includes('shiva') || eName.includes('sunkara'))) return true;
      return (clean.length > 2 && (eName.includes(clean) || clean.includes(eName)));
    });
  };

  // Extract month from document if present (e.g. "OCTOBER 2026")
  let effectiveMonth = targetMonth;
  for (let i = 0; i < Math.min(4, lines.length); i++) {
    const l = lines[i].toUpperCase();
    if (l.includes('OCTOBER') && l.includes('2026')) effectiveMonth = '2026-10';
    else if (l.includes('NOVEMBER') && l.includes('2026')) effectiveMonth = '2026-11';
    else if (l.includes('DECEMBER') && l.includes('2026')) effectiveMonth = '2026-12';
    else if (l.includes('SEPTEMBER') && l.includes('2026')) effectiveMonth = '2026-09';
  }

  // Scan first few rows to locate the real header line
  let headerRowIndex = 0;
  let headerCols = splitLine(lines[0]);
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const row = splitLine(lines[i]);
    const rowLower = row.map(c => c.toLowerCase());
    if (rowLower.includes('date') || rowLower.includes('day') || rowLower.includes('employee id') || rowLower.includes('employee name')) {
      headerRowIndex = i;
      headerCols = row;
      break;
    }
  }

  const headerLower = headerCols.map(h => h.toLowerCase().trim());
  const isMatrix = headerLower.some(h => /^[0-9]{1,2}$/.test(h.replace(/\s+/g, '')));

  // Check if header contains employee name columns (Format 3: Register with Staff Columns)
  const staffColMatches = [];
  headerCols.forEach((colName, idx) => {
    if (idx === 0 || idx === 1) {
      const lower = colName.toLowerCase();
      if (lower === 'date' || lower === 'day' || lower === 's.no' || lower === 'sl') return;
    }
    const matched = matchEmployee(colName);
    if (matched) {
      staffColMatches.push({ index: idx, emp: matched, rawHeader: colName });
    }
  });

  const parsedRecords = [];

  if (staffColMatches.length > 0) {
    console.log(`Format detected: Daily Attendance Register with Employee Columns (${staffColMatches.map(s => s.emp.name).join(', ')}) for ${effectiveMonth}`);
    
    // Process each day row
    for (let i = headerRowIndex + 1; i < lines.length; i++) {
      const cols = splitLine(lines[i]);
      if (cols.length === 0 || cols.every(c => !c)) continue;
      
      // First column is usually day number (1..31)
      const dayNum = parseInt(cols[0].replace(/\D/g, ''), 10);
      if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) continue;

      const dateStr = `${effectiveMonth}-${String(dayNum).padStart(2, '0')}`;
      const holidayNote = cols[cols.length - 1] || '';

      staffColMatches.forEach(({ index, emp }) => {
        const rawStatus = (cols[index] || '').trim().toUpperCase();
        if (!rawStatus || rawStatus === '—' || rawStatus === '-') return;

        let status = 'PRESENT';
        if (rawStatus === 'P' || rawStatus === 'PRESENT') status = 'PRESENT';
        else if (rawStatus === 'H' || rawStatus === 'HALF_DAY' || rawStatus === '0.5') status = 'HALF_DAY';
        else if (rawStatus === 'L' || rawStatus === 'LEAVE') status = 'LEAVE';
        else if (rawStatus === 'A' || rawStatus === 'ABSENT' || rawStatus === '0') status = 'ABSENT';
        else return;

        parsedRecords.push({
          employeeId: emp.id,
          employeeName: emp.name,
          date: dateStr,
          status,
          inTime: status === 'PRESENT' ? '09:30' : undefined,
          outTime: status === 'PRESENT' ? '18:30' : undefined,
          notes: holidayNote || 'October Register Import'
        });
      });
    }

    // Check if any row mentions an advance (e.g. SIVA - ADVANCE AMOUNT - 6000/-)
    for (const line of lines) {
      if (line.includes('ADVANCE AMOUNT')) {
        console.log(`[Notice] Detected Advance note in register: "${line}"`);
      }
    }

  } else if (isMatrix) {
    console.log(`Format detected: Monthly Attendance Matrix for ${effectiveMonth}`);
    const dayCols = [];
    headerLower.forEach((h, idx) => {
      const n = parseInt(h.replace(/\D/g, ''), 10);
      if (!isNaN(n) && n >= 1 && n <= 31) {
        dayCols.push({ dayNum: n, index: idx });
      }
    });

    for (let i = headerRowIndex + 1; i < lines.length; i++) {
      const cols = splitLine(lines[i]);
      if (cols.length < 2) continue;
      const rawId = cols[0];
      const rawName = cols[1];

      const emp = matchEmployee(rawName) || matchEmployee(rawId);

      if (!emp) {
        console.warn(`[Skip] Staff not recognized: "${rawName}" (${rawId})`);
        continue;
      }

      dayCols.forEach(({ dayNum, index }) => {
        const rawStatus = (cols[index] || '').trim().toUpperCase();
        if (!rawStatus || rawStatus === '—' || rawStatus === '-') return;

        let status = 'PRESENT';
        if (rawStatus === 'P' || rawStatus === 'PRESENT') status = 'PRESENT';
        else if (rawStatus === 'H' || rawStatus === 'HALF_DAY' || rawStatus === '0.5') status = 'HALF_DAY';
        else if (rawStatus === 'L' || rawStatus === 'LEAVE') status = 'LEAVE';
        else if (rawStatus === 'A' || rawStatus === 'ABSENT' || rawStatus === '0') status = 'ABSENT';
        else if (rawStatus === 'SUN' || rawStatus === 'OFF') return;

        const dateStr = `${effectiveMonth}-${String(dayNum).padStart(2, '0')}`;
        parsedRecords.push({
          employeeId: emp.id,
          employeeName: emp.name,
          date: dateStr,
          status,
          notes: 'CLI Matrix Import'
        });
      });
    }
  } else {
    console.log("Format detected: Daily Punch Row Logs");
    let dateIdx = headerLower.findIndex(h => h.includes('date'));
    let idIdx = headerLower.findIndex(h => h.includes('id') || h.includes('code'));
    let nameIdx = headerLower.findIndex(h => h.includes('name') || h.includes('staff') || h.includes('emp'));
    let statusIdx = headerLower.findIndex(h => h.includes('status') || h.includes('punch') || h.includes('attend'));
    let inIdx = headerLower.findIndex(h => h.includes('in'));
    let outIdx = headerLower.findIndex(h => h.includes('out'));

    if (dateIdx === -1) dateIdx = 0;
    if (idIdx === -1 && nameIdx === -1) { idIdx = 1; nameIdx = 2; }
    if (statusIdx === -1) statusIdx = 3;

    for (let i = headerRowIndex + 1; i < lines.length; i++) {
      const cols = splitLine(lines[i]);
      if (cols.length === 0 || cols.every(c => !c)) continue;

      let rawDate = (cols[dateIdx] || '').trim();
      const rawId = idIdx >= 0 ? (cols[idIdx] || '').trim() : '';
      const rawName = nameIdx >= 0 ? (cols[nameIdx] || '').trim() : '';
      const rawStatus = (cols[statusIdx] || 'PRESENT').trim().toUpperCase();
      const inTime = inIdx >= 0 ? (cols[inIdx] || '').trim() : undefined;
      const outTime = outIdx >= 0 ? (cols[outIdx] || '').trim() : undefined;

      let parsedDate = rawDate;
      if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(rawDate)) {
        const parts = rawDate.split(/[-/]/);
        parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }

      const emp = companyEmployees.find(e => 
        (rawId && e.id.toLowerCase() === rawId.toLowerCase()) ||
        (rawName && e.name.toLowerCase() === rawName.toLowerCase()) ||
        (rawName && rawName.length > 2 && (e.name.toLowerCase().includes(rawName.toLowerCase()) || rawName.toLowerCase().includes(e.name.toLowerCase())))
      );

      if (!emp) {
        console.warn(`[Skip] Staff not recognized on row ${i}: "${rawName}" (${rawId})`);
        continue;
      }

      let status = 'PRESENT';
      if (rawStatus.startsWith('H') || rawStatus === '0.5') status = 'HALF_DAY';
      else if (rawStatus.startsWith('L')) status = 'LEAVE';
      else if (rawStatus.startsWith('A') || rawStatus === '0') status = 'ABSENT';

      parsedRecords.push({
        employeeId: emp.id,
        employeeName: emp.name,
        date: parsedDate,
        status,
        inTime,
        outTime,
        notes: 'CLI Daily Import'
      });
    }
  }

  console.log(`\nReady to import ${parsedRecords.length} records into Firestore...`);
  let successCount = 0;

  for (const r of parsedRecords) {
    const recordId = `ATT_${r.employeeId}_${r.date}`;
    const workingMins = r.status === 'HALF_DAY' ? 240 : (r.status === 'PRESENT' ? 480 : 0);
    const nowIso = new Date().toISOString();

    const payload = {
      id: recordId,
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      employeeRole: 'Employee',
      date: r.date,
      checkInTime: r.inTime ? `${r.date}T${r.inTime}:00.000Z` : `${r.date}T09:30:00.000Z`,
      checkOutTime: r.outTime ? `${r.date}T${r.outTime}:00.000Z` : (r.status === 'HALF_DAY' ? `${r.date}T13:30:00.000Z` : `${r.date}T18:30:00.000Z`),
      totalWorkingMinutes: workingMins,
      lateMinutes: 0,
      overtimeMinutes: 0,
      checkInLocation: null,
      checkOutLocation: null,
      status: r.status,
      deviceInfo: 'Imported via Terminal CLI',
      notes: r.notes || 'CLI Attendance Import',
      verifiedByAdmin: true,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await setDoc(doc(db, 'attendance', recordId), payload, { merge: true });
    successCount++;
  }

  console.log(`\nSUCCESS: Imported ${successCount} attendance records to Firestore.`);
  process.exit(0);
}

run().catch(e => {
  console.error("CLI Import Error:", e);
  process.exit(1);
});
