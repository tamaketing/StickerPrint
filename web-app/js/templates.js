// แม่แบบป้ายที่มากับโปรแกรม (แปลงจาก StickerPrint/templates/*.json)
// แก้ไฟล์นี้ได้โดยตรง — รีเฟรชหน้าเว็บเพื่อดูผล
(function () {
  "use strict";

  // ตัวช่วยสร้าง element ให้อ่าน/แก้ง่าย
  function el(x, y, w, h, text, size, bold, color, align, valign) {
    return {
      Xmm: x, Ymm: y, Wmm: w, Hmm: h,
      Text: text,
      FontName: "Tahoma",
      FontSizePt: size,
      Bold: !!bold,
      Italic: false,
      Align: align || "Left",
      VAlign: valign || "Middle",
      ForeColor: color || "#000000",
      LineSpacingMm: 0,
      AutoShrink: true
    };
  }

  function line(x1, y1, x2, y2) {
    return {
      X1mm: x1, Y1mm: y1, X2mm: x2, Y2mm: y2,
      WidthMm: 0.2,
      Color: "#000000"
    };
  }

  // เส้นตัดของแม่แบบ 2×5: เส้นกลาง + เส้นขอบขวา + เส้นล่างของแต่ละแถว
  // เว้นระยะหัว/ท้ายแถวเล็กน้อยเหมือนไฟล์แม่แบบเดิม (film-a4-2x5.json)
  function filmPageLines() {
    var lines = [];
    var top = 3.2;
    var rowH = 38.9;
    for (var r = 0; r < 5; r++) {
      var y1 = top + r * rowH;
      var y2 = y1 + rowH;
      lines.push(line(146, y1 + 3.9, 146, y2 - 5.9));
      lines.push(line(288.2, y1 + 3.9, 288.2, y2 - 5.9));
      lines.push(line(14.1, y2, 142.2, y2));
      lines.push(line(156.5, y2, 284.6, y2));
    }
    return lines;
  }

  // ------------------------------------------------------------------
  // 1) ติดซองฟิล์ม / สติ๊กเกอร์วัดสายตา A4 2×5 (แนวนอน)
  //    หน้าตาตามตัวอย่าง: ชื่อ-สกุล, ที่อยู่, ค่าสายตา, สถานที่/วันที่
  var film = {
    Id: "film-a4-2x5",
    Name: "Sticker A4 2×5",
    PageWidthMm: 210,
    PageHeightMm: 297,
    Landscape: true,
    MarginLeftMm: 3.8,
    MarginRightMm: 8.8,
    MarginTopMm: 3.2,
    MarginBottomMm: 12.3,
    Columns: 2,
    Rows: 5,
    GutterXMm: 0,
    GapYMm: 0,
    ShowBorders: false,
    SkipBlankSlots: true,
    RestartNumberingPerSheet: false,
    Elements: [
      // ชื่อ-สกุล ("ชื่อ" ตามไฟล์แม่แบบต้นฉบับ)
      el(6.7, 1.2, 7.5, 6.8, "ชื่อ", 14, false),
      el(16.5, 1.2, 17.6, 6.8, "{{title}}", 14, true),
      el(35.1, 1.2, 76, 6.8, "{{firstname}}   {{lastname}}", 16, true),

      // ที่อยู่ + อายุ
      el(8, 8.3, 20.5, 5.6, "บ้านเลขที่:", 12),
      el(28.5, 8.3, 15, 5.6, " {{house}}", 13, true),
      el(45, 8.3, 8.5, 5.6, "หมู่:", 12),
      el(53.5, 8.3, 8, 5.6, " {{moo}}", 13, true),
      el(62, 8.3, 11, 5.6, "ตำบล:", 12),
      el(73.5, 8.3, 25.5, 5.6, " {{area}}", 13, true),
      el(99, 8.3, 8, 5.6, "อายุ:", 11.5),
      el(107, 8.3, 13, 5.6, "{{age}}", 12, true, "#000000", "Right"),

      // ค่าเลนส์: - สั้นR/L และ + ยาวR/L (บรรทัดเดียวกัน)
      el(8, 14.6, 15, 5.7, "- สั้นR/L", 11.5),
      el(23.5, 14.6, 20, 5.7, " {{shorthand_dash}}", 12.5, true),
      el(46, 14.6, 15, 5.7, "+ ยาวR/L", 11.5),
      el(62, 14.6, 22, 5.7, " {{longhand_dash}}", 12.5, true),

      // อ่านหนังสือ + PD
      el(8, 20.5, 24, 5.7, "อ่านหนังสือ:", 11.5),
      el(33, 20.5, 18, 5.7, " {{readbook_dash}}", 12.5, true),
      el(54, 20.5, 9, 5.7, "PD:", 11.5),
      el(63, 20.5, 18, 5.7, " {{pd_dash}}", 12.5, true),

      // VA ขวา/ซ้าย
      el(8, 26.4, 17, 5.7, "VA/R:", 11.5),
      el(25.5, 26.4, 28, 5.7, " {{va_r_dash}}", 12.5, true),
      el(54, 26.4, 11, 5.7, "VA/L:", 11.5),
      el(66.8, 26.4, 18, 5.7, " {{va_l_dash}}", 12.5, true),

      // เลขที่
      el(114, 16.8, 20.5, 4.2, "เลขที่", 10, true, "#000000", "Right"),
      el(114, 21.2, 20.5, 9.8, "{{no3}}", 23.5, true, "#000000", "Right"),

      // สถานที่ + วันที่ตรวจ
      el(8, 33.0, 21, 5.9, "สถานที่ตรวจ:", 11.5),
      el(29, 33.0, 53, 5.9, " {{place}}", 11.5, true),
      el(83, 33.0, 16.5, 5.9, "วันที่ตรวจ:", 11.5),
      el(99.5, 33.0, 31.5, 5.9, " {{examdate_dmy}}", 11.5, true)
    ],
    Images: [
      { Xmm: 121.5, Ymm: 2.6, Wmm: 15.5, Hmm: 12.5, Source: "builtin:cross" }
    ],
    PageLines: filmPageLines(),
    FillOrder: "Column"
  };

  // ------------------------------------------------------------------
  // 2) ผลตรวจสายตา A4 2×5 — ใช้หัวคอลัมน์ชุดใหม่ (VA/PD/อ่านหนังสือ/คัดกรอง)
  var va = {
    Id: "va-a4-2x5",
    Name: "ผลตรวจสายตา A4 2×5",
    PageWidthMm: film.PageWidthMm,
    PageHeightMm: film.PageHeightMm,
    Landscape: film.Landscape,
    MarginLeftMm: film.MarginLeftMm,
    MarginRightMm: film.MarginRightMm,
    MarginTopMm: film.MarginTopMm,
    MarginBottomMm: film.MarginBottomMm,
    Columns: film.Columns,
    Rows: film.Rows,
    GutterXMm: film.GutterXMm,
    GapYMm: film.GapYMm,
    ShowBorders: film.ShowBorders,
    SkipBlankSlots: film.SkipBlankSlots,
    RestartNumberingPerSheet: film.RestartNumberingPerSheet,
    Elements: [
      // ชื่อ-สกุล
      el(16.5, 1.6, 17, 9, "{{title}}", 14.5, true),
      el(35.1, 1.6, 76, 9, "{{firstname}}   {{lastname}}", 16, true),

      // ที่อยู่ + อายุ (ใช้ {{area_label}} ให้เป็นตำบลหรือชุมชนตามข้อมูล)
      el(8, 10.0, 20.5, 8.0, "บ้านเลขที่:", 12),
      el(28.5, 10.0, 18, 8.0, " {{house}}", 13, true),
      el(49, 10.0, 16, 8.0, "{{area_label}}:", 12),
      el(66, 10.0, 30, 8.0, " {{area}}", 13, true),
      el(99, 10.0, 8, 8.0, "อายุ:", 11.5),
      el(107, 10.0, 13, 8.0, "{{age}}", 12, true, "#000000", "Right"),

      // ค่าสายตา + PD
      el(8, 18.3, 13, 7, "VA/R:", 12),
      el(21, 18.3, 23, 7, " {{va_r_dash}}", 14, true),
      el(47, 18.3, 13, 7, "VA/L:", 12),
      el(60, 18.3, 23, 7, " {{va_l_dash}}", 14, true),
      el(86, 18.3, 9, 7, "PD:", 12),
      el(95, 18.3, 12.5, 7, " {{pd_dash}}", 12, true),

      // อ่านหนังสือ + คัดกรอง
      el(8, 25.6, 22, 7, "อ่านหนังสือ:", 11.5),
      el(30, 25.6, 22, 7, " {{readbook_dash}}", 12, true),
      el(55, 25.6, 17, 7, "คัดกรอง:", 11.5),
      el(72, 25.6, 35.5, 7, " {{screening_short_dash}}", 10.5, true),

      // เลขที่
      el(114, 16.8, 20.5, 4.2, "เลขที่", 10, true, "#000000", "Right"),
      el(114, 21.2, 20.5, 9.8, "{{no3}}", 23.5, true, "#000000", "Right"),

      // สถานที่ + วันที่ตรวจ
      el(8, 34.0, 21, 6.0, "สถานที่ตรวจ:", 11.5),
      el(29, 34.0, 53, 6.0, " {{place}}", 11.5, true),
      el(83, 34.0, 16.5, 6.0, "วันที่ตรวจ:", 11.5),
      el(99.5, 34.0, 31.5, 6.0, " {{examdate_dmy}}", 11.5, true)
    ],
    Images: film.Images,
    PageLines: filmPageLines(),
    FillOrder: film.FillOrder
  };

  // ------------------------------------------------------------------
  // 3) มาตรฐาน A4 3×8
  var standard = {
    Id: "มาตรฐาน A4 3x8",
    Name: "มาตรฐาน A4 3x8",
    PageWidthMm: 210,
    PageHeightMm: 297,
    Landscape: false,
    MarginLeftMm: 10,
    MarginRightMm: 10,
    MarginTopMm: 10,
    MarginBottomMm: 10,
    Columns: 3,
    Rows: 8,
    GutterXMm: 3,
    GapYMm: 3,
    ShowBorders: true,
    SkipBlankSlots: false,
    RestartNumberingPerSheet: false,
    Elements: [
      el(2, 1.2, 57.3, 9.5, "{{no.}}. {{fullname}}", 10, true, "#000000", "Left", "Top"),
      el(2, 11, 57.3, 9.5, "{{address}}", 9, false, "#000000", "Left", "Top"),
      el(2, 21, 57.3, 9, "เลขบัตรฯ {{idno}}   {{birthyear_be}}   {{lens}}", 8, false, "#404040", "Left", "Top")
    ],
    Images: [],
    PageLines: [],
    FillOrder: "Row"
  };

  // ------------------------------------------------------------------
  // 4) แถวเดียว A4 1×12
  var single = {
    Id: "แถวเดียว A4 1x12",
    Name: "แถวเดียว A4 1x12",
    PageWidthMm: 210,
    PageHeightMm: 297,
    Landscape: false,
    MarginLeftMm: 10,
    MarginRightMm: 10,
    MarginTopMm: 10,
    MarginBottomMm: 10,
    Columns: 1,
    Rows: 12,
    GutterXMm: 0,
    GapYMm: 3,
    ShowBorders: true,
    SkipBlankSlots: false,
    RestartNumberingPerSheet: false,
    Elements: [
      el(2, 1.5, 188, 6.5, "{{no.}}. {{fullname}}        เลขบัตรฯ {{idno}}        {{birthyear_be}}", 10, true, "#000000", "Left", "Top"),
      el(2, 8.5, 188, 6, "{{address}}", 9, false, "#000000", "Left", "Top"),
      el(2, 15, 188, 6, "{{screening}}   {{place}}   {{examdate}}   {{lens}}", 8, false, "#404040", "Left", "Top")
    ],
    Images: [],
    PageLines: [],
    FillOrder: "Row"
  };

  window.BUILTIN_TEMPLATES = [film, va, standard, single];
})();
