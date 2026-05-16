"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var report_pdf_exports = {};
__export(report_pdf_exports, {
  buildReportPdf: () => buildReportPdf
});
module.exports = __toCommonJS(report_pdf_exports);
var import_pdfkit = __toESM(require("pdfkit"));
function fmtMoney(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return "PKR 0.00";
  return `PKR ${(n / 100).toFixed(2)}`;
}
function fmtWhen(iso) {
  try {
    return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}
const PAGE_Y_MAX = 780;
function ensureY(doc, lineHeight) {
  if (doc.y + lineHeight > PAGE_Y_MAX) {
    doc.addPage();
  }
}
function buildReportPdf(snapshot) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new import_pdfkit.default({ margin: 48, size: "A4", info: { Title: "Sales & expenses report" } });
    doc.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.font("Helvetica");
    doc.fontSize(16).text("Sales & expenses report", { align: "center" });
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor("#333333");
    doc.text(`Period: ${snapshot.startDate} \u2013 ${snapshot.endDate}`, { align: "center" });
    doc.text(`Generated: ${fmtWhen(snapshot.generatedAt)}`, { align: "center" });
    doc.moveDown(0.8);
    doc.fillColor("#000000");
    doc.fontSize(12).text("Summary", { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10);
    doc.text(`Bills: ${snapshot.billsCount}`);
    doc.text(`Sales total: ${fmtMoney(snapshot.salesTotalCents)}`);
    doc.text(`Discounts: ${fmtMoney(snapshot.discountTotalCents)}`);
    doc.text(`Expenses: ${fmtMoney(snapshot.expensesTotalCents)}`);
    doc.text(`Profit estimate: ${fmtMoney(snapshot.profitEstimateCents)}`);
    doc.moveDown(0.6);
    doc.fontSize(12).text("Sales", { underline: true });
    doc.moveDown(0.3);
    if (snapshot.sales.length === 0) {
      doc.fontSize(10).text("No sales in this range.");
    } else {
      for (const s of snapshot.sales) {
        ensureY(doc, 36);
        doc.fontSize(8).text(
          `${s.invoiceNo}  |  ${fmtWhen(s.saleAt)}  |  ${s.paymentMethod}  |  lines ${s.itemCount}  |  sub ${fmtMoney(s.subtotalCents)}  |  disc ${fmtMoney(s.discountCents)}  |  total ${fmtMoney(s.totalCents)}`,
          { width: 500 }
        );
        doc.moveDown(0.15);
      }
    }
    doc.moveDown(0.5);
    doc.fontSize(12).text("Expenses", { underline: true });
    doc.moveDown(0.3);
    if (snapshot.expenses.length === 0) {
      doc.fontSize(10).text("No expenses in this range.");
    } else {
      for (const e of snapshot.expenses) {
        ensureY(doc, 28);
        doc.fontSize(8).text(`${e.title}  (${e.category})  |  ${fmtWhen(e.spentAt)}  |  ${fmtMoney(e.amountCents)}`, {
          width: 500
        });
        doc.moveDown(0.15);
      }
    }
    doc.end();
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildReportPdf
});
