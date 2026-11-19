import { NavLink } from 'react-router-dom';

/** In-page tabs (buttons). */
export function Tabs<K extends string>({ tabs, value, onChange, label }: { tabs: [K, string][]; value: K; onChange: (k: K) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="tabs">
      {tabs.map(([k, text]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} className="tab" onClick={() => onChange(k)}>
          {text}
        </button>
      ))}
    </div>
  );
}

/** Route tabs (links). */
export function NavTabs({ links, label }: { links: [string, string, boolean?][]; label: string }) {
  return (
    <nav aria-label={label} className="tabs">
      {links.map(([to, text, end]) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab ${isActive ? 'tab-active' : ''}`}>
          {text}
        </NavLink>
      ))}
    </nav>
  );
}
