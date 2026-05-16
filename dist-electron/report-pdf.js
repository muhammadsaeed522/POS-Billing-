"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReportPdf = buildReportPdf;
const pdfkit_1 = __importDefault(require("pdfkit"));
function fmtMoney(cents) {
    const n = Number(cents);
    if (!Number.isFinite(n))
        return "PKR 0.00";
    return `PKR ${(n / 100).toFixed(2)}`;
}
function fmtWhen(iso) {
    try {
        return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
    }
    catch {
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
        const doc = new pdfkit_1.default({ margin: 48, size: "A4", info: { Title: "Sales & expenses report" } });
        doc.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
        doc.font("Helvetica");
        doc.fontSize(16).text("Sales & expenses report", { align: "center" });
        doc.moveDown(0.4);
        doc.fontSize(10).fillColor("#333333");
        doc.text(`Period: ${snapshot.startDate} – ${snapshot.endDate}`, { align: "center" });
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
        }
        else {
            for (const s of snapshot.sales) {
                ensureY(doc, 36);
                doc.fontSize(8).text(`${s.invoiceNo}  |  ${fmtWhen(s.saleAt)}  |  ${s.paymentMethod}  |  lines ${s.itemCount}  |  sub ${fmtMoney(s.subtotalCents)}  |  disc ${fmtMoney(s.discountCents)}  |  total ${fmtMoney(s.totalCents)}`, { width: 500 });
                doc.moveDown(0.15);
            }
        }
        doc.moveDown(0.5);
        doc.fontSize(12).text("Expenses", { underline: true });
        doc.moveDown(0.3);
        if (snapshot.expenses.length === 0) {
            doc.fontSize(10).text("No expenses in this range.");
        }
        else {
            for (const e of snapshot.expenses) {
                ensureY(doc, 28);
                doc
                    .fontSize(8)
                    .text(`${e.title}  (${e.category})  |  ${fmtWhen(e.spentAt)}  |  ${fmtMoney(e.amountCents)}`, {
                    width: 500,
                });
                doc.moveDown(0.15);
            }
        }
        doc.end();
    });
}
