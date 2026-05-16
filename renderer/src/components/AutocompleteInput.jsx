import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Score how well `label` matches query (lower = better). Used for local `options` filtering.
 */
function matchScore(label, query) {
  const l = label.toLowerCase();
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  if (l === q) return 0;
  if (l.startsWith(q)) return 1;
  const idx = l.indexOf(q);
  if (idx >= 0) return 10 + idx;
  return Infinity;
}

/**
 * Filter & rank local string options for large lists (slice to maxItems after sort).
 */
function filterLocalOptions(options, query, maxItems) {
  const q = query.trim();
  if (!q) return [];
  const ranked = options
    .map((label) => ({ label, score: matchScore(label, q) }))
    .filter((x) => x.score < Infinity)
    .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label))
    .map((x) => x.label);
  return ranked.slice(0, maxItems);
}

const ListRow = memo(function ListRow({ id, active, children, onMouseDown, onMouseEnter }) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      className={
        active
          ? "cursor-pointer bg-emerald-50 px-3 py-2.5 text-sm text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-50"
          : "cursor-pointer px-3 py-2.5 text-sm text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800/80"
      }
    >
      {children}
    </li>
  );
});

/**
 * Reusable autocomplete: debounced suggestions, keyboard + mouse, click-outside to close.
 *
 * Two data sources (use one):
 * - `searchFn`: async (query, signal) => items[] — debounced; good for IPC / APIs / huge sets
 * - `options`: string[] — client-side intelligent filter on debounced query
 *
 * @param {object} props
 * @param {string} props.value - controlled input value
 * @param {(v: string) => void} props.onChange
 * @param {(item: unknown, meta: { label: string }) => void} props.onSelect - fired when user picks a suggestion
 * @param {(q: string, signal: AbortSignal) => Promise<unknown[]>} [props.searchFn]
 * @param {string[]} [props.options] - static strings; mutually exclusive with searchFn for typical use
 * @param {(item: unknown) => string} [props.getLabel] - required if items are not plain strings
 * @param {(item: unknown) => string|number} [props.getKey] - stable key for list
 * @param {(item: unknown) => import('react').ReactNode} [props.renderSuggestion] - optional custom row
 * @param {number} [props.debounceMs=200]
 * @param {number} [props.maxSuggestions=80]
 * @param {string} [props.placeholder]
 * @param {string} [props.className] - input classes
 * @param {string} [props.id]
 * @param {boolean} [props.disabled]
 * @param {(trimmedQuery: string) => void | Promise<void>} [props.onEnterFallback] — when Enter is pressed and no list item was committed (e.g. empty suggestions / fast barcode before debounce), try barcode or other lookup
 */
/** Example static dataset for demos / tests (Pepsi, Fanta, …). */
export const SAMPLE_BEVERAGE_OPTIONS = [
  "Pepsi",
  "Coca Cola",
  "Sprite",
  "Fanta",
  "7up",
  "Mountain Dew",
];

