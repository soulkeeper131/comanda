import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ============================================================
// Генерира PDF отчет за конкретен обход
// ============================================================
export async function generateJobReport(job: any): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header
  doc.setFontSize(18);
  doc.setTextColor(0, 100, 148); // #006494
  doc.text("Ко Манда — Отчет за обход", pageWidth / 2, y, { align: "center" });
  y += 9;

  // Property info
  doc.setFontSize(12);
  doc.setTextColor(27, 152, 224); // #1b98e0
  const propertyName = job.property_name || job.propertyName || "—";
  doc.text(`Имот: ${propertyName}`, 14, y);
  y += 7;

  const address = job.property_addr || job.address || "—";
  doc.text(`Адрес: ${address}`, 14, y);
  y += 7;

  const plannedAt = job.planned_at || job.date;
  const dateStr = plannedAt
    ? new Date(plannedAt).toLocaleDateString("bg-BG", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  doc.text(`Дата: ${dateStr}`, 14, y);
  y += 7;

  const worker = job.assignee_name || job.worker || "—";
  doc.text(`Изпълнител: ${worker}`, 14, y);
  y += 7;

  // Status
  const statusMap: Record<string, string> = {
    planned: "📅 Предстои",
    in_progress: "🔄 В процес",
    completed: "✅ Завършен",
    cancelled: "❌ Отказан",
  };
  const statusLabel = statusMap[job.status] || job.status || "—";
  doc.text(`Статус: ${statusLabel}`, 14, y);
  y += 7;

  // Duration
  let duration = "—";
  if (job.check_in && job.check_out) {
    const ms =
      new Date(job.check_out).getTime() - new Date(job.check_in).getTime();
    const minutes = Math.round(ms / 60000);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    duration = `${h}ч ${m}мин`;
  } else if (job.duration_min) {
    const h = Math.floor(job.duration_min / 60);
    const m = job.duration_min % 60;
    duration = `${h}ч ${m}мин`;
  }
  doc.text(`Времетраене: ${duration}`, 14, y);
  y += 10;

  // Items table
  if (job.items && job.items.length > 0) {
    doc.setFontSize(13);
    doc.setTextColor(0, 100, 148);
    doc.text("Чек-лист стъпки", 14, y);
    y += 6;

    const tableData = job.items.map((item: any) => [
      item.zone_label || "—",
      item.label || "—",
      item.done ? "✅" : "❌",
      item.note || "",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Зона", "Описание", "Статус", "Бележка"]],
      body: tableData,
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [0, 100, 148],
      },
      headStyles: {
        fillColor: [27, 152, 224],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [232, 241, 242],
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Photos
  if (job.photos && job.photos.length > 0) {
    doc.setFontSize(13);
    doc.setTextColor(0, 100, 148);
    doc.text(`Снимки (${job.photos.length})`, 14, y);
    y += 8;

    const photoSize = 50;
    const margin = 14;
    let x = margin;

    for (let i = 0; i < job.photos.length; i++) {
      const photo = job.photos[i];

      // Check if we need a new page
      if (y + photoSize + 10 > doc.internal.pageSize.getHeight() - 10) {
        doc.addPage();
        y = 15;
        x = margin;
      }

      try {
        let imgData: string;
        if (photo.startsWith("data:")) {
          imgData = photo;
        } else if (photo.startsWith("/api/photos/")) {
          // Fetch from API
          const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          const resp = await fetch(`${baseUrl}${photo}`);
          if (!resp.ok) continue;
          const arrayBuffer = await resp.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          const mimeType = resp.headers.get("content-type") || "image/jpeg";
          imgData = `data:${mimeType};base64,${base64}`;
        } else {
          // Assume it's a file path
          try {
            const fs = await import("fs");
            if (fs.existsSync(photo)) {
              const buf = fs.readFileSync(photo);
              const base64 = buf.toString("base64");
              const ext = photo.split(".").pop()?.toLowerCase() || "jpg";
              const mime =
                ext === "png"
                  ? "image/png"
                  : ext === "webp"
                  ? "image/webp"
                  : "image/jpeg";
              imgData = `data:${mime};base64,${base64}`;
            } else {
              continue;
            }
          } catch {
            continue;
          }
        }

        // Position: 2 per row
        if (i % 2 === 0 && i > 0) {
          x = margin;
          y += photoSize + 12;
        }

        if (y + photoSize + 10 > doc.internal.pageSize.getHeight() - 10) {
          doc.addPage();
          y = 15;
          x = margin;
        }

        doc.addImage(imgData, "JPEG", x, y, photoSize, photoSize);

        // Label
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(
          photo.taken_at
            ? new Date(photo.taken_at).toLocaleDateString("bg-BG")
            : "",
          x,
          y + photoSize + 5,
          { align: "center", maxWidth: photoSize }
        );

        x += photoSize + 10;
      } catch (err) {
        console.error("Error adding photo to PDF:", err);
      }
    }

    y += photoSize + 15;
  }

  // Notes
  if (job.note) {
    if (y + 30 > doc.internal.pageSize.getHeight() - 10) {
      doc.addPage();
      y = 15;
    }
    doc.setFontSize(12);
    doc.setTextColor(0, 100, 148);
    doc.text("Бележки:", 14, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(36, 123, 160);
    const lines = doc.splitTextToSize(job.note, pageWidth - 28);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 5;
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Генериран от Ко Манда — ${new Date().toLocaleDateString("bg-BG")}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: "center" }
  );

  const pdfBuffer = doc.output("arraybuffer");
  return Buffer.from(pdfBuffer);
}

// ============================================================
// Генерира PDF отчет с констатации
// ============================================================
export async function generateFindingsReport(findings: any[]): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Title
  doc.setFontSize(18);
  doc.setTextColor(0, 100, 148);
  doc.text("Ко Манда — Отчет с констатации", pageWidth / 2, y, {
    align: "center",
  });
  y += 9;

  doc.setFontSize(10);
  doc.setTextColor(36, 123, 160);
  doc.text(
    `Генериран на ${new Date().toLocaleDateString("bg-BG")} — Общо ${findings.length} констатации`,
    14,
    y
  );
  y += 10;

  if (findings.length === 0) {
    doc.setFontSize(14);
    doc.setTextColor(36, 123, 160);
    doc.text("Няма констатации за избрания период.", 14, y);
    const pdfBuffer = doc.output("arraybuffer");
    return Buffer.from(pdfBuffer);
  }

  const statusMap: Record<string, string> = {
    open: "🔴 Отворен",
    in_progress: "🟡 В процес",
    resolved: "🟢 Решен",
  };

  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];

    if (y > doc.internal.pageSize.getHeight() - 50) {
      doc.addPage();
      y = 15;
    }

    // Finding card background
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, pageWidth - 28, 35, 3, 3, "F");

    // Border around card
    doc.setDrawColor(228, 233, 240);
    doc.roundedRect(14, y, pageWidth - 28, 35, 3, 3, "D");

    // Title
    doc.setFontSize(11);
    doc.setTextColor(0, 100, 148);
    doc.text(`${i + 1}. ${f.title || "Без заглавие"}`, 18, y + 6);

    // Status badge
    const status = statusMap[f.status] || f.status || "—";
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Статус: ${status}`, 18, y + 12);

    // Property
    const propName = f.property_name || f.propertyName || "—";
    doc.text(`Имот: ${propName}`, 18, y + 17);

    // Reporter
    if (f.reporter_name) {
      doc.text(`Докладван от: ${f.reporter_name}`, 18, y + 22);
    }

    // Created at
    if (f.created_at) {
      const dateStr = new Date(f.created_at).toLocaleDateString("bg-BG");
      doc.text(`Дата: ${dateStr}`, pageWidth - 60, y + 22);
    }

    // Body
    if (f.body) {
      y += 24;
      doc.setFontSize(9);
      doc.setTextColor(36, 123, 160);
      const bodyLines = doc.splitTextToSize(f.body, pageWidth - 36);
      doc.text(bodyLines, 18, y);
      y += bodyLines.length * 4 + 2;
    }

    y += 8;

    // Photos row for this finding
    if (f.photos && f.photos.length > 0) {
      doc.setFillColor(232, 241, 242);
      doc.setTextColor(0, 100, 148);
      doc.setFontSize(8);
      doc.text(
        `Снимки: ${f.photos.length}`,
        18,
        y > doc.internal.pageSize.getHeight() - 20 ? (doc.addPage(), 15) : y
      );
      y += 4;

      const thumbSize = 35;
      const margin = 18;
      let x = margin;

      for (const photo of f.photos) {
        if (x + thumbSize > pageWidth - margin) {
          x = margin;
          y += thumbSize + 10;
        }
        if (y + thumbSize + 10 > doc.internal.pageSize.getHeight() - 10) {
          doc.addPage();
          y = 15;
          x = margin;
        }

        try {
          let imgData: string;
          const base =
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          const url = photo.url || photo;
          const resp = await fetch(`${base}${url}`);
          if (resp.ok) {
            const arrayBuffer = await resp.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString("base64");
            const mimeType = resp.headers.get("content-type") || "image/jpeg";
            imgData = `data:${mimeType};base64,${base64}`;
            doc.addImage(imgData, "JPEG", x, y, thumbSize, thumbSize);
          }
        } catch {
          // skip image
        }
        x += thumbSize + 6;
      }

      y += thumbSize + 10;
    }

    y += 6;
    // Separator
    doc.setDrawColor(228, 233, 240);
    doc.line(14, y, pageWidth - 14, y);
    y += 4;
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Генериран от Ко Манда — ${new Date().toLocaleDateString("bg-BG")}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: "center" }
  );

  const pdfBuffer = doc.output("arraybuffer");
  return Buffer.from(pdfBuffer);
}

// ============================================================
// Генерира PDF отчет за всички обходи/констатации на имот
// ============================================================
export async function generatePropertyReport(
  property: any,
  jobs: any[],
  findings: any[]
): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Title
  doc.setFontSize(18);
  doc.setTextColor(0, 100, 148);
  doc.text("Ко Манда — Отчет за имот", pageWidth / 2, y, { align: "center" });
  y += 10;

  // Property header card
  doc.setFillColor(232, 241, 242);
  doc.roundedRect(14, y, pageWidth - 28, 28, 3, 3, "F");
  doc.setDrawColor(27, 152, 224);
  doc.roundedRect(14, y, pageWidth - 28, 28, 3, 3, "D");

  doc.setFontSize(13);
  doc.setTextColor(0, 100, 148);
  doc.text(property.name || "Имот", 18, y + 8);

  doc.setFontSize(10);
  doc.setTextColor(36, 123, 160);
  doc.text(
    `Адрес: ${property.address || property.addr || "—"}`,
    18,
    y + 16
  );
  doc.text(
    `Тип: ${property.kind || "—"} | Обходи: ${jobs.length} | Констатации: ${findings.length}`,
    18,
    y + 22
  );
  y += 36;

  // ============================================================
  // Jobs section
  // ============================================================
  doc.setFontSize(14);
  doc.setTextColor(0, 100, 148);
  doc.text("Обходи", 14, y);
  y += 8;

  if (jobs.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text("Няма обходи за този имот.", 14, y);
    y += 8;
  } else {
    // Jobs table
    const jobRows = jobs.map((j) => {
      const statusMap: Record<string, string> = {
        planned: "Планиран",
        in_progress: "В процес",
        completed: "Завършен",
        cancelled: "Отказан",
      };
      const date = j.planned_at || j.date;
      const dateStr = date
        ? new Date(date).toLocaleDateString("bg-BG")
        : "—";
      return [
        dateStr,
        statusMap[j.status] || j.status || "—",
        j.assignee_name || j.worker || "—",
        `${j.itemsChecked || 0}/${j.itemsTotal || 0}`,
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["Дата", "Статус", "Изпълнител", "Точки"]],
      body: jobRows,
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [0, 100, 148],
      },
      headStyles: {
        fillColor: [27, 152, 224],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [232, 241, 242],
      },
    });

    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // ============================================================
  // Findings section
  // ============================================================
  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    y = 15;
  }

  doc.setFontSize(14);
  doc.setTextColor(0, 100, 148);
  doc.text("Констатации", 14, y);
  y += 8;

  if (findings.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text("Няма констатации за този имот.", 14, y);
  } else {
    const findingRows = findings.map((f) => {
      const statusMap: Record<string, string> = {
        open: "Отворен",
        in_progress: "В процес",
        resolved: "Решен",
      };
      const date = f.created_at
        ? new Date(f.created_at).toLocaleDateString("bg-BG")
        : "—";
      return [
        date,
        f.title || "—",
        statusMap[f.status] || f.status || "—",
        f.reporter_name || "—",
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["Дата", "Заглавие", "Статус", "Докладван от"]],
      body: findingRows,
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [0, 100, 148],
      },
      headStyles: {
        fillColor: [27, 152, 224],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [232, 241, 242],
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Генериран от Ко Манда — ${new Date().toLocaleDateString("bg-BG")}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: "center" }
  );

  const pdfBuffer = doc.output("arraybuffer");
  return Buffer.from(pdfBuffer);
}
