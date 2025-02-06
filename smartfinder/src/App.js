import React, { useState } from 'react';
import './App.css';

const App = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('Title');
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query.');
      setResults([]);
      setTotalResults(0);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const url = `http://localhost:5000/search?query=${encodeURIComponent(searchQuery)}&filter=${encodeURIComponent(filter)}`;
      console.log('Search query URL:', url);

      const response = await fetch(url);
      const data = await response.json();

      console.log('Data received from backend:', data);

      if (response.ok && Array.isArray(data.results)) {
        setResults(data.results);
        setTotalResults(data.total || 0);
      } else {
        setError('No results found.');
        setResults([]);
        setTotalResults(0);
      }
    } catch (err) {
      console.error('Error fetching search results:', err);
      setError('An error occurred while fetching search results.');
      setResults([]);
      setTotalResults(0);
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

  const handleFileClick = (filePath) => {
    // Convert Windows path to a URL-safe format
    const fileUrl = `http://localhost:5000/serve-file?path=${encodeURIComponent(filePath)}`;
  
    console.log("Opening file:", fileUrl);  
  
    window.open(fileUrl, '_blank');  
  };
  
  
  return (
    <div className="search-app">
      <h1>Document Search</h1>

      <div className="search-bar">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="filter-dropdown"
        >
          <option value="Title">Title</option>
          <option value="Keywords">Keywords</option>
          <option value="Advanced Search">Advanced Search</option>
        </select>

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
        {results.length > 0 && (
          <>
            <h2>Search Results:</h2>
            <p>
              Showing {results.length} of {totalResults} documents
            </p>
          </>
        )}
        {results.length === 0 && !loading && !error && <p>No results found.</p>}

        {results.map((result) => (
          <div key={result._id} className="result-item">
            <div>
              <strong>
                <button
                  className="file-link"
                  onClick={() => handleFileClick(result._source.path)} // Trigger the file open on click
                >
                  {highlightText(removeExtension(result._source.name), searchQuery)}
                </button>
              </strong>
            </div>
            <p><strong>Summary:</strong> <span dangerouslySetInnerHTML={{ __html: result._source.summary }} /></p>
            <p><strong>Type:</strong> {result._source.type}</p>
            <p><strong>Date Modified:</strong> {new Date(result._source.dateModified).toLocaleString()}</p>

            {/* View Details Button */}
            <button
              onClick={() => handleFileClick(result._source.path)} // Trigger file open via the new backend route
              className="view-details-button"
            >
              View Details
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
