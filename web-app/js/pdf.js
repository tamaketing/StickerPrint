/* สร้างไฟล์ PDF แบบง่าย โดยฝังภาพ JPEG หนึ่งภาพต่อหนึ่งหน้า
 * (ไม่ต้องใช้ไลบรารีภายนอก) */
(function (global) {
  "use strict";

  function asciiBytes(text) {
    var out = new Uint8Array(text.length);
    for (var i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
    return out;
  }

  function concatBytes(parts) {
    var total = 0, i;
    for (i = 0; i < parts.length; i++) total += parts[i].length;
    var out = new Uint8Array(total);
    var offset = 0;
    for (i = 0; i < parts.length; i++) {
      out.set(parts[i], offset);
      offset += parts[i].length;
    }
    return out;
  }

  function fmt(n) { return (Math.round(n * 100) / 100).toString(); }

  /**
   * pages: [{ jpeg: Uint8Array, widthPx, heightPx, wMm, hMm }]
   */
  function build(pages) {
    if (!pages || !pages.length) throw new Error("ไม่มีหน้าสำหรับสร้าง PDF");

    var chunks = [];
    var length = 0;

    function push(bytes) {
      chunks.push(bytes);
      length += bytes.length;
    }
    function pushStr(s) { push(asciiBytes(s)); }

    var n = pages.length;
    var totalObjects = 2 + n * 3;
    var offsets = new Array(totalObjects + 1);

    function startObject(num) { offsets[num] = length; }

    pushStr("%PDF-1.4\n");
    push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

    startObject(1);
    pushStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

    startObject(2);
    pushStr("2 0 obj\n<< /Type /Pages /Kids [");
    for (var i = 0; i < n; i++) pushStr((3 + i * 3) + " 0 R ");
    pushStr("] /Count " + n + " >>\nendobj\n");

    for (i = 0; i < n; i++) {
      var page = pages[i];
      var pageNum = 3 + i * 3;
      var contentNum = pageNum + 1;
      var imageNum = pageNum + 2;
      var wPt = page.wMm / 25.4 * 72;
      var hPt = page.hMm / 25.4 * 72;

      startObject(pageNum);
      pushStr(pageNum + " 0 obj\n<< /Type /Page /Parent 2 0 R " +
        "/MediaBox [0 0 " + fmt(wPt) + " " + fmt(hPt) + "] " +
        "/Resources << /XObject << /Im0 " + imageNum + " 0 R >> >> " +
        "/Contents " + contentNum + " 0 R >>\nendobj\n");

      var content = "q\n" + fmt(wPt) + " 0 0 " + fmt(hPt) + " 0 0 cm\n/Im0 Do\nQ\n";
      var contentBytes = asciiBytes(content);
      startObject(contentNum);
      pushStr(contentNum + " 0 obj\n<< /Length " + contentBytes.length + " >>\nstream\n");
      push(contentBytes);
      pushStr("endstream\nendobj\n");

      startObject(imageNum);
      pushStr(imageNum + " 0 obj\n<< /Type /XObject /Subtype /Image " +
        "/Width " + page.widthPx + " /Height " + page.heightPx + " " +
        "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode " +
        "/Length " + page.jpeg.length + " >>\nstream\n");
      push(page.jpeg);
      pushStr("\nendstream\nendobj\n");
    }

    var xref = length;
    pushStr("xref\n0 " + (totalObjects + 1) + "\n");
    pushStr("0000000000 65535 f \n");
    for (var o = 1; o <= totalObjects; o++) {
      pushStr(("0000000000" + (offsets[o] || 0)).slice(-10) + " 00000 n \n");
    }
    pushStr("trailer\n<< /Size " + (totalObjects + 1) + " /Root 1 0 R >>\n");
    pushStr("startxref\n" + xref + "\n%%EOF\n");

    return new Blob([concatBytes(chunks)], { type: "application/pdf" });
  }

  async function canvasToJpegBytes(canvas, quality) {
    var blob = await new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) {
        if (b) resolve(b); else reject(new Error("แปลงภาพเป็น JPEG ไม่สำเร็จ"));
      }, "image/jpeg", quality == null ? 0.92 : quality);
    });
    return new Uint8Array(await blob.arrayBuffer());
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 4000);
  }

  global.Pdf = {
    build: build,
    canvasToJpegBytes: canvasToJpegBytes,
    downloadBlob: downloadBlob
  };
})(window);
