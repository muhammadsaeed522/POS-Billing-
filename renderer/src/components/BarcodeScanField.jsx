import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

/**
 * Keyboard-wedge / USB scanner input: scanners type digits quickly and usually send Enter.
 * Optional idle auto-commit helps scanners that omit Enter (configurable).
 *
 * @param {object} props
 * @param {(raw: string) => void} props.onScan — trimmed code; parent clears / refocuses
 * @param {boolean} [props.disabled]
 * @param {string} [props.id]
 * @param {string} [props.placeholder]
 * @param {string} [props.className]
 * @param {number} [props.autoIdleMs=0] — if > 0, commit after this quiet period (ms) when length >= minAutoLen
 * @param {number} [props.minAutoLen=6] — minimum chars for idle auto-commit
 */
export const BarcodeScanField = forwardRef(function BarcodeScanField(
  { onScan, disabled, id, placeholder, className, autoIdleMs = 72, minAutoLen = 6 },
  ref
) {
  const inputRef = useRef(null);
  const idleTimerRef = useRef(0);

  useImperativeHandle(ref, () => inputRef.current, []);

  const commit = useCallback(() => {
    const el = inputRef.current;
    if (!el || disabled) return;
    const raw = el.value.trim();
    if (!raw) return;
    el.value = "";
    onScan(raw);
  }, [disabled, onScan]);

  const resetIdle = useCallback(() => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    if (!autoIdleMs || disabled) return;
    idleTimerRef.current = window.setTimeout(() => {
      const el = inputRef.current;
      const v = el?.value?.trim() ?? "";
      if (v.length >= minAutoLen) commit();
    }, autoIdleMs);
  }, [autoIdleMs, commit, disabled, minAutoLen]);

  useEffect(() => () => window.clearTimeout(idleTimerRef.current), []);

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
        commit();
        return;
      }
      resetIdle();
    },
    [commit, resetIdle]
  );

  const onPaste = useCallback(
    (e) => {
      const text = e.clipboardData?.getData("text") ?? "";
      const line = text.split(/\r?\n/)[0]?.trim();
      if (line && line.length >= 1) {
        e.preventDefault();
        if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
        inputRef.current.value = "";
        onScan(line);
      }
    },
    [onScan]
  );

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="text"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      aria-label="Barcode scanner input"
    />
  );
});
