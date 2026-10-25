/* =========================================================
   StickerPrint Web — ตรรกะหน้าจอทั้งหมด
   ========================================================= */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var CFG = window.APP_CONFIG || {};
  var R = window.LabelRenderer;
  var F = window.StickerFields;
  var TEMPLATES = window.BUILTIN_TEMPLATES || [];

  var PAPER_SIZES = {
    a4: [210, 297],
    a5: [148, 210],
    a3: [297, 420],
    letter: [215.9, 279.4]
  };
  var STORAGE_SETTINGS = "sp_settings_v1";
  var STORAGE_LOGO = "sp_logo_v1";
  var PREVIEW_DPI = 140;
  var PRINT_DPI = 300;
  var PDF_DPI = 250;
  var PNG_DPI = 300;

  var state = {
    step: 1,
    book: null,
    demo: false,
    records: [],
    filtered: [],
    headers: [],
    sheetNames: [],
    sheetName: "",
    fileName: "",
    parseWarnings: [],
    page: 0,
    templateId: "film-a4-2x5",
    baseTemplate: null,
    template: null,
    custom: defaultCustom(),
    lines: null,                 // 3 บรรทัดข้อความจากแม่แบบสำเร็จรูป (null = สร้างจาก checkbox)
    tokens: { no: true, name: true, addr: true, id: true, year: false, lens: true },
    offsets: { x: 0, y: 0 },
    trialDone: false,
    logoSrc: null,
    logoImage: null,
    defaultLogoImage: null,
    busy: false
  };

  var previewSeq = 0;
  var saveTimer = null;
  var settingsTimer = null;
  var searchTimer = null;
  var toastTimer = null;

  // ---------------------------------------------------------------
  function defaultCustom() {
    return {
      paper: "a4",
      landscape: false,
      marginX: 10,
      marginY: 10,
      cols: 3,
      rows: 8,
      gapX: 3,
      gapY: 3,
      font: "Tahoma",
      fontSize: 10,
      align: "Left",
      borders: true,
      restart: false
    };
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function round1(v) { return Math.round(v * 10) / 10; }
  function numFrom(id, fallback) {
    var v = parseFloat($(id).value);
    return isFinite(v) ? v : fallback;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtInt(n) { return Number(n || 0).toLocaleString("th-TH"); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function builtinById(id) {
    for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].Id === id) return TEMPLATES[i];
    return null;
  }

  function isComplex(t) {
    if (!t) return false;
    return (t.Images && t.Images.length > 0) ||
           (t.PageLines && t.PageLines.length > 0) ||
           (t.Elements && t.Elements.length > 3);
  }

  function currentPreset() {
    return state.templateId === "custom" ? null : builtinById(state.templateId);
  }

  function isComplexMode() {
    var p = currentPreset();
    return !!(p && isComplex(p));
  }

  // ---------------------------------------------------------------
  // โหลด/บันทึกค่าที่จำไว้
  function loadSettings() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_SETTINGS); } catch (e) { /* ignore */ }
    if (!raw) return;
    try {
      var s = JSON.parse(raw);
      if (!s || typeof s !== "object") return;

      if (s.custom && typeof s.custom === "object") {
        var c = s.custom;
        state.custom.paper = PAPER_SIZES[c.paper] ? c.paper : "a4";
        state.custom.landscape = !!c.landscape;
        state.custom.marginX = clamp(isFinite(Number(c.marginX)) ? Number(c.marginX) : 10, 0, 50);
        state.custom.marginY = clamp(isFinite(Number(c.marginY)) ? Number(c.marginY) : 10, 0, 50);
        state.custom.cols = Math.round(clamp(Number(c.cols) || 3, 1, 8));
        state.custom.rows = Math.round(clamp(Number(c.rows) || 8, 1, 20));
        state.custom.gapX = clamp(Number(c.gapX) || 0, 0, 20);
        state.custom.gapY = clamp(Number(c.gapY) || 0, 0, 20);
        state.custom.font = c.font || "Tahoma";
        state.custom.fontSize = clamp(Number(c.fontSize) || 10, 4, 30);
        state.custom.align = (c.align === "Center" || c.align === "Right") ? c.align : "Left";
        state.custom.borders = !!c.borders;
        state.custom.restart = !!c.restart;
      }

      if (s.tokens && typeof s.tokens === "object") {
        ["no", "name", "addr", "id", "year", "lens"].forEach(function (k) {
          if (typeof s.tokens[k] === "boolean") state.tokens[k] = s.tokens[k];
        });
      }

      if (s.offsets && typeof s.offsets === "object") {
        state.offsets.x = clamp(round1(Number(s.offsets.x) || 0), -10, 10);
        state.offsets.y = clamp(round1(Number(s.offsets.y) || 0), -10, 10);
      }

      if (typeof s.templateId === "string" &&
          (s.templateId === "custom" || builtinById(s.templateId))) {
        state.templateId = s.templateId;
      }

      if (Array.isArray(s.lines) && s.lines.length === 3 &&
          s.lines.every(function (x) { return typeof x === "string"; })) {
        state.lines = s.lines.slice();
      }
      if (state.templateId === "custom") state.lines = null;
    } catch (e) { /* ใช้ค่าเริ่มต้น */ }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(STORAGE_SETTINGS, JSON.stringify({
          version: 1,
          templateId: state.templateId,
          custom: state.custom,
          lines: state.lines,
          tokens: state.tokens,
          offsets: state.offsets
        }));
      } catch (e) { /* ignore */ }
    }, 250);
  }

  // ---------------------------------------------------------------
  // ตัวสร้างแม่แบบ
  function tokenLines() {
    var t = state.tokens;
    return [
      [t.no ? "{{no.}}." : "", t.name ? "{{fullname}}" : ""].filter(Boolean).join(" "),
      t.addr ? "{{address}}" : "",
      [
        t.id ? "เลขบัตรฯ {{idno}}" : "",
        t.year ? "{{birthyear_be}}" : "",
        t.lens ? "{{lens}}" : ""
      ].filter(Boolean).join("   ")
    ];
  }

  function buildSimpleTemplate() {
    var c = state.custom;
    var paper = PAPER_SIZES[c.paper] || PAPER_SIZES.a4;
    var preset = currentPreset();

    var t = {
      Id: preset ? preset.Id : "custom",
      Name: preset ? preset.Name : "ตั้งค่าเอง",
      PageWidthMm: paper[0],
      PageHeightMm: paper[1],
      Landscape: !!c.landscape,
      MarginLeftMm: c.marginX,
      MarginRightMm: c.marginX,
      MarginTopMm: c.marginY,
      MarginBottomMm: c.marginY,
      Columns: c.cols,
      Rows: c.rows,
      GutterXMm: c.gapX,
      GapYMm: c.gapY,
      ShowBorders: !!c.borders,
      SkipBlankSlots: false,
      RestartNumberingPerSheet: !!c.restart,
      FillOrder: "Row",
      Elements: [],
      Images: [],
      PageLines: []
    };

    var g = R.geometry(t);
    var lineH = g.cellH / 3;
    var lines = state.lines || tokenLines();

    lines.forEach(function (text, index) {
      if (!text) return;
      t.Elements.push({
        Xmm: 2,
        Ymm: round1(1.2 + index * lineH),
        Wmm: round1(Math.max(5, g.cellW - 4)),
        Hmm: round1(Math.max(3, lineH - 1.2)),
        Text: text,
        FontName: c.font,
        FontSizePt: c.fontSize,
        Bold: index === 0,
        Italic: false,
        Align: c.align,
        VAlign: "Top",
        ForeColor: "#000000",
        LineSpacingMm: 0,
        AutoShrink: true
      });
    });

    return t;
  }

  function loadPresetIntoSettings(t) {
    var c = state.custom;
    var min = Math.min(t.PageWidthMm, t.PageHeightMm);
    var max = Math.max(t.PageWidthMm, t.PageHeightMm);
    if (Math.abs(min - 148) < 1 && Math.abs(max - 210) < 1) c.paper = "a5";
    else if (Math.abs(min - 297) < 1 && Math.abs(max - 420) < 1) c.paper = "a3";
    else if (Math.abs(min - 215.9) < 1 && Math.abs(max - 279.4) < 1) c.paper = "letter";
    else c.paper = "a4";

    c.landscape = !!t.Landscape;
    c.marginX = t.MarginLeftMm;
    c.marginY = t.MarginTopMm;
    c.cols = t.Columns;
    c.rows = t.Rows;
    c.gapX = t.GutterXMm;
    c.gapY = t.GapYMm;
    c.borders = !!t.ShowBorders;
    c.restart = !!t.RestartNumberingPerSheet;

    var first = (t.Elements || []).slice().sort(function (a, b) { return a.Ymm - b.Ymm; })[0];
    if (first) {
      c.font = first.FontName || "Tahoma";
      c.fontSize = first.FontSizePt || 10;
      c.align = first.Align || "Left";
    }
    uiFromCustom();
  }

  function syncChecksFromElements(elements) {
    var lines = (elements || []).slice().sort(function (a, b) { return a.Ymm - b.Ymm; })
      .slice(0, 3).map(function (e) { return e.Text || ""; });
    var l1 = lines[0] || "", l2 = lines[1] || "", l3 = lines[2] || "";
    state.tokens.no = l1.indexOf("{{no.}}") >= 0;
    state.tokens.name = l1.indexOf("{{fullname}}") >= 0;
    state.tokens.addr = l2.indexOf("{{address}}") >= 0;
    state.tokens.id = l3.indexOf("{{idno}}") >= 0;
    state.tokens.year = l3.indexOf("{{birthyear_be}}") >= 0;
    state.tokens.lens = l3.indexOf("{{lens}}") >= 0;
  }

  // ---------------------------------------------------------------
  // UI ของการตั้งค่าเอง
  function setSelect(id, value) {
    var sel = $(id);
    var v = String(value);
    var found = false;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === v) { found = true; break; }
    }
    if (!found) {
      var o = document.createElement("option");
      o.value = v; o.textContent = v;
      sel.appendChild(o);
    }
    sel.value = v;
  }

  function uiFromCustom() {
    var c = state.custom;
    setSelect("optPaper", c.paper);
    setSelect("optLandscape", c.landscape ? "1" : "0");
    $("optMarginX").value = c.marginX;
    $("optMarginY").value = c.marginY;
    $("optCols").value = c.cols;
    $("optRows").value = c.rows;
    $("optGapX").value = c.gapX;
    $("optGapY").value = c.gapY;
    setSelect("optFont", c.font);
    $("optFontSize").value = c.fontSize;
    setSelect("optAlign", c.align);
    $("optBorders").checked = !!c.borders;
    $("optRestart").checked = !!c.restart;
  }

  function readCustomFromUi() {
    var c = state.custom;
    c.paper = $("optPaper").value;
    c.landscape = $("optLandscape").value === "1";
    c.marginX = clamp(numFrom("optMarginX", c.marginX), 0, 50);
    c.marginY = clamp(numFrom("optMarginY", c.marginY), 0, 50);
    c.cols = Math.round(clamp(numFrom("optCols", c.cols), 1, 8));
    c.rows = Math.round(clamp(numFrom("optRows", c.rows), 1, 20));
    c.gapX = clamp(numFrom("optGapX", c.gapX), 0, 20);
    c.gapY = clamp(numFrom("optGapY", c.gapY), 0, 20);
    c.font = $("optFont").value || "Tahoma";
    c.fontSize = clamp(numFrom("optFontSize", c.fontSize), 4, 30);
    c.align = $("optAlign").value || "Left";
    c.borders = $("optBorders").checked;
    c.restart = $("optRestart").checked;
  }

  // ---------------------------------------------------------------
  // แม่แบบ + พรีวิว
  function rebuild(resetTrial) {
    if (!state.baseTemplate) {
      var p = currentPreset();
      state.baseTemplate = p && isComplex(p) ? clone(p) : buildSimpleTemplate();
    }
    state.template = R.applyOffsets(state.baseTemplate, state.offsets.x, state.offsets.y);
    if (resetTrial) state.trialDone = false;

    updateSpec();
    updateTemplateControls();
    updateTemplateCards();
    updateLogoUi();
    updateSummary();
    updateFooterNav();
    updateNudgeLabel();
    if (state.step === 2) renderPreview();
    scheduleSave();
  }

  function refreshBaseTemplate() {
    var p = currentPreset();
    state.baseTemplate = p && isComplex(p) ? clone(p) : buildSimpleTemplate();
    rebuild(true);
  }

  function presetLines(t) {
    var lines = (t.Elements || []).slice()
      .sort(function (a, b) { return a.Ymm - b.Ymm; })
      .slice(0, 3)
      .map(function (e) { return e.Text || ""; });
    while (lines.length < 3) lines.push("");
    return lines;
  }

  function selectTemplate(id) {
    if (id !== "custom" && !builtinById(id)) return;
    state.templateId = id;

    var preset = id === "custom" ? null : builtinById(id);
    if (preset && !isComplex(preset)) {
      loadPresetIntoSettings(preset);
      syncChecksFromElements(preset.Elements);
      state.lines = presetLines(preset);
    } else if (id === "custom") {
      state.lines = null;
    }

    state.trialDone = false;
    state.baseTemplate = preset && isComplex(preset) ? clone(preset) : buildSimpleTemplate();
    rebuild(false);
  }

  function updateTemplateCards() {
    var cards = document.querySelectorAll(".tpl-card");
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.toggle("is-sel", cards[i].getAttribute("data-tpl") === state.templateId);
      cards[i].setAttribute("aria-pressed", cards[i].getAttribute("data-tpl") === state.templateId ? "true" : "false");
    }
  }

  function updateTemplateControls() {
    var complex = isComplexMode();
    var inputs = document.querySelectorAll("#tokenGrid input[data-token]");
    for (var i = 0; i < inputs.length; i++) {
      var key = inputs[i].getAttribute("data-token");
      inputs[i].checked = !!state.tokens[key];
      inputs[i].disabled = complex;
      var label = inputs[i].closest("label");
      if (label) label.classList.toggle("is-on", !!state.tokens[key] && !complex);
    }
    $("tokenGrid").classList.toggle("is-disabled", complex);
    $("tokenNote").classList.toggle("hidden", !complex);
    $("tokenHint").textContent = complex ? "(แม่แบบกำหนดไว้แล้ว)" : "";
    $("customSettings").classList.toggle("hidden", complex);
  }

  function updateSpec() {
    if (!state.template) { $("specBadge").textContent = ""; return; }
    var g = R.geometry(state.template);
    $("specBadge").textContent =
      g.columns + "×" + g.rows + " · " + g.perPage + " ป้าย/แผ่น · " +
      Math.round(g.W) + "×" + Math.round(g.H) + " มม.";
  }

  function renderOptions() {
    return {
      logoImage: state.logoImage,
      defaultLogoUrl: "assets/logo-cross.png"
    };
  }

  async function renderPreview() {
    var seq = ++previewSeq;
    var stage = $("previewStage");

    if (!state.filtered.length) {
      stage.innerHTML = state.records.length
        ? '<div class="preview-empty">ไม่พบรายชื่อที่ตรงกับตัวกรอง</div>'
        : '<div class="preview-empty">เลือกไฟล์ข้อมูลก่อนเพื่อดูตัวอย่าง</div>';
      $("pageLabel").textContent = "หน้า 0 / 0";
      $("btnPrevPage").disabled = true;
      $("btnNextPage").disabled = true;
      return;
    }

    var total = R.pageCount(state.template, state.filtered.length);
    if (!total) return;
    state.page = clamp(state.page, 0, total - 1);

    stage.innerHTML = '<div class="preview-loading">กำลังวาดตัวอย่าง…</div>';

    try {
      var canvas = await R.renderPage(state.template, state.filtered, state.page, PREVIEW_DPI, renderOptions());
      if (seq !== previewSeq) return;
      canvas.className = "page-canvas";
      stage.innerHTML = "";
      stage.appendChild(canvas);
      $("pageLabel").textContent = "หน้า " + (state.page + 1) + " / " + total;
      $("btnPrevPage").disabled = state.page <= 0;
      $("btnNextPage").disabled = state.page >= total - 1;
    } catch (e) {
      if (seq !== previewSeq) return;
      console.error(e);
      stage.innerHTML = '<div class="preview-empty">วาดตัวอย่างไม่สำเร็จ</div>';
    }
  }

  // ---------------------------------------------------------------
  // ข้อมูล + ตาราง
  function displayArea(value) {
    return String(value || "").replace(/^หมู่ที่\s*(\d)/, "หมู่ที่ $1");
  }

  function populateTambon() {
    var sel = $("tambonSelect");
    var prev = sel.value;
    sel.innerHTML = '<option value="">ทุกตำบล / ชุมชน</option>';

    var seen = Object.create(null);
    var list = [];
    for (var i = 0; i < state.records.length; i++) {
      var rec = state.records[i];
      var v = F.trim(rec.get("tambon")) || F.trim(rec.get("community"));
      if (v && !seen[v]) { seen[v] = true; list.push(v); }
    }
    list.sort(function (a, b) { return a.localeCompare(b, "th"); });
    for (i = 0; i < list.length; i++) {
      var o = document.createElement("option");
      o.value = list[i];
      o.textContent = displayArea(list[i]);
      sel.appendChild(o);
    }
    sel.value = list.indexOf(prev) >= 0 ? prev : "";
  }

  function applyFilter(resetPage) {
    var search = $("searchInput").value.trim().toLowerCase();
    var tambon = $("tambonSelect").value;

    state.filtered = state.records.filter(function (r) {
      var area = F.trim(r.get("tambon")) || F.trim(r.get("community"));
      var areaText = displayArea(area);
      if (tambon && area !== tambon) return false;
      if (!search) return true;
      return r.fullName.toLowerCase().indexOf(search) >= 0 ||
             r.idNo.toLowerCase().indexOf(search) >= 0 ||
             F.trim(r.get("house")).toLowerCase().indexOf(search) >= 0 ||
             area.toLowerCase().indexOf(search) >= 0 ||
             areaText.toLowerCase().indexOf(search) >= 0;
    });

    state.filtered.forEach(function (r, i) { r.sequence = i + 1; });
    if (resetPage) state.page = 0;
    state.trialDone = false;

    renderTable();
    $("countBadge").textContent = "แสดง " + fmtInt(state.filtered.length) + " จาก " + fmtInt(state.records.length) + " คน";

    updateSummary();
    updateFooterNav();
    if (state.step === 2) renderPreview();
  }

  function renderTable() {
    var tbody = document.querySelector("#dataTable tbody");
    var limit = CFG.maxPreviewRows || 1000;
    var html = "";

    if (!state.records.length) {
      html = '<tr class="empty-row"><td colspan="5">ยังไม่มีข้อมูล — เลือกไฟล์ก่อน</td></tr>';
    } else if (!state.filtered.length) {
      html = '<tr class="empty-row"><td colspan="5">ไม่พบรายชื่อที่ตรงกับตัวกรอง</td></tr>';
    } else {
      var shown = state.filtered.slice(0, limit);
      for (var i = 0; i < shown.length; i++) {
        var r = shown[i];
        var id = r.idNo;
        var idCell = id && !r.idNoValid
          ? '<td class="id-bad mono">' + esc(id) + "</td>"
          : '<td class="mono">' + esc(id || "—") + "</td>";
        var lens = r.lensSummary || (F.trim(r.get("screencode")) ? "คัดกรอง " + F.trim(r.get("screencode")) : "—");
        html += "<tr>" +
          '<td class="num">' + r.sequence + "</td>" +
          "<td>" + esc(r.fullName || "—") + "</td>" +
          idCell +
          "<td>" + esc(r.addressLine || "—") + "</td>" +
          "<td>" + esc(lens) + "</td>" +
          "</tr>";
      }
    }

    tbody.innerHTML = html;
    $("tableCount").textContent = fmtInt(state.filtered.length);
    $("tableNote").textContent = !state.records.length
      ? "ข้อมูลจะแสดงหลังเลือกไฟล์"
      : (state.filtered.length > limit
        ? "แสดง " + fmtInt(limit) + " แถวแรกจาก " + fmtInt(state.filtered.length) + " รายการ"
        : "แสดง " + fmtInt(state.filtered.length) + " รายการ");
  }

  function updateFileUi() {
    var has = state.records.length > 0;
    $("dropZone").classList.toggle("hidden", has);
    $("fileLoaded").classList.toggle("hidden", !has);
    $("btnDemo").parentElement.classList.toggle("hidden", has);

    if (has) {
      $("fileName").textContent = state.fileName || "ข้อมูล";
      $("fileMeta").textContent = fmtInt(state.records.length) + " คน" +
        (state.sheetName ? " · ชีต " + state.sheetName : "");
    }
    $("btnChangeFile").textContent = state.demo ? "เลือกไฟล์จริง" : "เปลี่ยนไฟล์";

    $("sheetRow").classList.toggle("hidden", state.demo || state.sheetNames.length < 2);
    if (!state.demo && state.sheetNames.length) {
      var sel = $("sheetSelect");
      sel.innerHTML = "";
      state.sheetNames.forEach(function (name) {
        var o = document.createElement("option");
        o.value = name; o.textContent = name;
        sel.appendChild(o);
      });
      sel.value = state.sheetName;
    }

    var bad = state.records.filter(function (r) { return r.idNo && !r.idNoValid; }).length;
    $("warnId").classList.toggle("hidden", bad === 0);
    if (bad) {
      $("warnId").innerHTML = "⚠ มี <b>" + fmtInt(bad) + "</b> คนที่เลขบัตรประชาชนไม่ครบ 13 หลัก — พิมพ์ได้ แต่ควรแก้ในไฟล์ Excel ก่อน";
    }

    $("parseNote").classList.toggle("hidden", !state.parseWarnings.length);
    $("parseNote").textContent = state.parseWarnings.join(" · ");
    $("demoNote").classList.toggle("hidden", !state.demo);
  }

  function loadRecords(records, meta) {
    state.records = records;
    state.filtered = [];
    state.headers = meta.headers || [];
    state.sheetName = meta.sheetName || "";
    state.sheetNames = meta.sheetNames || [];
    state.fileName = meta.fileName || "";
    state.demo = !!meta.demo;
    state.parseWarnings = [];
    state.page = 0;
    state.trialDone = false;

    $("searchInput").value = "";
    populateTambon();
    updateFileUi();
    applyFilter(true);
  }

  async function loadFile(file) {
    if (!file || state.busy) return;
    var ext = (file.name.split(".").pop() || "").toLowerCase();
    if (["xls", "xlsx", "xlsm", "csv", "txt"].indexOf(ext) < 0) {
      toast("รองรับเฉพาะไฟล์ .xls .xlsx .xlsm .csv", "error");
      return;
    }

    showBusy("กำลังอ่านไฟล์…", file.name);
    try {
      var book = await window.Spreadsheet.readFile(file);
      var best = window.Spreadsheet.pickBestSheet(book);
      var data = window.Spreadsheet.readSheet(book, best);
      if (!data.records.length) throw new Error("ไม่พบข้อมูลในไฟล์นี้");

      state.book = book;
      loadRecords(data.records, {
        headers: data.headers,
        sheetName: data.sheetName,
        sheetNames: book.sheetNames,
        fileName: file.name,
        demo: false
      });
      state.parseWarnings = data.warnings || [];
      updateFileUi();
      toast("อ่านไฟล์สำเร็จ — " + fmtInt(data.records.length) + " รายชื่อ", "ok");
    } catch (e) {
      console.error(e);
      toast("เปิดไฟล์ไม่สำเร็จ: " + (e.message || e), "error");
    } finally {
      hideBusy();
    }
  }

  async function changeSheet() {
    if (!state.book || state.busy) return;
    var name = $("sheetSelect").value;
    if (!name || name === state.sheetName) return;

    showBusy("กำลังอ่านชีต…", name);
    try {
      var data = window.Spreadsheet.readSheet(state.book, name);
      if (!data.records.length) throw new Error("ชีตนี้ไม่มีข้อมูล");
      loadRecords(data.records, {
        headers: data.headers,
        sheetName: data.sheetName,
        sheetNames: state.book.sheetNames,
        fileName: state.fileName,
        demo: false
      });
      state.parseWarnings = data.warnings || [];
      updateFileUi();
      toast("เปลี่ยนชีตเป็น " + name + " แล้ว", "ok");
    } catch (e) {
      toast("อ่านชีตไม่สำเร็จ: " + (e.message || e), "error");
    } finally {
      hideBusy();
    }
  }

  // ---------------------------------------------------------------
  // ข้อมูลตัวอย่าง
  function buildDemoRecords() {
    var firstNames = ["สมชาย", "สมหญิง", "วิชัย", "มานี", "ประเสริฐ", "อรทัย", "อนุชา", "กมล",
      "สุรชัย", "วันดี", "ทวีศักดิ์", "จิราพร"];
    var lastNames = ["ใจดี", "รักเรียน", "ศรีสุข", "ทองดี", "มั่งมี", "แสงทอง", "บุญมา", "พูลสุข",
      "จันทร์เพ็ญ", "สายทอง", "ธรรมดี", "วงศ์ไทย"];
    var titles = ["นาย", "นาง", "นางสาว", "เด็กชาย", "เด็กหญิง"];
    var tambons = ["ในเมือง", "ท่าศาลา", "ปากพูน", "นาสาร"];
    var communities = ["ชุมชนตลาด", "ชุมชนหน้าวัด", "ชุมชนในเมือง", "ชุมชนท่าศาลา", "ชุมชนปากพูน"];
    var vaValues = ["6/6", "6/9", "6/12", "6/18", "6/24"];
    var screenings = ["สงสัยต้อกระจก", "สงสัยต้อลม", "จอตาเสื่อมตามวัย", "สงสัยต้อเนื้อ", ""];
    var records = [];

    for (var i = 0; i < 24; i++) {
      var r = new F.StickerRecord();
      var age = 60 + (i % 30);
      r.sourceRow = String(i + 2);
      r.set("item", i + 1);
      r.set("title", titles[i % titles.length]);
      r.set("firstname", firstNames[i % firstNames.length]);
      r.set("lastname", lastNames[(i * 5) % lastNames.length]);
      r.set("house", (i + 1) + "/" + ((i % 9) + 1));
      r.set("moo", String((i % 5) + 1));
      r.set("community", communities[i % communities.length]);
      r.set("tambon", tambons[i % tambons.length]);
      r.set("amphoe", "เมือง");
      r.set("province", "นครศรีธรรมราช");
      r.set("idno", (i === 3 || i === 17) ? "1100000000" : "11000000000" + String(i).padStart(2, "0"));
      r.set("age", String(age));
      r.set("birthyear", String((new Date().getFullYear() + 543) - age));
      r.set("readbook", String(150 + ((i % 5) * 50)));
      r.set("pd", String(58 + (i % 8)));
      r.set("va_r", vaValues[i % vaValues.length]);
      r.set("va_l", vaValues[(i + 2) % vaValues.length]);
      r.set("R", "ADD 2." + (i % 4) + "0");
      r.set("L", "ADD 1." + ((i + 2) % 4) + "5");
      r.set("Lens", i % 3 === 0 ? "Single Vision" : "");
      r.set("M", i % 2 === 0 ? "2.00" : "");
      r.set("W", i % 2 === 1 ? "1.75" : "");
      r.set("place", "รพ.สต.ตัวอย่าง");
      r.set("examdate", i === 5 ? "41352" : "19/3/2556");
      r.set("screencode", screenings[i % screenings.length]);
      r.set("shorthand", i % 4 === 0 ? "650/650" : "");
      r.set("longhand", i % 7 === 0 ? "1.25/1.25" : "");
      r.set("add", i % 5 === 0 ? "2.00/2.00" : "");
      r.set("cyl", i % 6 === 0 ? "0.50/0.50" : "");
      r.set("axt", i % 6 === 0 ? "180/180" : "");
      records.push(r);
    }
    return records;
  }

  function loadDemo() {
    state.book = null;
    state.demo = true;
    loadRecords(buildDemoRecords(), {
      headers: [],
      sheetName: "ตัวอย่าง",
      sheetNames: [],
      fileName: "ข้อมูลตัวอย่าง (สมมติ)",
      demo: true
    });
    toast("โหลดข้อมูลตัวอย่างแล้ว — ข้อมูลสมมติสำหรับลองใช้", "ok");
  }

  // ---------------------------------------------------------------
  // สรุป / นำทาง
  function updateSummary() {
    var count = state.filtered.length;
    var pages = state.template ? R.pageCount(state.template, count) : 0;

    $("sumLabels").textContent = fmtInt(count);
    $("sumPages").textContent = pages;
    $("sumMode").textContent = state.template ? state.template.Name : "—";
    $("printAllLabel").textContent = pages ? "พิมพ์ทั้งหมด " + pages + " หน้า" : "พิมพ์ทั้งหมด";

    var disabled = count === 0;
    $("btnTrial").disabled = disabled;
    $("btnPrintAll").disabled = disabled;
    $("btnPdf").disabled = disabled;
    $("btnPng").disabled = disabled;

    setDot("checkData", count > 0);
    setDot("checkTpl", !!state.template);
    setDot("checkTrial", state.trialDone);
    $("checkTrialText").textContent = state.trialDone
      ? "ทดลองพิมพ์หน้าแรกแล้ว — พร้อมพิมพ์ทั้งงาน"
      : "ยังไม่ได้ทดลองพิมพ์หน้าแรก";
    $("trialHint").textContent = state.trialDone
      ? "ดีแล้ว — ถ้าป้ายตรงกระดาษ กด “พิมพ์ทั้งหมด” ได้เลย"
      : "💡 แนะนำให้กดทดลองพิมพ์ก่อน 1 แผ่น เพื่อกันป้ายเปลืองทั้งงาน";
    $("trialHint").style.color = state.trialDone ? "var(--ok)" : "";
  }

  function setDot(id, ok) {
    var el = $(id);
    if (!el) return;
    el.classList.toggle("ok", !!ok);
    el.textContent = ok ? "✓" : "";
  }

  function updateFooterNav() {
    var hasData = state.records.length > 0;
    var hasSel = state.filtered.length > 0;
    var pages = state.template ? R.pageCount(state.template, state.filtered.length) : 0;

    var note = "";
    if (state.step === 1) {
      note = hasData
        ? "ไฟล์: " + state.fileName + " · " + fmtInt(state.records.length) + " คน · เลือก " + fmtInt(state.filtered.length) + " รายการ"
        : "ยังไม่มีไฟล์ — ลากไฟล์ Excel มาวาง หรือกด “เลือกไฟล์…”";
    } else if (state.step === 2) {
      var g = state.template ? R.geometry(state.template) : null;
      note = g ? g.perPage + " ป้ายต่อแผ่น · รวม " + pages + " แผ่น · " + state.template.Name : "";
    } else {
      note = state.trialDone ? "ทดลองพิมพ์แล้ว — พร้อมพิมพ์ทั้งงาน" : "ยังไม่ได้ทดลองพิมพ์ — แนะนำให้ทดลองก่อน";
    }
    $("footNote").textContent = note;

    $("btnBack").disabled = state.step === 1;
    $("btnNext").disabled = state.step === 3 || !hasSel;
    $("btnNext").textContent = state.step === 2 ? "ไปขั้นพิมพ์ →" : "ถัดไป →";

    var steps = document.querySelectorAll(".st");
    for (var i = 0; i < steps.length; i++) {
      var n = parseInt(steps[i].getAttribute("data-go"), 10);
      steps[i].disabled = n > 1 && !hasData;
      steps[i].classList.toggle("is-on", n === state.step);
      steps[i].classList.toggle("is-done", n < state.step && hasData);
    }
  }

  function goStep(n) {
    if (n < 1 || n > 3) return;
    if (n > 1 && !state.records.length) {
      toast("เลือกไฟล์ข้อมูลก่อนเพื่อไปขั้นต่อไป", "error");
      return;
    }
    if (n > 1 && !state.filtered.length) {
      toast("ไม่มีรายชื่อที่เลือกไว้ — ลองล้างตัวกรอง", "error");
      return;
    }

    state.step = n;
    for (var i = 1; i <= 3; i++) $("step" + i).classList.toggle("hidden", i !== n);
    updateFooterNav();
    updateSummary();
    if (n === 2) renderPreview();
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------
  // โลโก้
  function updateLogoUi() {
    var images = (state.template && state.template.Images) || [];
    var has = images.some(function (i) { return String(i.Source || "").toLowerCase() === "builtin:cross"; });
    $("logoBar").classList.toggle("hidden", !has);
    if (!has) return;

    $("logoThumb").src = state.logoSrc || "assets/logo-cross.png";
    $("logoState").textContent = state.logoSrc ? "ใช้รูปที่อัปโหลดไว้" : "รูปเริ่มต้นของโปรแกรม";
    $("btnLogoReset").disabled = !state.logoSrc;
  }

  function loadFileAsImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("อ่านรูปไม่สำเร็จ")); };
      img.src = url;
    });
  }

  async function handleLogoFile(file) {
    if (!file || state.busy) return;
    showBusy("กำลังเตรียมโลโก้…", file.name);
    try {
      var img = await loadFileAsImage(file);
      var max = 800;
      var scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      var canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      var dataUrl = canvas.toDataURL("image/png");

      state.logoSrc = dataUrl;
      state.logoImage = await R.loadImage(dataUrl);
      try {
        localStorage.setItem(STORAGE_LOGO, dataUrl);
      } catch (e) {
        toast("รูปใหญ่เกินที่เบราว์เซอร์จะจำไว้ — จะใช้เฉพาะครั้งนี้", "error");
      }
      updateLogoUi();
      if (state.step === 2) renderPreview();
      toast("เปลี่ยนโลโก้แล้ว", "ok");
    } catch (e) {
      toast("เปลี่ยนโลโก้ไม่สำเร็จ: " + (e.message || e), "error");
    } finally {
      hideBusy();
    }
  }

  function resetLogo() {
    try { localStorage.removeItem(STORAGE_LOGO); } catch (e) { /* ignore */ }
    state.logoSrc = null;
    state.logoImage = null;
    updateLogoUi();
    if (state.step === 2) renderPreview();
    toast("คืนโลโก้เริ่มต้นแล้ว", "ok");
  }

  // ---------------------------------------------------------------
  // การขยับตำแหน่ง
  function updateNudgeLabel() {
    var x = state.offsets.x, y = state.offsets.y;
    $("nudgeValue").textContent = (x === 0 && y === 0)
      ? "ตำแหน่งปกติ"
      : "ขยับแล้ว ซ้าย-ขวา " + (x > 0 ? "+" : "") + x.toFixed(1) +
        " บน-ล่าง " + (y > 0 ? "+" : "") + y.toFixed(1) + " มม.";
  }

  function nudge(dx, dy) {
    state.offsets.x = clamp(round1(state.offsets.x + dx), -10, 10);
    state.offsets.y = clamp(round1(state.offsets.y + dy), -10, 10);
    refreshBaseTemplate();
  }

  // ---------------------------------------------------------------
  // พิมพ์ / ส่งออก
  function renderOptionsForExport() {
    return {
      logoImage: state.logoImage,
      defaultLogoUrl: "assets/logo-cross.png"
    };
  }

  function waitForImages(root) {
    var imgs = Array.prototype.slice.call(root.querySelectorAll("img"));
    return Promise.all(imgs.map(function (img) {
      if (img.complete && img.naturalWidth) return Promise.resolve();
      if (img.decode) return img.decode().catch(function () { /* ignore */ });
      return new Promise(function (resolve) {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }));
  }

  function nextFrame() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () { setTimeout(resolve, 0); });
    });
  }

  async function doPrint(trial) {
    if (state.busy) return;
    var total = R.pageCount(state.template, state.filtered.length);
    if (!total) { toast("ไม่มีข้อมูลให้พิมพ์", "error"); return; }

    var count = trial ? 1 : total;
    var g = R.geometry(state.template);
    var root = $("printRoot");
    root.innerHTML = "";

    showBusy(trial ? "กำลังเตรียมพิมพ์ทดลอง…" : "กำลังเตรียมพิมพ์…", "0 / " + count);
    try {
      for (var i = 0; i < count; i++) {
        updateBusy("หน้า " + (i + 1) + " / " + count);
        var canvas = await R.renderPage(state.template, state.filtered, i, PRINT_DPI, renderOptionsForExport());
        var page = document.createElement("div");
        page.className = "print-page";
        page.style.width = g.W + "mm";
        page.style.height = g.H + "mm";

        var img = document.createElement("img");
        img.alt = "";
        img.src = canvas.toDataURL("image/jpeg", 0.95);
        page.appendChild(img);
        root.appendChild(page);
        await nextFrame();
      }

      $("printPageStyle").textContent = "@page { size: " + g.W + "mm " + g.H + "mm; margin: 0; }";
      await waitForImages(root);

      if (trial) {
        state.trialDone = true;
        updateSummary();
        updateFooterNav();
      }

      hideBusy();
      await nextFrame();
      window.print();
    } catch (e) {
      hideBusy();
      root.innerHTML = "";
      console.error(e);
      toast("เตรียมพิมพ์ไม่สำเร็จ: " + (e.message || e), "error");
    }
  }

  function fileStamp() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
  }

  async function exportPdf() {
    if (state.busy) return;
    var total = R.pageCount(state.template, state.filtered.length);
    if (!total) { toast("ไม่มีข้อมูลให้บันทึก", "error"); return; }

    var g = R.geometry(state.template);
    showBusy("กำลังสร้าง PDF…", "0 / " + total);
    try {
      var pages = [];
      for (var i = 0; i < total; i++) {
        updateBusy("หน้า " + (i + 1) + " / " + total);
        var canvas = await R.renderPage(state.template, state.filtered, i, PDF_DPI, renderOptionsForExport());
        var jpeg = await window.Pdf.canvasToJpegBytes(canvas, 0.92);
        pages.push({
          jpeg: jpeg,
          widthPx: canvas.width,
          heightPx: canvas.height,
          wMm: g.W,
          hMm: g.H
        });
        await nextFrame();
      }
      updateBusy("กำลังประกอบไฟล์…");
      var blob = window.Pdf.build(pages);
      window.Pdf.downloadBlob(blob, "stickers-" + fileStamp() + ".pdf");
      toast("บันทึก PDF แล้ว (" + total + " หน้า)", "ok");
    } catch (e) {
      console.error(e);
      toast("สร้าง PDF ไม่สำเร็จ: " + (e.message || e), "error");
    } finally {
      hideBusy();
    }
  }

  // ---------------------------------------------------------------
  // เติม metadata ความละเอียด (pHYs) ลง PNG เพื่อให้โปรแกรมพิมพ์
  // มองภาพเป็น 300 dpi ไม่ใช่ 72 dpi
  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function pngChunk(type, data) {
    var out = new Uint8Array(12 + data.length);
    var len = data.length;
    out[0] = (len >>> 24) & 255;
    out[1] = (len >>> 16) & 255;
    out[2] = (len >>> 8) & 255;
    out[3] = len & 255;
    for (var i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    var crc = crc32(out.subarray(4, 8 + data.length));
    var p = 8 + data.length;
    out[p] = (crc >>> 24) & 255;
    out[p + 1] = (crc >>> 16) & 255;
    out[p + 2] = (crc >>> 8) & 255;
    out[p + 3] = crc & 255;
    return out;
  }

  async function withPngDpi(blob, dpi) {
    var buf = await blob.arrayBuffer();
    var src = new Uint8Array(buf);
    // PNG signature + IHDR chunk ต้องอยู่ต้นไฟล์เสมอ (IHDR ยาว 13 ไบต์)
    var isPng = src.length > 33 && src[0] === 137 && src[1] === 80 &&
      src[2] === 78 && src[3] === 71 && src[12] === 73 && src[13] === 72 &&
      src[14] === 68 && src[15] === 82;
    if (!isPng) return blob;

    var ppm = Math.round(dpi / 0.0254); // พิกเซลต่อเมตร
    var data = new Uint8Array(9);
    data[0] = (ppm >>> 24) & 255;
    data[1] = (ppm >>> 16) & 255;
    data[2] = (ppm >>> 8) & 255;
    data[3] = ppm & 255;
    data[4] = data[0]; data[5] = data[1]; data[6] = data[2]; data[7] = data[3];
    data[8] = 1; // หน่วย = เมตร

    var chunk = pngChunk("pHYs", data);
    var ihdrEnd = 33; // 8 (signature) + 4 (length) + 4 (type) + 13 (data) + 4 (crc)
    var out = new Uint8Array(src.length + chunk.length);
    out.set(src.subarray(0, ihdrEnd), 0);
    out.set(chunk, ihdrEnd);
    out.set(src.subarray(ihdrEnd), ihdrEnd + chunk.length);
    return new Blob([out], { type: "image/png" });
  }

  async function exportPng() {
    if (state.busy) return;
    var total = R.pageCount(state.template, state.filtered.length);
    if (!total) { toast("ไม่มีข้อมูลให้บันทึก", "error"); return; }
    state.page = clamp(state.page, 0, total - 1);

    showBusy("กำลังสร้างภาพ PNG…", "หน้า " + (state.page + 1));
    try {
      var canvas = await R.renderPage(state.template, state.filtered, state.page, PNG_DPI, renderOptionsForExport());
      var blob = await R.canvasToBlob(canvas, "image/png");
      blob = await withPngDpi(blob, PNG_DPI);
      window.Pdf.downloadBlob(blob, "sticker-page-" + String(state.page + 1).padStart(2, "0") + ".png");
      toast("บันทึกภาพ PNG แล้ว", "ok");
    } catch (e) {
      console.error(e);
      toast("สร้างภาพไม่สำเร็จ: " + (e.message || e), "error");
    } finally {
      hideBusy();
    }
  }

  // ---------------------------------------------------------------
  // toast / busy
  function toast(message, type) {
    var el = $("toast");
    el.textContent = message;
    el.className = "toast show" + (type ? " " + type : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = "toast"; }, 4500);
  }

  function showBusy(title, text) {
    state.busy = true;
    $("busyTitle").textContent = title || "กำลังทำงาน…";
    $("busyText").textContent = text || "";
    $("busy").classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function updateBusy(text) { $("busyText").textContent = text || ""; }

  function hideBusy() {
    state.busy = false;
    $("busy").classList.add("hidden");
    document.body.style.overflow = "";
  }

  // ---------------------------------------------------------------
  // สร้างการ์ดแม่แบบ
  function renderTemplateCards() {
    var host = $("templateList");
    var html = "";

    TEMPLATES.forEach(function (t) {
      var per = Math.max(1, t.Columns * t.Rows);
      var complex = isComplex(t);
      var icon = t.Id === "film-a4-2x5" ? "🎞" :
        (t.Id === "va-a4-2x5" ? "👁" : (t.Columns === 1 ? "📏" : "🏷"));
      var desc = t.Columns + "×" + t.Rows + " = " + per + " ป้าย/แผ่น · " +
        (t.Landscape ? "แนวนอน" : "แนวตั้ง") + (complex ? " · มีโลโก้/เส้นตัด" : "");
      html += '<button class="tpl-card" type="button" data-tpl="' + esc(t.Id) + '" aria-pressed="false">' +
        '<span class="tpl-icon">' + icon + "</span>" +
        '<span class="tpl-body"><b>' + esc(t.Name) + "</b><span>" + esc(desc) + "</span></span>" +
        '<span class="tpl-badge">' + (complex ? "สำเร็จรูป" : "ปรับข้อความได้") + "</span>" +
        "</button>";
    });

    html += '<button class="tpl-card" type="button" data-tpl="custom" aria-pressed="false">' +
      '<span class="tpl-icon">⚙</span>' +
      '<span class="tpl-body"><b>ตั้งค่ากระดาษเอง</b><span>กำหนดขนาด จำนวนช่อง ฟอนต์ และข้อความเอง</span></span>' +
      '<span class="tpl-badge">อิสระ</span>' +
      "</button>";

    host.innerHTML = html;
    host.addEventListener("click", function (e) {
      var card = e.target.closest(".tpl-card");
      if (card) selectTemplate(card.getAttribute("data-tpl"));
    });
  }

  // ---------------------------------------------------------------
  // ผูกเหตุการณ์
  function bindEvents() {
    $("btnPick").addEventListener("click", function (e) {
      e.stopPropagation();
      $("fileInput").click();
    });
    $("btnChangeFile").addEventListener("click", function () { $("fileInput").click(); });
    $("fileInput").addEventListener("change", function () {
      var f = this.files && this.files[0];
      if (f) loadFile(f);
      this.value = "";
    });

    var dz = $("dropZone");
    dz.addEventListener("click", function (e) {
      if (e.target === dz || !e.target.closest("button")) $("fileInput").click();
    });
    dz.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("fileInput").click(); }
    });
    ["dragenter", "dragover"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("is-hot"); });
    });
    ["dragleave", "dragend"].forEach(function (ev) {
      dz.addEventListener(ev, function () { dz.classList.remove("is-hot"); });
    });
    dz.addEventListener("drop", function (e) {
      e.preventDefault();
      dz.classList.remove("is-hot");
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) loadFile(f);
    });

    $("btnDemo").addEventListener("click", loadDemo);
    $("sheetSelect").addEventListener("change", changeSheet);

    $("searchInput").addEventListener("input", function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { applyFilter(true); }, 150);
    });
    $("tambonSelect").addEventListener("change", function () { applyFilter(true); });
    $("btnClearFilter").addEventListener("click", function () {
      $("searchInput").value = "";
      $("tambonSelect").value = "";
      applyFilter(true);
    });

    document.querySelectorAll(".st").forEach(function (b) {
      b.addEventListener("click", function () { goStep(parseInt(b.getAttribute("data-go"), 10)); });
    });
    $("btnBack").addEventListener("click", function () { goStep(state.step - 1); });
    $("btnNext").addEventListener("click", function () { goStep(state.step + 1); });

    document.querySelectorAll("#tokenGrid input[data-token]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        state.tokens[cb.getAttribute("data-token")] = cb.checked;
        state.lines = null;
        var label = cb.closest("label");
        if (label) label.classList.toggle("is-on", cb.checked);
        if (isComplexMode()) return;
        refreshBaseTemplate();
      });
    });

    $("customSettings").addEventListener("input", function () {
      clearTimeout(settingsTimer);
      settingsTimer = setTimeout(function () {
        if (isComplexMode()) return;
        readCustomFromUi();
        refreshBaseTemplate();
      }, 120);
    });
    $("customSettings").addEventListener("change", function () {
      clearTimeout(settingsTimer);
      settingsTimer = setTimeout(function () {
        if (isComplexMode()) return;
        readCustomFromUi();
        refreshBaseTemplate();
      }, 60);
    });

    $("btnLogoPick").addEventListener("click", function () { $("logoInput").click(); });
    $("logoInput").addEventListener("change", function () {
      var f = this.files && this.files[0];
      if (f) handleLogoFile(f);
      this.value = "";
    });
    $("btnLogoReset").addEventListener("click", resetLogo);

    $("btnPrevPage").addEventListener("click", function () {
      if (state.page > 0) { state.page--; renderPreview(); }
    });
    $("btnNextPage").addEventListener("click", function () {
      var total = R.pageCount(state.template, state.filtered.length);
      if (state.page < total - 1) { state.page++; renderPreview(); }
    });

    $("btnTrial").addEventListener("click", function () { doPrint(true); });
    $("btnPrintAll").addEventListener("click", function () { doPrint(false); });
    $("btnPdf").addEventListener("click", exportPdf);
    $("btnPng").addEventListener("click", exportPng);

    document.querySelectorAll(".nudge-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        nudge(parseFloat(b.getAttribute("data-dx")) || 0, parseFloat(b.getAttribute("data-dy")) || 0);
      });
    });
    $("btnNudgeReset").addEventListener("click", function () {
      state.offsets.x = 0;
      state.offsets.y = 0;
      refreshBaseTemplate();
    });

    $("btnHelp").addEventListener("click", function () { $("helpDialog").showModal(); });
    $("btnCloseHelp").addEventListener("click", function () { $("helpDialog").close(); });
    $("helpDialog").addEventListener("click", function (e) {
      if (e.target === $("helpDialog")) $("helpDialog").close();
    });

    $("btnLogout").addEventListener("click", function () {
      if (window.confirm("ต้องการออกจากระบบหรือไม่?")) {
        window.Auth.logout();
        location.href = "login.html";
      }
    });

    window.addEventListener("afterprint", function () { $("printRoot").innerHTML = ""; });

    setInterval(function () {
      if (!window.Auth.isAuthed()) location.replace("login.html");
    }, 60000);
  }

  // ---------------------------------------------------------------
  function init() {
    loadSettings();
    renderTemplateCards();
    uiFromCustom();
    bindEvents();

    var preset = currentPreset();
    state.baseTemplate = preset && isComplex(preset) ? clone(preset) : buildSimpleTemplate();
    state.template = R.applyOffsets(state.baseTemplate, state.offsets.x, state.offsets.y);

    updateSpec();
    updateTemplateControls();
    updateTemplateCards();
    updateSummary();
    updateFooterNav();
    updateFileUi();
    updateNudgeLabel();
    renderTable();
    goStep(1);

    // โลโก้
    R.loadImage("assets/logo-cross.png").then(function (img) {
      state.defaultLogoImage = img;
      if (state.step === 2) renderPreview();
    });

    try {
      var savedLogo = localStorage.getItem(STORAGE_LOGO);
      if (savedLogo) {
        state.logoSrc = savedLogo;
        R.loadImage(savedLogo).then(function (img) {
          state.logoImage = img;
          updateLogoUi();
          if (state.step === 2) renderPreview();
        });
      }
    } catch (e) { /* ignore */ }

    updateLogoUi();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
