// Thin wrapper over the `docx` library — gives manual scripts a small API:
//   const doc = new ManualBuilder({ title, subtitle });
//   doc.h1("Step 1"); doc.p("..."); doc.screenshot(buffer, "Caption");
//   doc.callout("Be careful!", "warning"); doc.list(["a", "b"]);
//   await doc.save(path);
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
  HeadingLevel,
  ShadingType,
  BorderStyle,
} from "docx";
import { writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import sizeOf from "image-size";

const COLORS = {
  // Tailwind-ish palette
  text: "1f2937",
  muted: "6b7280",
  primary: "2563eb",
  warning: "92400e",
  warningBg: "fef3c7",
  info: "1e40af",
  infoBg: "dbeafe",
  success: "065f46",
  successBg: "d1fae5",
  border: "e5e7eb",
};

export class ManualBuilder {
  constructor({ title, subtitle, author = "Stannum Can / Winhoop CRM" } = {}) {
    this.title = title;
    this.subtitle = subtitle;
    this.author = author;
    this.children = [];
    this.addCoverPage();
  }

  addCoverPage() {
    this.children.push(
      new Paragraph({
        spacing: { before: 600, after: 200 },
        children: [
          new TextRun({ text: this.title, bold: true, size: 44, color: COLORS.text }),
        ],
      }),
    );
    if (this.subtitle) {
      this.children.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [new TextRun({ text: this.subtitle, size: 24, color: COLORS.muted })],
        }),
      );
    }
    const date = new Date().toISOString().slice(0, 10);
    this.children.push(
      new Paragraph({
        spacing: { after: 400 },
        children: [
          new TextRun({ text: `Prepared by ${this.author} · ${date}`, size: 18, color: COLORS.muted, italics: true }),
        ],
      }),
    );
  }

  h1(text) {
    this.children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360, after: 120 },
        children: [new TextRun({ text, bold: true, size: 32, color: COLORS.text })],
      }),
    );
  }

  h2(text) {
    this.children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 100 },
        children: [new TextRun({ text, bold: true, size: 26, color: COLORS.text })],
      }),
    );
  }

  p(text, opts = {}) {
    const runs = Array.isArray(text)
      ? text.map((t) =>
          typeof t === "string"
            ? new TextRun({ text: t, size: 22, color: COLORS.text })
            : new TextRun({ ...t, size: t.size ?? 22, color: t.color ?? COLORS.text }))
      : [new TextRun({ text, size: 22, color: COLORS.text })];
    this.children.push(new Paragraph({ spacing: { after: 120 }, children: runs, ...opts }));
  }

  list(items) {
    for (const item of items) {
      this.children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 60 },
          children: [new TextRun({ text: item, size: 22, color: COLORS.text })],
        }),
      );
    }
  }

  numberedList(items) {
    for (const item of items) {
      this.children.push(
        new Paragraph({
          numbering: { reference: "manual-numbering", level: 0 },
          spacing: { after: 60 },
          children: [new TextRun({ text: item, size: 22, color: COLORS.text })],
        }),
      );
    }
  }

  callout(text, kind = "info") {
    const palette = {
      info: { fg: COLORS.info, bg: COLORS.infoBg, label: "Note" },
      warning: { fg: COLORS.warning, bg: COLORS.warningBg, label: "Important" },
      success: { fg: COLORS.success, bg: COLORS.successBg, label: "Tip" },
    }[kind] ?? { fg: COLORS.info, bg: COLORS.infoBg, label: "Note" };

    this.children.push(
      new Paragraph({
        spacing: { before: 120, after: 120 },
        shading: { type: ShadingType.SOLID, color: palette.bg, fill: palette.bg },
        border: {
          left: { style: BorderStyle.SINGLE, size: 16, color: palette.fg, space: 6 },
          top: { style: BorderStyle.SINGLE, size: 4, color: palette.bg, space: 4 },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: palette.bg, space: 4 },
          right: { style: BorderStyle.SINGLE, size: 4, color: palette.bg, space: 4 },
        },
        children: [
          new TextRun({ text: `${palette.label}: `, bold: true, color: palette.fg, size: 22 }),
          new TextRun({ text, color: palette.fg, size: 22 }),
        ],
      }),
    );
  }

  code(text) {
    this.children.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({
            text,
            font: "Consolas",
            size: 20,
            color: COLORS.text,
            shading: { type: ShadingType.SOLID, color: "f3f4f6", fill: "f3f4f6" },
          }),
        ],
      }),
    );
  }

  screenshot(buffer, caption, { maxWidthInches = 6.2 } = {}) {
    const dpi = 96;
    const dim = sizeOf(buffer);
    const widthPx = dim.width;
    const heightPx = dim.height;
    // Scale down if needed
    const maxWidthPx = maxWidthInches * dpi;
    const ratio = widthPx > maxWidthPx ? maxWidthPx / widthPx : 1;
    const renderW = Math.round(widthPx * ratio);
    const renderH = Math.round(heightPx * ratio);

    this.children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 60 },
        children: [
          new ImageRun({
            data: buffer,
            transformation: { width: renderW, height: renderH },
          }),
        ],
      }),
    );
    if (caption) {
      this.children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({ text: caption, italics: true, size: 18, color: COLORS.muted }),
          ],
        }),
      );
    }
  }

  pageBreak() {
    this.children.push(new Paragraph({ pageBreakBefore: true, children: [] }));
  }

  async save(path) {
    const doc = new Document({
      creator: this.author,
      title: this.title,
      description: this.subtitle ?? "",
      numbering: {
        config: [
          {
            reference: "manual-numbering",
            levels: [
              { level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START, style: { paragraph: { indent: { left: 360, hanging: 260 } } } },
            ],
          },
        ],
      },
      styles: {
        default: { document: { run: { font: "Calibri", size: 22 } } },
      },
      sections: [{ properties: {}, children: this.children }],
    });
    const buffer = await Packer.toBuffer(doc);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, buffer);
    return path;
  }
}
