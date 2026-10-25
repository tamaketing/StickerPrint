/* ฟิลด์ข้อมูล + การแทนค่า {{token}} ในข้อความบนป้าย
 * แปลงมาจาก Models/StickerRecord.cs และ Data/SpreadsheetReader.cs ของโปรแกรมเดิม */
(function (global) {
  "use strict";

  var FieldKeys = {
    Item: "item",
    Title: "title",
    FirstName: "firstname",
    LastName: "lastname",
    IdNo: "idno",
    BirthYear: "birthyear",
    Age: "age",
    House: "house",
    Moo: "moo",
    Community: "community",
    Tambon: "tambon",
    Amphoe: "amphoe",
    Province: "province",
    ReadBook: "readbook",
    PD: "pd",
    VA_R: "va_r",
    VA_L: "va_l",
    ShortHand: "shorthand",
    LongHand: "longhand",
    Add: "add",
    Cyl: "cyl",
    Axt: "axt",
    EyeProblem: "eyeproblem",
    ScreenCode: "screencode",
    Place: "place",
    ExamDate: "examdate"
  };

  var THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                           "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  // จัดรูปแบบชื่อชุมชนให้อ่านง่าย เช่น "หมู่ที่3" -> "หมู่ที่ 3"
  function formatCommunity(value) {
    return trim(value).replace(/^หมู่ที่\s*(\d)/, "หมู่ที่ $1");
  }

  function isValidDate(y, m, d) {
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    var dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  function trim(v) { return (v == null ? "" : String(v)).trim(); }

  function StickerRecord() {
    this.fields = Object.create(null);
    this.lower = Object.create(null);
    this.sequence = 0;
    this.sourceRow = "";
  }

  StickerRecord.prototype.set = function (key, value) {
    if (key == null) return;
    key = String(key);
    value = value == null ? "" : String(value);
    this.fields[key] = value;
    this.lower[key.toLowerCase()] = value;
  };

  StickerRecord.prototype.get = function (key) {
    if (key == null) return "";
    var k = String(key);
    if (k in this.fields) return this.fields[k];
    var lk = k.toLowerCase();
    if (lk in this.lower) return this.lower[lk];
    return "";
  };

  StickerRecord.prototype.firstNonEmpty = function () {
    for (var i = 0; i < arguments.length; i++) {
      var v = trim(this.get(arguments[i]));
      if (v.length) return v;
    }
    return "";
  };

  Object.defineProperty(StickerRecord.prototype, "title", {
    get: function () { return this.get(FieldKeys.Title); }
  });
  Object.defineProperty(StickerRecord.prototype, "firstName", {
    get: function () { return this.get(FieldKeys.FirstName); }
  });
  Object.defineProperty(StickerRecord.prototype, "lastName", {
    get: function () { return this.get(FieldKeys.LastName); }
  });
  Object.defineProperty(StickerRecord.prototype, "fullName", {
    get: function () {
      return [this.title, this.firstName, this.lastName]
        .map(trim).filter(function (s) { return s.length > 0; }).join(" ");
    }
  });
  Object.defineProperty(StickerRecord.prototype, "idNo", {
    get: function () { return this.get(FieldKeys.IdNo); }
  });
  Object.defineProperty(StickerRecord.prototype, "idNoValid", {
    get: function () { return /^\d{13}$/.test(this.idNo); }
  });
  Object.defineProperty(StickerRecord.prototype, "birthYearBe", {
    get: function () {
      var raw = trim(this.get(FieldKeys.BirthYear));
      if (/^-?\d+$/.test(raw)) {
        var n = parseInt(raw, 10);
        if (raw.replace("-", "").length <= 2) return 2500 + n;
        return n;
      }
      // ไฟล์ที่มีแต่อายุ: ประมาณปีเกิดจากปีที่ตรวจ (หรือปีปัจจุบัน)
      var ageRaw = trim(this.get(FieldKeys.Age));
      if (/^\d+$/.test(ageRaw)) {
        var exam = this.parseExamDate();
        var beYear = (exam ? exam.getFullYear() + 543 : new Date().getFullYear() + 543) -
          parseInt(ageRaw, 10);
        if (beYear > 2400) return beYear;
      }
      return 0;
    }
  });
  Object.defineProperty(StickerRecord.prototype, "age", {
    get: function () {
      // ถ้าไฟล์มีคอลัมน์อายุอยู่แล้ว ใช้ค่านั้นก่อน (เช่น "อายุ(ปี)")
      var raw = trim(this.get(FieldKeys.Age));
      if (/^\d+$/.test(raw)) return parseInt(raw, 10);
      var be = this.birthYearBe;
      if (be <= 0) return 0;
      var years = (new Date().getFullYear() + 543) - be;
      return years > 0 ? years : 0;
    }
  });
  Object.defineProperty(StickerRecord.prototype, "addressLine", {
    get: function () {
      var parts = [];
      var house = trim(this.get(FieldKeys.House));
      if (house) parts.push(house);
      var moo = trim(this.get(FieldKeys.Moo));
      if (moo) parts.push("หมู่ " + moo);
      var community = formatCommunity(this.get(FieldKeys.Community));
      if (community) parts.push(community);
      var tambon = trim(this.get(FieldKeys.Tambon));
      if (tambon) parts.push("ต." + tambon);
      var amphoe = trim(this.get(FieldKeys.Amphoe));
      if (amphoe) parts.push("อ." + amphoe);
      var province = trim(this.get(FieldKeys.Province));
      if (province) parts.push("จ." + province);
      return parts.join(" ");
    }
  });
  Object.defineProperty(StickerRecord.prototype, "lensSummary", {
    get: function () {
      var parts = [];
      var sh = trim(this.get(FieldKeys.ShortHand));
      if (sh) parts.push(sh);
      var lh = trim(this.get(FieldKeys.LongHand));
      if (lh) parts.push("+" + lh);
      var add = trim(this.get(FieldKeys.Add));
      if (add) parts.push("ADD " + add);
      var cyl = trim(this.get(FieldKeys.Cyl));
      if (cyl) parts.push("CYL " + cyl);
      var axt = trim(this.get(FieldKeys.Axt));
      if (axt) parts.push("AXT " + axt);
      return parts.join("   ");
    }
  });
  Object.defineProperty(StickerRecord.prototype, "screeningSummary", {
    get: function () {
      var code = trim(this.get(FieldKeys.ScreenCode));
      var problem = trim(this.get(FieldKeys.EyeProblem));
      if (!code && !problem) return "";
      if (!problem) return "คัดกรอง " + code;
      if (!code) return problem;
      return "คัดกรอง " + code + " (" + problem + ")";
    }
  });
  Object.defineProperty(StickerRecord.prototype, "rightLens", {
    get: function () {
      return this.firstNonEmpty("R", "M-R", "right", "righteye", "ค่าสายตาขวา", "สายตาขวา", FieldKeys.VA_R);
    }
  });
  Object.defineProperty(StickerRecord.prototype, "leftLens", {
    get: function () {
      return this.firstNonEmpty("L", "M-L", "left", "lefteye", "ค่าสายตาซ้าย", "สายตาซ้าย", FieldKeys.VA_L);
    }
  });
  Object.defineProperty(StickerRecord.prototype, "lensType", {
    get: function () {
      return this.firstNonEmpty("Lens", "LensType", "lenstype", "ชนิดเลนส์");
    }
  });
  Object.defineProperty(StickerRecord.prototype, "community", {
    get: function () { return this.get(FieldKeys.Community); }
  });
  Object.defineProperty(StickerRecord.prototype, "readBook", {
    get: function () { return this.get(FieldKeys.ReadBook); }
  });
  Object.defineProperty(StickerRecord.prototype, "pd", {
    get: function () { return this.get(FieldKeys.PD); }
  });
  Object.defineProperty(StickerRecord.prototype, "vaRight", {
    get: function () { return this.firstNonEmpty(FieldKeys.VA_R, "R", "ค่าสายตาขวา", "สายตาขวา"); }
  });
  Object.defineProperty(StickerRecord.prototype, "vaLeft", {
    get: function () { return this.firstNonEmpty(FieldKeys.VA_L, "L", "ค่าสายตาซ้าย", "สายตาซ้าย"); }
  });
  Object.defineProperty(StickerRecord.prototype, "screeningShort", {
    get: function () {
      var raw = trim(this.firstNonEmpty(FieldKeys.ScreenCode, FieldKeys.EyeProblem));
      if (!raw) return "";
      return raw.split(/[,，]/).map(function (part) {
        var s = trim(part);
        s = s.replace(/^สงสัย\s*/, "").replace(/^คัดกรอง\s*/, "");
        s = s.replace(/\s*(แนะนำ|นัด|ส่งต่อ|ควร|ให้).*$/, "");
        return trim(s);
      }).filter(function (s) { return s.length > 0; }).join(", ");
    }
  });

  StickerRecord.prototype.parseExamDate = function () {
    var raw = trim(this.get(FieldKeys.ExamDate));
    if (!raw) return null;

    var m;
    // 26-9-55 = พ.ศ. 2 หลัก: ปล่อยให้ token _short/_dmy จัดการเอง
    if ((m = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/))) return null;

    // 19/3/2556 หรือ 19/3/2013
    if ((m = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/))) {
      var d1 = parseInt(m[1], 10), m1 = parseInt(m[2], 10), y1 = parseInt(m[3], 10);
      if (y1 >= 2400) y1 -= 543;
      if (isValidDate(y1, m1, d1)) return new Date(y1, m1 - 1, d1);
    }

    // 2013-03-19 หรือ 2556-03-19
    if ((m = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/))) {
      var y2 = parseInt(m[1], 10), m2 = parseInt(m[2], 10), d2 = parseInt(m[3], 10);
      if (y2 >= 2400) y2 -= 543;
      if (isValidDate(y2, m2, d2)) return new Date(y2, m2 - 1, d2);
    }

    // เลขล้วน 5 หลัก = Excel serial (ต้องเช็กก่อน new Date เพราะ "41352" จะถูกอ่านเป็นปี ค.ศ. 41352)
    if (/^\d+(\.\d+)?$/.test(raw)) {
      var serial = parseFloat(raw);
      if (serial > 20000 && serial < 100000) {
        // จุดเริ่มต้นของ Excel serial คือ 1899-12-30 (ใช้เวลาท้องถิ่นเหมือนโปรแกรมเดิม)
        return new Date(1899, 11, 30 + Math.round(serial));
      }
    }

    var parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) return parsed;
    return null;
  };

  function formatThaiDate(d) {
    return d.getDate() + " " + THAI_MONTHS_SHORT[d.getMonth()] + " " + (d.getFullYear() + 543);
  }

  Object.defineProperty(StickerRecord.prototype, "examDateText", {
    get: function () {
      var d = this.parseExamDate();
      return d ? formatThaiDate(d) : trim(this.get(FieldKeys.ExamDate));
    }
  });
  Object.defineProperty(StickerRecord.prototype, "examDateShortText", {
    get: function () {
      var raw = trim(this.get(FieldKeys.ExamDate));
      if (!raw) return "";
      var d = this.parseExamDate();
      if (!d) return raw;
      return d.getDate() + "-" + (d.getMonth() + 1) + "-" + pad2((d.getFullYear() + 543) % 100);
    }
  });
  Object.defineProperty(StickerRecord.prototype, "examDateDmyText", {
    get: function () {
      var raw = trim(this.get(FieldKeys.ExamDate));
      if (!raw) return "";
      var d = this.parseExamDate();
      if (d) return d.getDate() + "/" + (d.getMonth() + 1) + "/" + (d.getFullYear() + 543);
      var m = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/);
      if (m) return parseInt(m[1], 10) + "/" + parseInt(m[2], 10) + "/" + (2500 + parseInt(m[3], 10));
      return raw;
    }
  });

  /** แทนค่า {{token}} ทั้งหมด — ใช้ sequence ที่ส่งเข้ามา (ปกติคือ rec.sequence) */
  StickerRecord.prototype.expand = function (template, sequence) {
    if (!template) return "";
    var self = this;
    var seq = (sequence == null ? this.sequence : sequence);

    // ค่าที่ว่างให้แสดงขีดตามแบบฟอร์มเดิม เช่น "--/--" หรือ "--"
    function dashSlash(v) { return trim(v) || "--/--"; }
    function dash(v) { return trim(v) || "--"; }

    var tambon = trim(this.get(FieldKeys.Tambon));
    var community = formatCommunity(this.get(FieldKeys.Community));
    var communityShort = community.replace(/^ชุมชน\s*/, "");
    var area = tambon || communityShort;
    var areaLabel = tambon ? "ตำบล" : (community ? "ชุมชน" : "ตำบล");
    var vaR = this.vaRight;
    var vaL = this.vaLeft;

    var canonical = {
      "no.": String(seq),
      "no3": String(seq).padStart(3, "0"),
      "item": this.get(FieldKeys.Item),
      "title": this.title,
      "firstname": this.firstName,
      "lastname": this.lastName,
      "fullname": this.fullName,
      "idno": this.idNo,
      "birthyear": this.get(FieldKeys.BirthYear),
      "birthyear_be": this.birthYearBe > 0 ? "พ.ศ. " + this.birthYearBe : "",
      "age": this.age > 0 ? String(this.age) : "",
      "house": this.get(FieldKeys.House),
      "moo": this.get(FieldKeys.Moo),
      "community": community,
      "community_short": communityShort,
      "tambon": tambon,
      "area": area,
      "area_label": areaLabel,
      "amphoe": this.get(FieldKeys.Amphoe),
      "province": this.get(FieldKeys.Province),
      "address": this.addressLine,
      "readbook": this.readBook,
      "reading": this.readBook,
      "readbook_dash": dash(this.readBook),
      "pd": this.pd,
      "pd_dash": dash(this.pd),
      "va_r": vaR,
      "va_l": vaL,
      "va_r_dash": dashSlash(vaR),
      "va_l_dash": dashSlash(vaL),
      "va": [vaR ? "R " + vaR : "", vaL ? "L " + vaL : ""]
        .filter(function (s) { return s.length > 0; }).join("   "),
      "shorthand": this.get(FieldKeys.ShortHand),
      "longhand": this.get(FieldKeys.LongHand),
      "add": this.get(FieldKeys.Add),
      "cyl": this.get(FieldKeys.Cyl),
      "axt": this.get(FieldKeys.Axt),
      "shorthand_dash": dashSlash(this.get(FieldKeys.ShortHand)),
      "longhand_dash": dashSlash(this.get(FieldKeys.LongHand)),
      "add_dash": dashSlash(this.get(FieldKeys.Add)),
      "cyl_dash": dashSlash(this.get(FieldKeys.Cyl)),
      "axt_dash": dashSlash(this.get(FieldKeys.Axt)),
      "eyeproblem": this.get(FieldKeys.EyeProblem),
      "screencode": this.get(FieldKeys.ScreenCode),
      "place": this.get(FieldKeys.Place),
      "examdate": this.examDateText,
      "examdate_short": this.examDateShortText,
      "examdate_dmy": this.examDateDmyText,
      "examdate_full": this.examDateDmyText,
      "r": this.rightLens,
      "l": this.leftLens,
      "lenstype": this.lensType,
      "lens": this.lensSummary,
      "screening": this.screeningSummary,
      "screening_short": this.screeningShort,
      "screening_short_dash": dash(this.screeningShort),
      "nameid": this.idNo ? (this.fullName + "  " + this.idNo) : this.fullName
    };

    return String(template).replace(/\{\{\s*([^{}]+?)\s*\}\}/g, function (_, rawKey) {
      var key = rawKey.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(canonical, key)) return canonical[key] == null ? "" : String(canonical[key]);
      return self.get(rawKey);
    });
  };

  // ------------------------------------------------------------------
  // ColumnMapper — เดา "ความหมาย" ของหัวคอลัมน์จากชื่อ
  var ColumnMapper = {
    extraKey: function (index) { return "col" + index; },

    normalize: function (header) {
      var h = trim(header).toLowerCase().replace(/\u00a0/g, " ").replace(/\ufeff/g, "");
      while (h.indexOf("  ") >= 0) h = h.replace(/  /g, " ");
      return h;
    },

    detect: function (h) {
      if (!h) return "";
      if (h === "item" || h === "no" || h === "no." || h === "ลำดับ") return FieldKeys.Item;
      if (h === "name" || h === "title" || h === "คำนำหน้า" || h === "นาม") return FieldKeys.Title;
      if (h === "f-name" || h === "fname" || h === "firstname" || h === "first name" || h === "ชื่อ") return FieldKeys.FirstName;
      if (h === "l-name" || h === "lname" || h === "lastname" || h === "last name" || h === "นามสกุล") return FieldKeys.LastName;
      if (h.indexOf("id") >= 0 && h.indexOf("no") >= 0) return FieldKeys.IdNo;
      if (h.indexOf("บัตรประชาชน") >= 0) return FieldKeys.IdNo;
      if (h.indexOf("อายุ") >= 0) return FieldKeys.Age;
      // ไฟล์เดิมใช้หัว "(ปี)" เก็บอายุ (ค่าที่พบ 6–92 ปี) ไม่ใช่ปีเกิด
      if (h === "(ปี)" || h === "ปี") return FieldKeys.Age;
      if (h === "ปีเกิด" || h.indexOf("ปีเกิด") >= 0 || h === "birthyear" || h === "birth year") return FieldKeys.BirthYear;
      if (h === "เลขที่" || h.indexOf("บ้านเลขที่") >= 0 || h === "house" || h === "house no") return FieldKeys.House;
      if (h.indexOf("หมู่ที่") >= 0 || h === "moo") return FieldKeys.Moo;
      if (h.indexOf("ชุมชน") >= 0 || h === "community") return FieldKeys.Community;
      if (h.indexOf("ตำบล") >= 0 || h === "tambon") return FieldKeys.Tambon;
      if (h.indexOf("อ่านหนังสือ") >= 0 || h === "readbook" || h === "reading") return FieldKeys.ReadBook;
      if (h === "pd" || h === "p.d.") return FieldKeys.PD;
      if (h.indexOf("va/r") >= 0 || h === "va right" || h === "vaขวา" || h === "va ขวา") return FieldKeys.VA_R;
      if (h.indexOf("va/l") >= 0 || h === "va left" || h === "vaซ้าย" || h === "va ซ้าย") return FieldKeys.VA_L;
      if (h.indexOf("อำเภอ") >= 0 || h === "amphoe" || h === "district") return FieldKeys.Amphoe;
      if (h.indexOf("จังหวัด") >= 0 || h === "province") return FieldKeys.Province;
      if (h.indexOf("สั้น") >= 0 || h.indexOf("myopia") >= 0) return FieldKeys.ShortHand;
      if (h.indexOf("ยาว") >= 0 || h.indexOf("hyperopia") >= 0) return FieldKeys.LongHand;
      if (h.indexOf("add") >= 0) return FieldKeys.Add;
      if (h.indexOf("cyl") >= 0) return FieldKeys.Cyl;
      if (h.indexOf("axt") >= 0) return FieldKeys.Axt;
      if (h.indexOf("ปัญหาสายตา") >= 0 || h.indexOf("ปัญหา") >= 0) return FieldKeys.EyeProblem;
      if (h.indexOf("คัดกรอง") >= 0) return FieldKeys.ScreenCode;
      if (h.indexOf("สถานที่ตรวจ") >= 0 || h === "place" || h === "site") return FieldKeys.Place;
      if (h.indexOf("วันที่ตรวจ") >= 0 || h.indexOf("วันที่") >= 0) return FieldKeys.ExamDate;

      if (h === "ขวา" || h === "right" || h === "right eye" || h === "righteye" || h === "r" ||
          h === "ค่าสายตาขวา" || h === "สายตาขวา") return "R";
      if (h === "ซ้าย" || h === "left" || h === "left eye" || h === "lefteye" || h === "l" ||
          h === "ค่าสายตาซ้าย" || h === "สายตาซ้าย") return "L";
      if (h === "lens" || h === "lenstype" || h === "ชนิดเลนส์") return "Lens";
      if (h === "ชาย" || h === "male" || h === "m") return "M";
      if (h === "หญิง" || h === "female" || h === "w") return "W";
      return "";
    },

    buildMapping: function (headers) {
      var map = [];
      var used = Object.create(null);
      for (var i = 0; i < headers.length; i++) {
        var key = this.detect(this.normalize(headers[i]));
        if (!key || used[key.toLowerCase()]) key = this.extraKey(i);
        else used[key.toLowerCase()] = true;
        map.push(key);
      }
      return map;
    }
  };

  function compactKey(header) {
    return String(header || "").replace(/[^\p{L}\p{N}]/gu, "");
  }

  global.StickerFields = {
    FieldKeys: FieldKeys,
    StickerRecord: StickerRecord,
    ColumnMapper: ColumnMapper,
    compactKey: compactKey,
    trim: trim
  };
})(window);
