/* อ่านไฟล์ Excel / CSV ในเบราว์เซอร์ (ไม่มีการอัปโหลดขึ้นเซิร์ฟเวอร์)
 * ใช้ SheetJS (libs/xlsx.full.min.js) + ตรรกะจับคู่คอลัมน์จากโปรแกรมเดิม */
(function (global) {
  "use strict";

  var F = global.StickerFields;
  var trim = F.trim;

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function formatCell(raw) {
    if (raw === null || raw === undefined) return "";
    if (raw instanceof Date && !isNaN(raw.getTime())) {
      return raw.getFullYear() + "-" + pad2(raw.getMonth() + 1) + "-" + pad2(raw.getDate());
    }
    if (typeof raw === "number") {
      if (!isFinite(raw)) return "";
      if (Math.abs(raw - Math.round(raw)) < 1e-9) return String(Math.round(raw));
      return String(Math.round(raw * 10000) / 10000);
    }
    if (typeof raw === "boolean") return raw ? "TRUE" : "FALSE";
    return String(raw);
  }

  function nonEmptyCount(row) {
    var n = 0;
    for (var i = 0; i < row.length; i++) if (trim(row[i]).length) n++;
    return n;
  }

  // ---------------------------------------------------------------
  // วันที่ใน Excel: ใช้ข้อความที่จัดรูปแบบแล้ว (cell.w) เพื่อไม่ให้ปี 2 หลัก
  // กลายเป็น ค.ศ. 1969 — ข้อมูลไทยมักพิมพ์ปี พ.ศ. 2 หลัก (69 = 2569)
  function isDateCell(cell) {
    if (!cell || cell.t !== "n" || typeof cell.v !== "number") return false;
    var z = String(cell.z || "");
    if (!/[dmy]/i.test(z)) return false;
    return /^\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}$/.test(trim(cell.w));
  }

  function dateFromCell(cell) {
    var m = trim(cell.w).match(/^(\d{1,4})[\/-](\d{1,2})[\/-](\d{1,4})$/);
    if (!m) return null;

    var a = parseInt(m[1], 10), b = parseInt(m[2], 10), c = parseInt(m[3], 10);
    var y, mo, d;
    var z = String(cell.z || "").toLowerCase();
    var dayFirst = /d[^a-z]*[\/-][^a-z]*m/.test(z);

    if (m[1].length === 4) {
      y = a; mo = b; d = c;
    } else {
      y = c;
      if (a > 12) { d = a; mo = b; }
      else if (b > 12) { mo = a; d = b; }
      else if (dayFirst) { d = a; mo = b; }
      else { mo = a; d = b; }
    }

    if (y < 100) {
      // ปี 2 หลักมีสองแบบในไฟล์จริง: 18 = ค.ศ. 2018 และ 69 = พ.ศ. 2569
      // เลือกปีที่ใกล้ปีปัจจุบันที่สุด และไม่เป็นอนาคตเกิน 1 ปี
      var current = new Date().getFullYear();
      var ce = 2000 + y;
      var beAsCe = 2500 + y - 543;
      var candidates = [];
      if (ce <= current + 1) candidates.push(ce);
      if (beAsCe <= current + 1) candidates.push(beAsCe);
      if (candidates.length === 1) y = candidates[0];
      else if (candidates.length > 1) {
        y = Math.abs(candidates[0] - current) <= Math.abs(candidates[1] - current)
          ? candidates[0] : candidates[1];
      } else {
        y = ce;
      }
    }
    if (y >= 2400) y -= 543;          // พ.ศ. 4 หลัก → ค.ศ.

    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
  }

  function cellValue(cell) {
    if (!cell) return "";
    if (isDateCell(cell)) {
      var d = dateFromCell(cell);
      if (d) return d;
    }
    return cell.v;
  }

  function findHeaderRow(rows) {
    var best = -1, bestScore = -1;
    var limit = Math.min(rows.length, 12);
    for (var i = 0; i < limit; i++) {
      var row = rows[i] || [];
      var filled = nonEmptyCount(row);
      if (!filled) continue;
      var matches = 0;
      for (var c = 0; c < row.length; c++) {
        var h = F.ColumnMapper.normalize(row[c]);
        if (h && F.ColumnMapper.detect(h)) matches++;
      }
      var score = matches * 100 + filled;
      if (matches >= 2 && score > bestScore) {
        best = i; bestScore = score;
      } else if (best < 0 && i === 0 && filled >= 2) {
        best = i; bestScore = score;
      }
    }
    if (best >= 0) return best;
    for (var r = 0; r < rows.length; r++) {
      if (nonEmptyCount(rows[r] || []) > 0) return r;
    }
    return 0;
  }

  function buildRecords(rows, headerIndex) {
    var headers = (rows[headerIndex] || []).map(function (h) { return trim(h); });
    var mapping = F.ColumnMapper.buildMapping(headers);
    var records = [];
    var warnings = [];

    for (var r = headerIndex + 1; r < rows.length; r++) {
      var row = rows[r] || [];
      var rec = new F.StickerRecord();
      rec.sourceRow = String(r + 1);
      var any = false;

      for (var i = 0; i < row.length; i++) {
        var text = formatCell(row[i]);
        if (text.length) any = true;

        var key = i < mapping.length ? mapping[i] : F.ColumnMapper.extraKey(i);
        if (key) rec.set(key, text);

        var rawHeader = i < headers.length ? headers[i] : "";
        if (rawHeader) {
          rec.set(rawHeader, text);
          var compact = F.compactKey(rawHeader);
          if (compact) rec.set(compact, text);
        }
      }

      if (any) records.push(rec);
    }

    if (records.length === 0 && headers.length > 0) warnings.push("ชีตนี้ไม่มีข้อมูล");
    return { headers: headers, records: records, warnings: warnings };
  }

  // ---------------------------------------------------------------
  // CSV
  function decodeBytes(bytes) {
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return new TextDecoder("utf-8").decode(bytes.subarray(3));
    }
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return new TextDecoder("utf-16le").decode(bytes.subarray(2));
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (e) { /* not utf-8 */ }
    try {
      return new TextDecoder("windows-874").decode(bytes);   // Thai TIS-620
    } catch (e) { /* not supported */ }
    return new TextDecoder("utf-8").decode(bytes);
  }

  function detectDelimiter(text) {
    var counts = { ",": 0, ";": 0, "\t": 0 };
    var inQuotes = false;
    var lines = 0;
    for (var i = 0; i < text.length && lines < 5; i++) {
      var ch = text[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (!inQuotes && (ch === "\n" || ch === "\r")) {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        lines++;
      } else if (!inQuotes && (ch === "," || ch === ";" || ch === "\t")) {
        counts[ch]++;
      }
    }
    var best = ",", n = -1;
    Object.keys(counts).forEach(function (k) {
      if (counts[k] > n) { n = counts[k]; best = k; }
    });
    return best;
  }

  function parseCsv(text) {
    var delimiter = detectDelimiter(text);
    var rows = [];
    var row = [];
    var sb = "";
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { sb += '"'; i++; }
          else inQuotes = false;
        } else {
          sb += c;
        }
      } else {
        if (c === '"') inQuotes = true;
        else if (c === delimiter) { row.push(sb); sb = ""; }
        else if (c === "\r") { /* ignore */ }
        else if (c === "\n") { row.push(sb); sb = ""; rows.push(row); row = []; }
        else sb += c;
      }
    }
    if (sb.length > 0 || row.length > 0) { row.push(sb); rows.push(row); }
    return rows;
  }

  // ---------------------------------------------------------------
  async function readFile(file) {
    var name = file.name || "ข้อมูล";
    var ext = (name.split(".").pop() || "").toLowerCase();
    var buffer = await file.arrayBuffer();
    var bytes = new Uint8Array(buffer);

    if (ext === "csv" || ext === "txt") {
      var text = decodeBytes(bytes);
      return {
        kind: "csv",
        name: name,
        sheetNames: [name],
        rowsBySheet: (function () { var o = {}; o[name] = parseCsv(text); return o; })(),
        warnings: []
      };
    }

    if (!global.XLSX) throw new Error("ไม่พบตัวอ่านไฟล์ Excel (libs/xlsx.full.min.js)");
    var wb;
    try {
      wb = global.XLSX.read(bytes, { type: "array", cellDates: false, cellNF: true, codepage: 874 });
    } catch (e) {
      throw new Error("เปิดไฟล์ Excel ไม่สำเร็จ: " + (e.message || e));
    }
    var names = wb.SheetNames.slice();
    if (!names.length) throw new Error("ไฟล์นี้ไม่มีชีตข้อมูล");

    return {
      kind: "excel",
      name: name,
      workbook: wb,
      sheetNames: names,
      rowsBySheet: {},
      warnings: []
    };
  }

  function rowsForSheet(book, sheetName) {
    if (book.rowsBySheet[sheetName]) return book.rowsBySheet[sheetName];
    if (book.kind !== "excel") return [];
    var ws = book.workbook.Sheets[sheetName];
    if (!ws || !ws["!ref"]) return [];

    // อ่านทีละเซลล์เพื่อเก็บ cell.w (ข้อความวันที่ที่จัดรูปแบบแล้ว)
    var range = global.XLSX.utils.decode_range(ws["!ref"]);
    var rows = [];
    for (var r = range.s.r; r <= range.e.r; r++) {
      var row = [];
      for (var c = range.s.c; c <= range.e.c; c++) {
        var addr = global.XLSX.utils.encode_cell({ r: r, c: c });
        row.push(cellValue(ws[addr]));
      }
      rows.push(row);
    }
    book.rowsBySheet[sheetName] = rows;
    return rows;
  }

  /** เลือกชีตที่มีข้อมูลมากที่สุด (เหมือนโปรแกรมเดิม) */
  function pickBestSheet(book) {
    var best = book.sheetNames[0] || "";
    var bestCount = -1;
    for (var i = 0; i < book.sheetNames.length; i++) {
      var name = book.sheetNames[i];
      var rows = rowsForSheet(book, name);
      var h = findHeaderRow(rows);
      var count = 0;
      for (var r = h + 1; r < rows.length; r++) {
        if (nonEmptyCount(rows[r])) count++;
      }
      if (count > bestCount) { best = name; bestCount = count; }
    }
    return best;
  }

  function readSheet(book, sheetName) {
    var rows = rowsForSheet(book, sheetName);
    if (!rows.length) {
      return { sheetName: sheetName, headers: [], records: [], warnings: ["ชีตนี้ไม่มีข้อมูล"] };
    }
    var headerIndex = findHeaderRow(rows);
    var built = buildRecords(rows, headerIndex);
    return {
      sheetName: sheetName,
      headerIndex: headerIndex,
      headers: built.headers,
      records: built.records,
      warnings: built.warnings
    };
  }

  global.Spreadsheet = {
    readFile: readFile,
    pickBestSheet: pickBestSheet,
    readSheet: readSheet,
    parseCsv: parseCsv,
    decodeBytes: decodeBytes,
    formatCell: formatCell
  };
})(window);
