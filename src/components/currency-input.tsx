"use client";

import { useEffect, useState } from "react";

export function centsToDisplay(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function toCents(value: number | string) {
  return Math.round((Number(value) || 0) * 100);
}

export function centsFromRawInput(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(-15);
  return digits ? Number(digits) : 0;
}

interface CurrencyInputProps {
  id?: string;
  value: number | string;
  onChange: (value: number) => void;
  style?: React.CSSProperties;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}

export function CurrencyInput({
  id,
  value,
  onChange,
  style,
  disabled,
  autoFocus,
  placeholder,
}: CurrencyInputProps) {
  const [cents, setCents] = useState(() => toCents(value));

  useEffect(() => {
    const next = toCents(value);
    setCents((prev) => (prev === next ? prev : next));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextCents = centsFromRawInput(e.target.value);
    setCents(nextCents);
    onChange(nextCents / 100);
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      style={style}
      value={centsToDisplay(cents)}
      onChange={handleChange}
      disabled={disabled}
      // biome-ignore lint/a11y/noAutofocus: autofoco intencional, controlado pelo chamador
      autoFocus={autoFocus}
      placeholder={placeholder}
    />
  );
}
