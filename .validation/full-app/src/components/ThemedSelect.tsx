// A fully custom-styled dropdown that replaces the native <select> wherever
// its OPEN option list needs to match the app's dark/cyan theme exactly.
// Native <select> popups are browser-owned: Chrome/Edge ignore CSS on the
// currently selected/highlighted row (only Firefox honors option:checked/
// :hover styling), so the base list can be themed via CSS but the selected
// row always flashes the OS accent color there. This component avoids that
// entirely — the "popup" is just our own absolutely positioned <ul>, so
// every row (including the selected one) is fully within our CSS.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import './ThemedSelect.css';

export interface ThemedSelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

interface ThemedSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: ThemedSelectOption[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    style?: CSSProperties;
    ariaLabel?: string;
}

export default function ThemedSelect({ value, onChange, options, placeholder, disabled, className, style, ariaLabel }: ThemedSelectProps) {
    const [open, setOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const rootRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const selectedIndex = options.findIndex((o) => o.value === value);
    const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

    useEffect(() => {
        if (!open) return;
        const handleClick = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    useEffect(() => {
        if (open) setHighlightIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!open) return;
        listRef.current?.querySelector('[data-highlighted="true"]')?.scrollIntoView({ block: 'nearest' });
    }, [open, highlightIndex]);

    const selectOption = (index: number) => {
        const opt = options[index];
        if (!opt || opt.disabled) return;
        onChange(opt.value);
        setOpen(false);
    };

    const moveHighlight = (delta: number) => {
        setHighlightIndex((i) => {
            let next = i;
            for (let step = 0; step < options.length; step++) {
                next = (next + delta + options.length) % options.length;
                if (!options[next]?.disabled) return next;
            }
            return i;
        });
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
        if (disabled) return;
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (!open) setOpen(true); else moveHighlight(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (!open) setOpen(true); else moveHighlight(-1);
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (!open) setOpen(true); else selectOption(highlightIndex);
                break;
            case 'Escape':
                setOpen(false);
                break;
            case 'Tab':
                setOpen(false);
                break;
        }
    };

    return (
        <div className={['themed-select', open ? 'themed-select--open' : '', className || ''].filter(Boolean).join(' ')} style={style} ref={rootRef}>
            <button
                type="button"
                className="themed-select-trigger"
                onClick={() => !disabled && setOpen((o) => !o)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={ariaLabel}
            >
                <span className="themed-select-value">{selected ? selected.label : (placeholder || 'Select…')}</span>
                <ChevronDown size={15} />
            </button>
            {open && (
                <ul className="themed-select-list" role="listbox" ref={listRef}>
                    {options.length === 0 ? (
                        <li className="themed-select-empty">No options</li>
                    ) : options.map((opt, i) => (
                        <li
                            key={opt.value}
                            role="option"
                            aria-selected={opt.value === value}
                            data-highlighted={i === highlightIndex}
                            className={[
                                'themed-select-option',
                                opt.value === value ? 'themed-select-option--selected' : '',
                                i === highlightIndex ? 'themed-select-option--highlighted' : '',
                                opt.disabled ? 'themed-select-option--disabled' : '',
                            ].filter(Boolean).join(' ')}
                            onMouseEnter={() => setHighlightIndex(i)}
                            onClick={() => selectOption(i)}
                        >
                            {opt.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
