import React, { useState, useEffect } from "react";
import axios from "axios";

// Get a flag for a language.
const getNationalFlagForLanguage = (language) => {
  switch (language) {
    case "se":
      return "🇸🇪";
    case "en":
      return "🇬🇧";
    default:
      // return unknown flag
      return "🏴";
  }
};

// Display a single movie.
const MovieItem = (item) => {
  return (
    <div className="movie-item" key={item.index}>
      <h5 className="movie-title">
        {item.title}
        &nbsp;
        {getNationalFlagForLanguage(item.subtitle)}
      </h5>
      <p className="movie-details">
        {item["media-location"]} [{item["media-type"]}/{item["media-format"]}]
        &nbsp;
        {item.category.length > 0 && (
          <> (kategori: {item.category.join(", ")}) </>
        )}
      </p>
    </div>
  );
};

// Display a list of movies.
const MovieList = (props) => {
  return props.filteredData.map((item) => <MovieItem {...item} />);
};

const App = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [filter, setFilter] = useState("");
  const [selectedTag, setSelectedTag] = useState("");

  // Load movie data once when started.
  useEffect(() => {
    axios.get("data.json").then((res) => {
      res.data.sort(function (a, b) {
        var titleA = a.title.toUpperCase();
        var titleB = b.title.toUpperCase();
        if (titleA < titleB) {
          return -1;
        }
        if (titleA > titleB) {
          return 1;
        }

        // titles must be equal
        return 0;
      });
      res.data.forEach((obj, index) => {
        obj.index = index;
      });
      setData(res.data);
      setFilteredData(res.data);
    });
  }, []);

  // Update filtered data when data, filter or selected tag changes.
  useEffect(() => {
    setFilteredData(
      data.filter(
        (item) =>
          item.title.toLowerCase().includes(filter.toLowerCase()) &&
          (!selectedTag || item.category.includes(selectedTag))
      )
    );
  }, [filter, selectedTag, data]);

  return (
    <div>
      <input
        type="text"
        placeholder="Filter by title"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <select
        value={selectedTag}
        onChange={(e) => setSelectedTag(e.target.value)}
      >
        <option value="">All</option>
        {[
          ...new Set(
            data.reduce((allTags, item) => [...allTags, ...item.category], [])
          ),
        ].map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>
      <MovieList filteredData={filteredData} />
    </div>
  );
};

export { App };
