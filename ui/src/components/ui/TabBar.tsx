import React from 'react';

export interface TabItem<K extends string = string> {
  key: K;
  label: React.ReactNode;
  disabled?: boolean;
}

interface TabBarProps<K extends string = string> {
  tabs: TabItem<K>[];
  active: K;
  onChange: (key: K) => void;
  className?: string;
}

/** Underline tab strip — the tab rows in the editor and customize screens.
 * One seam so "what tabs look like" can't drift again. */
function TabBar<K extends string>({ tabs, active, onChange, className = '' }: TabBarProps<K>) {
  return (
    <div role="tablist" className={`flex gap-1 border-b border-ink-faint/30 ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={`px-4 py-2 text-[14px] font-semibold border-b-2 -mb-px transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            active === t.key
              ? 'border-gold text-ink'
              : 'border-transparent text-ink-soft hover:text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default TabBar;
