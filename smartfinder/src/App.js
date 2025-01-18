import React, { useState } from 'react';
import './App.css';

const App = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    // Validate the input
    if (!searchQuery.trim()) {
      setError('Please enter a search query.');
      setResults([]);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`http://localhost:5000/search?query=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      console.log('API Response:', data);

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

  // Helper function to remove file extensions
  const removeExtension = (filename) => filename.replace(/\.[^/.]+$/, '');

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
                  {removeExtension(result._source.name)}
                </a>
              </strong>
            </div>
            <p><strong>Summary:</strong> {result._source.summary}</p>
            <p><strong>Type:</strong> {result._source.type}</p>
            <p><strong>Date Modified:</strong> {new Date(result._source.date_modified).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
