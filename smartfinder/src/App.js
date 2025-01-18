// App.jsx

import React, { useState } from 'react';
import './App.css';

const App = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = () => {
    // Dummy search for structure visualization
    if (!searchQuery.trim()) {
      setError('Please enter a search query.');
      setResults([]);
      return;
    }

    setError('');
    const dummyResults = [
      { id: '1', summary: 'This is the first document summary.' },
      { id: '2', summary: 'This is the second document summary.' },
      { id: '3', summary: 'This is the third document summary.' },
    ];
    setResults(dummyResults);
  };

  return (
    <div className="search-app">
      <h1>Document Search</h1>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Enter your search query..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button onClick={handleSearch}>Search</button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="results">
        {results.length > 0 && <h2>Search Results:</h2>}
        {results.map((result) => (
          <div key={result.id} className="result-item">
            <strong>{result.summary}</strong>
            <p>ID: {result.id}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;

