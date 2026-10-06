"use client";
import { useEffect, useId, useState } from "react";
import { englishNameUI, filterEnglishNameInput, isEnglishName, normalizeEnglishName } from "@/lib/english-name";

/** Accept Roman letters directly, with no transliteration requests or suggestions. */
export default function EnglishNameField({ language, value, onChange, onReadyChange, name = "name" }: {
  language: string; value: string; onChange: (value: string) => void;
  onReadyChange: (ready: boolean) => void; name?: string;
}) {
  const t = englishNameUI(language);
  const id = useId();
  const [confirmedValue, setConfirmedValue] = useState<string | null>(null);
  const valid = isEnglishName(value);
  const ready = valid && confirmedValue === value;
  useEffect(() => { onReadyChange(ready); }, [ready, onReadyChange]);
  const change = (input: HTMLInputElement) => {
    const next = filterEnglishNameInput(input.value);
    // Clear rejected characters even when React's controlled value has not changed.
    input.value = next;
    if (next === value) return;
    setConfirmedValue(null); onReadyChange(false); onChange(next);
  };
  return <div className="space-y-2 text-sm text-slate-700">
    <label htmlFor={id} className="block font-bold">{t.label} *</label>
    <input id={id} name={name} value={value} onChange={e => change(e.currentTarget)}
      onCompositionEnd={e => change(e.currentTarget)}
      required maxLength={80} autoComplete="name" autoCapitalize="words" spellCheck={false}
      inputMode="text" lang="en" aria-describedby={`${id}-help`} aria-invalid={!!value && !valid} dir="ltr"
      className="w-full rounded-xl border border-slate-400 bg-slate-50 px-4 py-3 text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" />
    <p id={`${id}-help`} className="text-xs leading-relaxed">{t.help}</p>
    <label className="flex items-start gap-2">
      <input type="checkbox" checked={ready} disabled={!valid} className="mt-1 h-4 w-4"
        onChange={e => { const next = normalizeEnglishName(value); onChange(next); setConfirmedValue(e.target.checked ? next : null); onReadyChange(e.target.checked && isEnglishName(next)); }} />
      <span>{t.confirm}</span>
    </label>
  </div>;
}
