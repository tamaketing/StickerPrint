/* ตัววาดป้ายลง Canvas — ใช้หน่วยมิลลิเมตรเป็นหน่วยหลัก
 * ใช้ตัวเดียวกันทั้งพรีวิว, พิมพ์, PNG และ PDF เพื่อให้ได้ผลลัพธ์ตรงกัน */
(function (global) {
  "use strict";

  var MM_PER_PT = 25.4 / 72;
  var imageCache = Object.create(null);

  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : (fallback == null ? 0 : fallback);
  }

  function geometry(t) {
    var W = t.Landscape ? num(t.PageHeightMm, 297) : num(t.PageWidthMm, 210);
    var H = t.Landscape ? num(t.PageWidthMm, 210) : num(t.PageHeightMm, 297);
    var ml = num(t.MarginLeftMm, 10), mr = num(t.MarginRightMm, 10);
    var mt = num(t.MarginTopMm, 10), mb = num(t.MarginBottomMm, 10);
    var printableW = Math.max(1, W - ml - mr);
    var printableH = Math.max(1, H - mt - mb);
    var cols = Math.max(1, Math.round(num(t.Columns, 3)));
    var rows = Math.max(1, Math.round(num(t.Rows, 8)));
    var gx = num(t.GutterXMm, 0), gy = num(t.GapYMm, 0);
    var cellW = Math.max(1, (printableW - gx * (cols - 1)) / cols);
    var cellH = Math.max(1, (printableH - gy * (rows - 1)) / rows);
    return {
      W: W, H: H,
      marginLeft: ml, marginTop: mt,
      cellW: cellW, cellH: cellH,
      columns: cols, rows: rows,
      gutterX: gx, gapY: gy,
      perPage: Math.max(1, cols * rows)
    };
  }

  function pageCount(t, recordCount) {
    if (!t || recordCount <= 0) return 0;
    return Math.ceil(recordCount / geometry(t).perPage);
  }

  function applyOffsets(source, dx, dy) {
    var t = JSON.parse(JSON.stringify(source));
    dx = num(dx, 0);
    dy = num(dy, 0);
    dx = Math.max(-num(t.MarginLeftMm, 0), Math.min(dx, num(t.MarginRightMm, 0)));
    dy = Math.max(-num(t.MarginTopMm, 0), Math.min(dy, num(t.MarginBottomMm, 0)));
    t.MarginLeftMm = num(t.MarginLeftMm) + dx;
    t.MarginRightMm = num(t.MarginRightMm) - dx;
    t.MarginTopMm = num(t.MarginTopMm) + dy;
    t.MarginBottomMm = num(t.MarginBottomMm) - dy;
    return t;
  }

  function loadImage(src) {
    if (!src) return Promise.resolve(null);
    if (imageCache[src]) return imageCache[src];
    imageCache[src] = new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
    return imageCache[src];
  }

  function fontStack(name) {
    var safe = String(name || "Tahoma").replace(/["\\]/g, "").trim() || "Tahoma";
    return '"' + safe + '", "Leelawadee UI", "Tahoma", "Noto Sans Thai", sans-serif';
  }

  function fontString(el, sizePt) {
    var style = (el.Italic ? "italic " : "") + (el.Bold ? "bold " : "");
    var sizeMm = sizePt * MM_PER_PT;
    return style + sizeMm.toFixed(4) + "px " + fontStack(el.FontName);
  }

  function lineHeightMm(sizePt, el) {
    return sizePt * MM_PER_PT * 1.16 + num(el.LineSpacingMm, 0);
  }

  function wrapText(ctx, text, maxWidth) {
    var paragraphs = String(text == null ? "" : text)
      .replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var lines = [];

    for (var p = 0; p < paragraphs.length; p++) {
      var para = paragraphs[p];
      if (!para) { lines.push(""); continue; }

      var chars = Array.from(para);
      var line = "";
      for (var i = 0; i < chars.length; i++) {
        var ch = chars[i];
        var test = line + ch;
        if (line && ctx.measureText(test).width > maxWidth) {
          var breakAt = line.lastIndexOf(" ");
          if (breakAt > 0 && line.length - breakAt < 24) {
            lines.push(line.slice(0, breakAt));
            line = line.slice(breakAt + 1) + ch;
          } else {
            lines.push(line);
            line = ch === " " ? "" : ch;
          }
        } else {
          line = test;
        }
      }
      lines.push(line);
    }
    return lines.length ? lines : [""];
  }

  function layoutText(ctx, el, text, boxW, boxH) {
    var size = Math.max(1, num(el.FontSizePt, 9));
    var minSize = 4;
    var lines, lh, maxW, guard = 0;

    for (;;) {
      ctx.font = fontString(el, size);
      lines = wrapText(ctx, text, boxW);
      lh = lineHeightMm(size, el);
      maxW = 0;
      for (var i = 0; i < lines.length; i++) {
        maxW = Math.max(maxW, ctx.measureText(lines[i]).width);
      }
      var fits = maxW <= boxW + 0.02 && lines.length * lh <= boxH + 0.02;
      if (!el.AutoShrink || fits || size <= minSize || guard++ > 200) break;
      size = Math.max(minSize, size - 0.5);
    }
    return { size: size, lines: lines, lineHeight: lh };
  }

  function drawTextElement(ctx, el, text, x, y, boxW, boxH) {
    if (!text) return;
    var layout = layoutText(ctx, el, text, boxW, boxH);
    var blockH = layout.lines.length * layout.lineHeight;

    var top = y;
    if (el.VAlign === "Middle") top = y + (boxH - blockH) / 2;
    else if (el.VAlign === "Bottom") top = y + boxH - blockH;

    var align = el.Align === "Center" ? "center" : (el.Align === "Right" ? "right" : "left");
    var tx = align === "center" ? x + boxW / 2 : (align === "right" ? x + boxW : x);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, Math.max(0.1, boxW), Math.max(0.1, boxH));
    ctx.clip();
    ctx.font = fontString(el, layout.size);
    ctx.fillStyle = el.ForeColor || "#000000";
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    for (var i = 0; i < layout.lines.length; i++) {
      ctx.fillText(layout.lines[i], tx, top + i * layout.lineHeight + layout.lineHeight / 2);
    }
    ctx.restore();
  }

  function slotPosition(t, g, slot) {
    var columnOrder = String(t.FillOrder || "Row").toLowerCase() === "column";
    var col = columnOrder ? Math.floor(slot / g.rows) : (slot % g.columns);
    var row = columnOrder ? (slot % g.rows) : Math.floor(slot / g.columns);
    return {
      x: g.marginLeft + col * (g.cellW + g.gutterX),
      y: g.marginTop + row * (g.cellH + g.gapY)
    };
  }

  function drawPageLines(ctx, t, g, usedCells) {
    var lines = t.PageLines || [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (usedCells) {
        var midX = (num(line.X1mm) + num(line.X2mm)) / 2;
        var midY = (num(line.Y1mm) + num(line.Y2mm)) / 2;
        var keep = false;
        for (var c = 0; c < usedCells.length; c++) {
          var cell = usedCells[c];
          if (midX >= cell.x - 1.5 && midX <= cell.x + cell.w + 1.5 &&
              midY >= cell.y - 1.5 && midY <= cell.y + cell.h + 1.5) { keep = true; break; }
        }
        if (!keep) continue;
      }
      ctx.beginPath();
      ctx.strokeStyle = line.Color || "#000000";
      ctx.lineWidth = Math.max(0.08, num(line.WidthMm, 0.2));
      ctx.moveTo(num(line.X1mm), num(line.Y1mm));
      ctx.lineTo(num(line.X2mm), num(line.Y2mm));
      ctx.stroke();
    }
  }

  function drawImageElement(ctx, el, image, cellX, cellY, cellW, cellH) {
    if (!image || !image.naturalWidth) return;
    var boxW = Math.max(1, Math.min(num(el.Wmm, 15), cellW - num(el.Xmm)));
    var boxH = Math.max(1, Math.min(num(el.Hmm, 12), cellH - num(el.Ymm)));
    var scale = Math.min(boxW / image.naturalWidth, boxH / image.naturalHeight);
    var drawW = Math.max(0.5, image.naturalWidth * scale);
    var drawH = Math.max(0.5, image.naturalHeight * scale);
    var x = cellX + num(el.Xmm) + (boxW - drawW) / 2;
    var y = cellY + num(el.Ymm) + (boxH - drawH) / 2;
    ctx.drawImage(image, x, y, drawW, drawH);
  }

  async function renderPage(template, records, pageIndex, dpi, options) {
    options = options || {};
    dpi = Math.max(36, Math.min(600, num(dpi, 150)));

    var g = geometry(template);
    var scale = dpi / 25.4;
    var canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(g.W * scale));
    canvas.height = Math.max(1, Math.round(g.H * scale));

    var ctx = canvas.getContext("2d");
    ctx.setTransform(canvas.width / g.W, 0, 0, canvas.height / g.H, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.lineJoin = "miter";

    var perPage = g.perPage;
    var first = pageIndex * perPage;
    var remaining = Math.max(0, records.length - first);
    var slots = template.SkipBlankSlots ? Math.min(perPage, remaining) : perPage;
    var columnOrder = String(template.FillOrder || "Row").toLowerCase() === "column";

    var usedCells = null;
    if (template.SkipBlankSlots && slots < perPage) {
      usedCells = [];
      for (var s = 0; s < slots; s++) {
        var pos = slotPosition(template, g, s);
        usedCells.push({ x: pos.x, y: pos.y, w: g.cellW, h: g.cellH });
      }
    }

    drawPageLines(ctx, template, g, usedCells);

    // เตรียมรูป (โลโก้)
    var templateImages = template.Images || [];
    var loadedImages = [];
    for (var im = 0; im < templateImages.length; im++) {
      var src = templateImages[im].Source || "";
      if (String(src).toLowerCase() === "builtin:cross") {
        if (options.logoImage) loadedImages.push(options.logoImage);
        else loadedImages.push(await loadImage(options.defaultLogoUrl || "assets/logo-cross.png"));
      } else {
        loadedImages.push(await loadImage(src));
      }
    }

    for (var slot = 0; slot < slots; slot++) {
      var p = slotPosition(template, g, slot);

      if (template.ShowBorders) {
        ctx.strokeStyle = "#dcdcdc";
        ctx.lineWidth = 0.15;
        ctx.strokeRect(p.x, p.y, g.cellW, g.cellH);
      }

      for (var k = 0; k < loadedImages.length; k++) {
        drawImageElement(ctx, templateImages[k], loadedImages[k], p.x, p.y, g.cellW, g.cellH);
      }

      var recIndex = first + slot;
      if (recIndex >= records.length) continue;
      var rec = records[recIndex];
      var sequence = template.RestartNumberingPerSheet ? (slot + 1) : (rec.sequence || recIndex + 1);

      var elements = template.Elements || [];
      for (var e = 0; e < elements.length; e++) {
        var el = elements[e];
        var text = rec.expand(el.Text || "", sequence);
        if (!text) continue;

        var boxW = Math.max(1, Math.min(num(el.Wmm, 60), g.cellW - num(el.Xmm)));
        var boxH = Math.max(1, Math.min(num(el.Hmm, 10), g.cellH - num(el.Ymm)));
        drawTextElement(ctx, el, text, p.x + num(el.Xmm), p.y + num(el.Ymm), boxW, boxH);
      }
    }

    return canvas;
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      if (canvas.toBlob) {
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error("สร้างไฟล์ภาพไม่สำเร็จ"));
        }, type || "image/png", quality);
      } else {
        try {
          var dataUrl = canvas.toDataURL(type || "image/png", quality);
          var bin = atob(dataUrl.split(",")[1]);
          var bytes = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          resolve(new Blob([bytes], { type: type || "image/png" }));
        } catch (e) { reject(e); }
      }
    });
  }

  global.LabelRenderer = {
    geometry: geometry,
    pageCount: pageCount,
    applyOffsets: applyOffsets,
    loadImage: loadImage,
    renderPage: renderPage,
    canvasToBlob: canvasToBlob,
    MM_PER_PT: MM_PER_PT
  };
})(window);