export const AutocompleteInput = forwardRef(function AutocompleteInput(
  {
    value,
    onChange,
    onSelect,
    searchFn,
    options,
    getLabel = (item) => (typeof item === "string" ? item : String(item)),
    getKey = (item, index) =>
      typeof item === "string" ? item : (item?.id ?? item?.key ?? index),
    renderSuggestion,
    debounceMs = 200,
    maxSuggestions = 80,
    placeholder = "",
    className = "",
    id: idProp,
    disabled = false,
    onEnterFallback,
  },
  ref
) {
  const genId = useId();
  const listboxId = `${genId}-listbox`;
  const inputId = idProp ?? `${genId}-input`;

  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState(value);
  const [asyncItems, setAsyncItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const rootRef = useRef(null);
  const inputRef = useRef(null);

  // Expose <input> focus to parent (e.g. F1 shortcut)
  useLayoutEffect(() => {
    if (!ref) return;
    if (typeof ref === "function") {
      ref(inputRef.current);
      return;
    }
    ref.current = inputRef.current;
  }, [ref]);

  // Debounce the query driving suggestions (reduces work for large / remote datasets)
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(value), debounceMs);
    return () => window.clearTimeout(t);
  }, [value, debounceMs]);

  // Abortable async fetch when using searchFn
  useEffect(() => {
    if (!searchFn) return;
    const q = debouncedQuery.trim();
    if (!q) {
      setAsyncItems([]);
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const rows = await searchFn(debouncedQuery, ac.signal);
        if (!alive || ac.signal.aborted) return;
        setAsyncItems(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (ac.signal.aborted) return;
        console.error("Autocomplete searchFn:", e);
        setAsyncItems([]);
      } finally {
        if (alive && !ac.signal.aborted) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      ac.abort();
    };
  }, [debouncedQuery, searchFn]);

  // Local options mode: derive suggestions from debounced query without extra state churn
  const localSuggestions = useMemo(() => {
    if (!options || searchFn) return [];
    return filterLocalOptions(options, debouncedQuery, maxSuggestions).map((label) => ({
      raw: label,
      label,
      key: label,
    }));
  }, [options, searchFn, debouncedQuery, maxSuggestions]);

  const suggestions = useMemo(() => {
    if (searchFn) {
      return asyncItems.map((item, index) => ({
        raw: item,
        label: getLabel(item),
        key: getKey(item, index),
      }));
    }
    return localSuggestions;
  }, [searchFn, asyncItems, getLabel, getKey, localSuggestions]);

  const trimmed = value.trim();
  const showList = open && trimmed.length > 0 && (suggestions.length > 0 || loading);

  // Reset highlight when the suggestion set changes
  useEffect(() => {
    setHighlight(0);
  }, [suggestions.length, debouncedQuery, loading]);

  // Close when input cleared
  useEffect(() => {
    if (!value.trim()) setOpen(false);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function onDocMouseDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const pickIndex = useCallback(
    (index) => {
      const row = suggestions[index];
      if (!row) return;
      onSelect(row.raw, { label: row.label });
      setOpen(false);
    },
    [suggestions, onSelect]
  );

  const commitEnter = useCallback(async () => {
    const qRaw = value.trim();
    if (!qRaw) {
      setOpen(false);
      return;
    }
    const q = qRaw.toLowerCase();
    if (suggestions.length === 1) {
      pickIndex(0);
      return;
    }
    const exactIdx = suggestions.findIndex((s) => s.label.toLowerCase() === q);
    if (exactIdx >= 0) {
      pickIndex(exactIdx);
      return;
    }
    if (suggestions.length > 0) {
      pickIndex(Math.min(highlight, suggestions.length - 1));
      return;
    }
    if (onEnterFallback) await onEnterFallback(qRaw);
  }, [value, suggestions, highlight, pickIndex, onEnterFallback]);

  const onKeyDown = useCallback(
    (e) => {
      if (!trimmed) {
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setHighlight((h) => Math.min(h + 1, Math.max(0, suggestions.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        void commitEnter();
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    },
    [trimmed, suggestions.length, commitEnter]
  );

  const onInputChange = useCallback(
    (e) => {
      onChange(e.target.value);
      setOpen(true);
    },
    [onChange]
  );

  const onInputFocus = useCallback(() => {
    if (value.trim()) setOpen(true);
  }, [value]);

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listboxId}-opt-${highlight}` : undefined}
        disabled={disabled}
        value={value}
        onChange={onInputChange}
        onFocus={onInputFocus}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={className}
      />
      {showList ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-[min(320px,50vh)] w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {loading ? (
            <li className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">Loading…</li>
          ) : null}
          {!loading && suggestions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">No matches.</li>
          ) : null}
          {suggestions.map((row, i) => (
            <ListRow
              key={row.key}
              active={i === highlight}
              id={`${listboxId}-opt-${i}`}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pickIndex(i);
              }}
            >
              {renderSuggestion ? (
                renderSuggestion(row.raw, { active: i === highlight, label: row.label })
              ) : (
                <span className="font-medium">{row.label}</span>
              )}
            </ListRow>
          ))}
        </ul>
      ) : null}
    </div>
  );
});
