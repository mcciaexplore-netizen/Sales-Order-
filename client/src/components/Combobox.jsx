import { useEffect, useMemo, useRef, useState } from 'react';

export default function Combobox({
  options,
  value,
  onChange,
  getLabel,
  getValue,
  getSearchText,
  placeholder = 'Search...',
  emptyText = 'No matches',
  isDisabled,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const ref = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => getValue(o) === value);
  const selectedLabel = selected ? getLabel(selected) : '';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const text = getSearchText ? getSearchText(o) : getLabel(o);
      return text.toLowerCase().includes(q);
    });
  }, [options, query, getLabel, getSearchText]);

  useEffect(() => {
    setHighlighted(0);
  }, [query, open]);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const select = (option) => {
    if (isDisabled?.(option)) return;
    onChange(getValue(option));
    setOpen(false);
    setQuery('');
  };

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && open && filtered[highlighted]) {
      e.preventDefault();
      select(filtered[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        className="input pr-8"
        placeholder={placeholder}
        value={open ? query : selectedLabel}
        onFocus={() => { if (!disabled) { setOpen(true); setQuery(''); } }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={handleKey}
        disabled={disabled}
        autoComplete="off"
      />
      {selected && !open && !disabled && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(''); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
          aria-label="Clear"
        >
          &times;
        </button>
      )}
      {open && (
        <div
          ref={listRef}
          className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-64 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">{emptyText}</div>
          ) : (
            filtered.map((opt, idx) => {
              const optValue = getValue(opt);
              const optDisabled = isDisabled?.(opt);
              const isSelected = optValue === value;
              return (
                <button
                  key={optValue}
                  type="button"
                  disabled={optDisabled}
                  onMouseEnter={() => setHighlighted(idx)}
                  onClick={() => select(opt)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    optDisabled
                      ? 'text-slate-400 cursor-not-allowed'
                      : highlighted === idx
                      ? 'bg-brand-50 text-brand-700'
                      : isSelected
                      ? 'bg-brand-50/50 text-brand-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {getLabel(opt)}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
