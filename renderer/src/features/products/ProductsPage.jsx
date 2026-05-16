import { jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BarcodeCameraModal } from "../../components/BarcodeCameraModal";
import { formatMoney, formatQtyFromMilli } from "../../lib/format";
import { suggestRetailBarcode } from "../../lib/barcodeUtils";
import { CategorySidebar } from "./CategorySidebar";
const UNITS = ["piece", "kg", "liter", "pack"];
function toCents(majorStr) {
  const n = Number(String(majorStr).replace(/,/g, "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}
function fromCents(cents) {
  return (cents / 100).toFixed(2);
}
function toMilli(unitsStr) {
  const n = Number(String(unitsStr).replace(/,/g, "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 1e3);
}
function fromMilli(milli) {
  return (milli / 1e3).toFixed(3).replace(/\.?0+$/, "");
}
function ProductsPage() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [barcodeError, setBarcodeError] = useState("");
  const [catName, setCatName] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [form, setForm] = useState({
    id: "",
    name: "",
    unit: "piece",
    categoryId: "",
    sku: "",
    barcode: "",
    imagePath: "",
    saleMajor: "",
    purchaseMajor: "",
    stockUnits: "1",
    lowStockUnits: "",
    isActive: true
  });
  const pos = window.pos;
  const validateBarcode = useCallback(
    async (override) => {
      const b = String(override ?? form.barcode).trim();
      if (!b) {
        setBarcodeError("");
        return true;
      }
      if (!pos?.checkProductBarcode) return true;
      const res = await pos.checkProductBarcode({
        barcode: b,
        excludeProductId: modalMode === "edit" ? form.id : void 0
      });
      if (res.available) {
        setBarcodeError("");
        return true;
      }
      setBarcodeError(`Barcode already used by \u201C${res.conflictName}\u201D.`);
      return false;
    },
    [form.barcode, form.id, modalMode, pos]
  );
  const loadCategories = useCallback(async () => {
    if (!pos?.listCategories) return;
    const rows = await pos.listCategories();
    setCategories(rows);
  }, [pos]);
  const loadProducts = useCallback(async () => {
    if (!pos?.listProducts) return;
    setLoading(true);
    try {
      const rows = await pos.listProducts({ search, status });
      setProducts(rows);
    } finally {
      setLoading(false);
    }
  }, [pos, search, status]);
  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);
  useEffect(() => {
    const t = window.setTimeout(() => void loadProducts(), 200);
    return () => window.clearTimeout(t);
  }, [loadProducts]);

  const openCreate = () => {
    setModalMode("create");
    setForm({
      id: "",
      name: "",
      unit: "piece",
      categoryId: "",
      sku: "",
      barcode: "",
      imagePath: "",
      saleMajor: "",
      purchaseMajor: "",
      stockUnits: "1",
      lowStockUnits: "",
      isActive: true
    });
    setModalOpen(true);
    setBanner(null);
    setBarcodeError("");
  };
  const openEdit = (p) => {
    setModalMode("edit");
    setForm({
      id: p.id,
      name: p.name,
      unit: p.unit,
      categoryId: p.categoryId ?? "",
      sku: p.sku ?? "",
      barcode: p.barcode ?? "",
      imagePath: p.imagePath ?? "",
      saleMajor: fromCents(p.salePriceCents),
      purchaseMajor: fromCents(p.purchasePriceCents),
      stockUnits: fromMilli(p.stockQtyMilli),
      lowStockUnits: p.lowStockQtyMilli != null ? fromMilli(p.lowStockQtyMilli) : "",
      isActive: p.isActive
    });
    setModalOpen(true);
    setBanner(null);
    setBarcodeError("");
  };
  const saveProduct = async () => {
    if (!pos?.saveProduct) return;
    if (form.barcode.trim()) {
      const bcOk = await validateBarcode();
      if (!bcOk) {
        setBanner({ type: "err", text: "Barcode is already assigned to another product." });
        return;
      }
    }
    const lowUnits = form.lowStockUnits.trim();
    const payload = {
      id: modalMode === "edit" ? form.id : void 0,
      name: form.name.trim(),
      unit: form.unit,
      categoryId: form.categoryId.trim() || null,
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      imagePath: form.imagePath.trim() || null,
      salePriceCents: toCents(form.saleMajor),
      purchasePriceCents: toCents(form.purchaseMajor),
      stockQtyMilli: toMilli(form.stockUnits),
      lowStockQtyMilli: lowUnits.length ? toMilli(lowUnits) : null,
      isActive: form.isActive
    };
    const res = await pos.saveProduct(payload);
    if (res.ok) {
      setBanner({ type: "ok", text: modalMode === "create" ? "Product created." : "Product updated." });
      setModalOpen(false);
      await loadProducts();
      await loadCategories();
    } else {
      setBanner({ type: "err", text: res.error });
    }
  };
  const toggleActive = async (p, next) => {
    if (!pos?.setProductActive) return;
    const res = await pos.setProductActive({ id: p.id, isActive: next });
    if (res.ok) {
      setBanner({ type: "ok", text: next ? "Product activated." : "Product deactivated." });
      await loadProducts();
    } else {
      setBanner({ type: "err", text: res.error });
    }
  };
  const addCategory = async () => {
    if (!pos?.saveCategory) return;
    const name = catName.trim();
    if (!name) return;
    const res = await pos.saveCategory({ name });
    if (res.ok) {
      setCatName("");
      setBanner({ type: "ok", text: "Category added." });
      await loadCategories();
    } else {
      setBanner({ type: "err", text: res.error });
    }
  };
  const onCategoryDeleted = async (bannerMsg) => {
    if (bannerMsg) setBanner(bannerMsg);
    await loadCategories();
    await loadProducts();
  };
  const categoryOptions = useMemo(
    () => categories.map((c) => /* @__PURE__ */ jsxs("option", { value: c.id, children: [
      c.name,
      " (",
      c.productCount,
      ")"
    ] }, c.id)),
    [categories]
  );
  return /* @__PURE__ */ jsxs("div", { className: "mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h1", { className: "text-lg font-semibold text-zinc-900 dark:text-zinc-50", children: "Products" }),
        /* @__PURE__ */ jsx("p", { className: "text-xs text-zinc-500 dark:text-zinc-400", children: "Add, edit, categories, barcode/SKU, units, stock." })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: openCreate,
          className: "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400",
          children: "Add product"
        }
      )
    ] }),
    banner ? /* @__PURE__ */ jsx(
      "div",
      {
        className: banner.type === "ok" ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100" : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100",
        children: banner.text
      }
    ) : null,
    /* @__PURE__ */ jsxs("div", { className: "grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-4", children: [
      /* @__PURE__ */ jsx(CategorySidebar, {
        categories,
        catName,
        setCatName,
        onAddCategory: addCategory,
        onDeleted: onCategoryDeleted
      }),
      /* @__PURE__ */ jsxs("section", { className: "flex min-h-0 flex-col gap-3 lg:col-span-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              value: search,
              onChange: (e) => setSearch(e.target.value),
              placeholder: "Search name, SKU, barcode, category\u2026",
              className: "min-w-[200px] flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            }
          ),
          /* @__PURE__ */ jsxs(
            "select",
            {
              value: status,
              onChange: (e) => setStatus(e.target.value),
              className: "rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100",
              children: [
                /* @__PURE__ */ jsx("option", { value: "active", children: "Active only" }),
                /* @__PURE__ */ jsx("option", { value: "inactive", children: "Inactive only" }),
                /* @__PURE__ */ jsx("option", { value: "all", children: "All" })
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => void loadProducts(),
              className: "rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600",
              children: "Refresh"
            }
          )
        ] }),
        /* @__PURE__ */ jsx("div", { className: "min-h-0 flex-1 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900", children: /* @__PURE__ */ jsxs("div", { className: "max-h-[min(560px,60vh)] overflow-auto", children: [
          loading ? /* @__PURE__ */ jsx("div", { className: "flex justify-center py-16", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" }) }) : /* @__PURE__ */ jsxs("table", { className: "w-full min-w-[800px] text-left text-sm", children: [
            /* @__PURE__ */ jsx("thead", { className: "sticky top-0 z-10 bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400", children: /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("th", { className: "px-3 py-2 font-medium", children: "Product" }),
              /* @__PURE__ */ jsx("th", { className: "px-3 py-2 font-medium", children: "Category" }),
              /* @__PURE__ */ jsx("th", { className: "px-3 py-2 font-medium", children: "Unit" }),
              /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-right font-medium", children: "Sale" }),
              /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-right font-medium", children: "Cost" }),
              /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-right font-medium", children: "Stock" }),
              /* @__PURE__ */ jsx("th", { className: "px-3 py-2 font-medium", children: "Status" }),
              /* @__PURE__ */ jsx("th", { className: "px-3 py-2 font-medium", children: "Actions" })
            ] }) }),
            /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-zinc-100 dark:divide-zinc-800", children: products.map((p) => /* @__PURE__ */ jsxs("tr", { className: "text-zinc-800 dark:text-zinc-200", children: [
              /* @__PURE__ */ jsxs("td", { className: "px-3 py-2", children: [
                /* @__PURE__ */ jsx("div", { className: "font-medium", children: p.name }),
                /* @__PURE__ */ jsx("div", { className: "text-xs text-zinc-500", children: [p.sku, p.barcode].filter(Boolean).join(" \xB7 ") || "\u2014" })
              ] }),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-zinc-600 dark:text-zinc-300", children: p.categoryName ?? "\u2014" }),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: p.unit }),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-right tabular-nums", children: formatMoney(p.salePriceCents) }),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-right tabular-nums", children: formatMoney(p.purchasePriceCents) }),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-right tabular-nums", children: formatQtyFromMilli(p.stockQtyMilli, p.unit) }),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx(
                "span",
                {
                  className: p.isActive ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" : "rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
                  children: p.isActive ? "Active" : "Inactive"
                }
              ) }),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-1", children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    className: "rounded-md border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-600",
                    onClick: () => openEdit(p),
                    children: "Edit"
                  }
                ),
                p.isActive ? /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    className: "rounded-md border border-amber-200 px-2 py-1 text-xs text-amber-900 dark:border-amber-900/50 dark:text-amber-200",
                    onClick: () => void toggleActive(p, false),
                    children: "Deactivate"
                  }
                ) : /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    className: "rounded-md border border-emerald-200 px-2 py-1 text-xs text-emerald-900 dark:border-emerald-900/50 dark:text-emerald-200",
                    onClick: () => void toggleActive(p, true),
                    children: "Activate"
                  }
                )
              ] }) })
            ] }, p.id)) })
          ] }),
          !loading && products.length === 0 ? /* @__PURE__ */ jsx("p", { className: "p-6 text-center text-sm text-zinc-500", children: "No products match this filter." }) : null
        ] }) })
      ] })
    ] }),
    modalOpen ? /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center", children: /* @__PURE__ */ jsxs(
      "div",
      {
        role: "dialog",
        "aria-modal": "true",
        className: "max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "mb-4 flex items-center justify-between gap-2", children: [
            /* @__PURE__ */ jsx("h2", { className: "text-base font-semibold text-zinc-900 dark:text-zinc-50", children: modalMode === "create" ? "New product" : "Edit product" }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: "rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                onClick: () => setModalOpen(false),
                children: "Close"
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-3 text-sm", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { className: "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400", children: "Name *" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  value: form.name,
                  onChange: (e) => setForm((f) => ({ ...f, name: e.target.value })),
                  className: "w-full rounded-md border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-2", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400", children: "Unit" }),
                /* @__PURE__ */ jsx(
                  "select",
                  {
                    value: form.unit,
                    onChange: (e) => setForm((f) => ({ ...f, unit: e.target.value })),
                    className: "w-full rounded-md border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950",
                    children: UNITS.map((u) => /* @__PURE__ */ jsx("option", { value: u, children: u }, u))
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400", children: "Category" }),
                /* @__PURE__ */ jsxs(
                  "select",
                  {
                    value: form.categoryId,
                    onChange: (e) => setForm((f) => ({ ...f, categoryId: e.target.value })),
                    className: "w-full rounded-md border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950",
                    children: [
                      /* @__PURE__ */ jsx("option", { value: "", children: "\u2014 None \u2014" }),
                      categoryOptions
                    ]
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400", children: "SKU" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    value: form.sku,
                    onChange: (e) => setForm((f) => ({ ...f, sku: e.target.value })),
                    className: "w-full rounded-md border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
                /* @__PURE__ */ jsx("label", { className: "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400", children: "Barcode (scan, camera, or type)" }),
                /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      value: form.barcode,
                      onChange: (e) => {
                        setForm((f) => ({ ...f, barcode: e.target.value }));
                        setBarcodeError("");
                      },
                      onBlur: () => {
                        void validateBarcode();
                      },
                      placeholder: "EAN / UPC / Code128 / QR text",
                      className: `min-w-0 flex-1 rounded-md border px-2 py-2 font-mono dark:bg-zinc-950 ${barcodeError ? "border-red-500 ring-1 ring-red-500/30" : "border-zinc-300 dark:border-zinc-600"}`
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: () => setCameraOpen(true),
                      className: "shrink-0 rounded-md border border-zinc-300 px-2 py-2 text-xs font-medium dark:border-zinc-600",
                      children: "Camera scan"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: () => {
                        setForm((f) => ({ ...f, barcode: suggestRetailBarcode() }));
                        setBarcodeError("");
                      },
                      className: "shrink-0 rounded-md border border-zinc-300 px-2 py-2 text-xs font-medium dark:border-zinc-600",
                      title: "Generate internal retail-style barcode (13 digits)",
                      children: "Generate"
                    }
                  )
                ] }),
                barcodeError ? /* @__PURE__ */ jsx("p", { className: "text-xs text-red-600 dark:text-red-400", children: barcodeError }) : /* @__PURE__ */ jsx("p", { className: "text-[11px] text-zinc-500 dark:text-zinc-400", children: "Must be unique. USB scanner types here; use Camera on phones without a wedge scanner." })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { className: "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400", children: "Image path (optional)" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  value: form.imagePath,
                  onChange: (e) => setForm((f) => ({ ...f, imagePath: e.target.value })),
                  placeholder: "Local file path for later thermal/PDF branding",
                  className: "w-full rounded-md border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-2", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400", children: "Sale price" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    inputMode: "decimal",
                    value: form.saleMajor,
                    onChange: (e) => setForm((f) => ({ ...f, saleMajor: e.target.value })),
                    placeholder: "0.00",
                    className: "w-full rounded-md border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400", children: "Purchase / cost" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    inputMode: "decimal",
                    value: form.purchaseMajor,
                    onChange: (e) => setForm((f) => ({ ...f, purchaseMajor: e.target.value })),
                    placeholder: "0.00",
                    className: "w-full rounded-md border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-2", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400", children: "Stock (qty)" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    inputMode: "decimal",
                    value: form.stockUnits,
                    onChange: (e) => setForm((f) => ({ ...f, stockUnits: e.target.value })),
                    className: "w-full rounded-md border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400", children: "Low stock alert (qty)" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    inputMode: "decimal",
                    value: form.lowStockUnits,
                    onChange: (e) => setForm((f) => ({ ...f, lowStockUnits: e.target.value })),
                    placeholder: "Optional",
                    className: "w-full rounded-md border border-zinc-300 px-2 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2 text-zinc-700 dark:text-zinc-300", children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "checkbox",
                  checked: form.isActive,
                  onChange: (e) => setForm((f) => ({ ...f, isActive: e.target.checked }))
                }
              ),
              "Active (shown in POS search)"
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-5 flex justify-end gap-2", children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: "rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600",
                onClick: () => setModalOpen(false),
                children: "Cancel"
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => void saveProduct(),
                className: "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500",
                children: "Save"
              }
            )
          ] })
        ]
      }
    ) }) : null,
    /* @__PURE__ */ jsx(BarcodeCameraModal, {
      open: cameraOpen,
      onClose: () => setCameraOpen(false),
      onDecoded: (text) => {
        const t = text.trim();
        setForm((f) => ({ ...f, barcode: t }));
        setCameraOpen(false);
        void validateBarcode(t);
      }
    })
  ] });
}
export {
  ProductsPage
};
