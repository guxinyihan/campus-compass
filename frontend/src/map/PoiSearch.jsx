import { useId, useState } from 'react';
import PropTypes from 'prop-types';
import { searchPois } from '../domain/search';

export default function PoiSearch({ label, pois, value, onSelect, disabled = false }) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(-1);
  const results = searchPois(pois, query);
  const select = (poi) => { onSelect(poi); setQuery(''); setOpen(false); setIndex(-1); };
  return <div className="poi-search"><label htmlFor={id}>{label}</label>
    <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open && results.length > 0} aria-controls={`${id}-list`} aria-activedescendant={open && index >= 0 ? `${id}-${index}` : undefined}
      placeholder="Search campus places" value={open ? query : value?.name || query} disabled={disabled} autoComplete="off"
      onFocus={() => { setOpen(true); setQuery(''); }}
      onBlur={() => { setOpen(false); setIndex(-1); }}
      onChange={(event) => { setQuery(event.target.value); setOpen(true); setIndex(-1); onSelect(null); }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' && results.length) { event.preventDefault(); setIndex((i) => (i + 1) % results.length); }
        if (event.key === 'ArrowUp' && results.length) { event.preventDefault(); setIndex((i) => (i - 1 + results.length) % results.length); }
        if (event.key === 'Enter' && open && index >= 0) { event.preventDefault(); select(results[index]); }
        if (event.key === 'Escape') { setOpen(false); setIndex(-1); }
        if (event.key === 'Tab') setOpen(false);
      }} />
    {open && query && <ul id={`${id}-list`} role="listbox" className="suggestions">
      {results.map((poi, i) => <li id={`${id}-${i}`} key={poi.id} role="option" aria-selected={i === index}><button type="button" tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={() => select(poi)}>{poi.name}<small>{poi.category}</small></button></li>)}
      {!results.length && <li className="muted">No matching campus places.</li>}
    </ul>}
  </div>;
}
PoiSearch.propTypes = { label: PropTypes.string.isRequired, pois: PropTypes.array.isRequired, value: PropTypes.object, onSelect: PropTypes.func.isRequired, disabled: PropTypes.bool };
