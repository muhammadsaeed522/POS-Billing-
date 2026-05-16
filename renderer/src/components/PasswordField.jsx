import { useId, useState } from "react";

export function PasswordField({
  label,
  value,
  onChange,
  disabled,
  autoComplete,
  placeholder,
  id: idProp
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [show, setShow] = useState(false);

  return (
    <div>
      {label ? (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          disabled={disabled}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-3 pr-10 text-sm outline-none ring-emerald-500/30 transition focus:border-emerald-500 focus:ring-2 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-0.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
