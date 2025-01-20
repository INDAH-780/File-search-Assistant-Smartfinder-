import React, { useState } from 'react';
import './App.css';

const App = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('Title');
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [totalResults, setTotalResults] = useState(0); // State for total results
  const [loading, setLoading] = useState(false);
  const [modalFilePath, setModalFilePath] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query.');
      setResults([]);
      setTotalResults(0); // Reset total results
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
        setTotalResults(data.total || 0); // Set the total results
      } else {
        setError('No results found.');
        setResults([]);
        setTotalResults(0); // Reset total results
      }
    } catch (err) {
      console.error('Error fetching search results:', err);
      setError('An error occurred while fetching search results.');
      setResults([]);
      setTotalResults(0); // Reset total results
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
    setModalFilePath(filePath);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalFilePath('');
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
                  onClick={() => handleFileClick(result._source.path)}
                >
                  {highlightText(removeExtension(result._source.name), searchQuery)}
                </button>
              </strong>
            </div>
            <p><strong>Summary:</strong> <span dangerouslySetInnerHTML={{ __html: result._source.summary }} /></p>
            <p><strong>Type:</strong> {result._source.type}</p>
            <p><strong>Date Modified:</strong> {new Date(result._source.dateModified).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>File Location</h3>
            <p>The file is located at:</p>
            <p className="file-path">{modalFilePath}</p>
            <button className="close-button" onClick={closeModal}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
