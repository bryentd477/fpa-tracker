import React, { useState } from 'react';

function SearchBar({ onSearch }) {
  const [query, setQuery] = useState('');

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    onSearch(value);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <div className="search-bar">
      <input
        type="text"
        placeholder="Search FPAs by number, landowner, or timber sale..."
        value={query}
        onChange={handleChange}
        className="search-input"
      />
      {query && (
        <button onClick={handleClear} className="search-clear">
          ✕
        </button>
      )}
      <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.35-4.35"></path>
      </svg>
    </div>
  );
}

export default SearchBar;
