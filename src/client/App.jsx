import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

function LanguageBadge(props) {
  return (
    <div className="swedish-flag">
      <span className="cross">{props.badge}</span>
      <span className="flag">{props.flag}</span>
    </div>
  );
}

const badge = (target, audio, subtitle) => {
  if (audio === target || subtitle === target) return "";
  if (audio !== target && subtitle === "?") return "?";
  if (audio === "?" && subtitle !== target) return "?";
  // Here we know that audio and subtitle are not target and not "?"
  if (audio !== target && subtitle !== target) return "X";
};

const LanguageBadges = (props) => {
  return (
    <>
      <LanguageBadge
        flag="🇸🇪"
        badge={badge("se", props.audio, props.subtitle)}
      />
      <LanguageBadge
        flag="🇬🇧"
        badge={badge("en", props.audio, props.subtitle)}
      />
    </>
  );
};

const locationGroups = {
  server: { icon: "🖥️", label: "Server" },
  shelf: { icon: "📚", label: "Hylla" },
  box: { icon: "📦", label: "Låda" },
  game: { icon: "🎮", label: "Spel" },
  missing: { icon: "❓", label: "Saknas" },
};

const locationGroup = (location) => {
  if (location === "ms") return "server";
  if (location === "Hsaknas") return "missing";
  if (/^Hspel/.test(location)) return "game";
  if (/^H/.test(location)) return "shelf";
  if (/^[ABC]/.test(location)) return "box";
  return "";
};

const locationIcon = (location) =>
  locationGroups[locationGroup(location)]?.icon ?? "";

// Display a single movie.
const MovieItem = (item) => {
  return (
    <div className="movie-item" key={item.index}>
      <h5 className="movie-title">
        {item.title}
        &nbsp;
        <LanguageBadges audio={item.audio} subtitle={item.subtitle} />
      </h5>
      <p className="movie-details">
        {locationIcon(item["media-location"])} {item["media-location"]} [{item["media-type"]}/{item["media-format"]}]
        &nbsp;
        {item.category.length > 0 && (
          <> (kategori: {item.category.join(", ")}) </>
        )}
        &nbsp;
        {" "}
        {item.audio}/{item.subtitle}
      </p>
    </div>
  );
};

// Display a list of movies.
const MovieList = (props) => {
  return props.filteredData.map((item) => (
    <MovieItem key={item.index} {...item} />
  ));
};

// create array from set

const App = (props) => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [filter, setFilter] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedGroups, setSelectedGroups] = useState(["server", "shelf"]);

  const toggleGroup = (group) =>
    setSelectedGroups((groups) =>
      groups.includes(group)
        ? groups.filter((g) => g !== group)
        : [...groups, group]
    );

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
    });
  }, []);

  // Update filtered data when data, filter, selected tag or location groups change.
  // No location group selected means the same as all selected.
  useEffect(() => {
    const groups =
      selectedGroups.length > 0 ? selectedGroups : Object.keys(locationGroups);
    setFilteredData(
      data.filter(
        (item) =>
          item.title.toLowerCase().includes(filter.toLowerCase()) &&
          (!selectedCategory || item.category.includes(selectedCategory)) &&
          groups.includes(locationGroup(item["media-location"]))
      )
    );
  }, [filter, selectedCategory, selectedGroups, data]);

  const uniqueCategories = (data) => {
    const c = data.reduce(
      (allCategories, item) => [...allCategories, ...item.category],
      []
    );
    return [...new Set(c)].sort((a, b) => a.localeCompare(b, "sv"));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
  };

  return (
    <>
      <div>
        <form onSubmit={handleSubmit}>
          <input
            className="form-control"
            type="text"
            placeholder="Filtrera på filmnamn"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select
            className="form-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">Alla kategorier</option>
            {uniqueCategories(data).map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <div className="location-groups">
            {Object.entries(locationGroups).map(([group, { icon, label }]) => (
              <button
                key={group}
                type="button"
                className={`btn btn-outline-secondary location-group${
                  selectedGroups.includes(group) ? " active" : ""
                }`}
                aria-pressed={selectedGroups.includes(group)}
                onClick={() => toggleGroup(group)}
              >
                <span className="location-group-icon">{icon}</span>
                <span className="location-group-label">{label}</span>
              </button>
            ))}
          </div>
        </form>
        <MovieList filteredData={filteredData} />
      </div>
    </>
  );
};

export { App, badge, locationIcon };
