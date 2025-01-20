import React, { useState } from 'react';
import './App.css';

const App = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('Title'); // State for filter
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query.');
      setResults([]);
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Log the URL for the request
      const url = `http://localhost:5000/search?query=${encodeURIComponent(searchQuery)}&filter=${encodeURIComponent(filter)}`;
      console.log('Search query URL:', url);

      // Make the fetch request to the backend
      const response = await fetch(url);
      const data = await response.json();

      console.log('Data received from backend:', data);  // Log the received data

      if (response.ok && Array.isArray(data.results)) {
        setResults(data.results);
      } else {
        setError('No results found.');
        setResults([]);
      }
    } catch (err) {
      console.error('Error fetching search results:', err);
      setError('An error occurred while fetching search results.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const removeExtension = (filename) => filename.replace(/\.[^/.]+$/, '');

  const highlightText = (text, query) => {
    if (!query) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    return text.split(regex).map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={index} className="highlight">{part}</span>
      ) : (
        part
      )
    );
  };

  return (
    <div className="search-app">
      <h1>Document Search</h1>

      <div className="search-bar">
        {/* Dropdown for filter selection */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="filter-dropdown"
        >
          <option value="Title">Title</option>
          <option value="Keywords">Keywords</option>
          <option value="Advanced Search">Advanced Search</option>
        </select>

        {/* Search input */}
        <input
          type="text"
          placeholder="Enter your search query..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <button onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="results">
        {results.length > 0 && <h2>Search Results:</h2>}
        {results.length === 0 && !loading && !error && <p>No results found.</p>}
        {results.map((result) => (
          <div key={result._id} className="result-item">
            <div>
              <strong>
                <a href={result._source.path} target="_blank" rel="noopener noreferrer">
                  {highlightText(removeExtension(result._source.name), searchQuery)}
                </a>
              </strong>
            </div>
            <p><strong>Summary:</strong> <span dangerouslySetInnerHTML={{ __html: result._source.summary }} /></p>
            <p><strong>Type:</strong> {result._source.type}</p>
            <p><strong>Date Modified:</strong> {new Date(result._source.date_modified).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
