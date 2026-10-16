import React, { useEffect, useState } from 'react';
import { Input } from './ui/input';

const DATE_TEXT_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const MIN_VALID_YEAR = 1900;
const MONTHS_IN_YEAR = 12;
const MAX_DAY_OF_MONTH = 31;

function formatDate(date: Date | undefined): string {
  if (!date) return '';
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${date.getFullYear()}`;
}

function parseDate(text: string): Date | null {
  const match = text.trim().match(DATE_TEXT_PATTERN);
  if (!match) return null;
  const [month, day, year] = match.slice(1).map(Number);
  if (month < 1 || month > MONTHS_IN_YEAR || day < 1 || day > MAX_DAY_OF_MONTH || year < MIN_VALID_YEAR) return null;
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 ? date : null;
}

interface DateTextInputProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  onFocus?: () => void;
  placeholder: string;
  className?: string;
  ariaLabel: string;
}

/** MM/DD/YYYY field that keeps partial typing locally and commits once the text is a real date. */
export function DateTextInput({ value, onChange, onFocus, placeholder, className, ariaLabel }: DateTextInputProps) {
  const [text, setText] = useState(() => formatDate(value));

  useEffect(() => {
    setText(formatDate(value));
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onFocus={onFocus}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        if (next.trim() === '') {
          onChange(undefined);
          return;
        }
        const parsed = parseDate(next);
        if (parsed) onChange(parsed);
      }}
      onBlur={() => {
        if (text.trim() && !parseDate(text)) setText(formatDate(value));
      }}
      className={className}
    />
  );
}
