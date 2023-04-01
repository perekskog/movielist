import React, { useState, useEffect } from "react";
import axios from "axios";
import { MyBug } from "./bug.js";
import "./App.css";

function LanguageBadge(props) {
  return (
    <div className="swedish-flag">
      <span className="cross">{props.badge}</span>
      <span className="flag">{props.flag}</span>
    </div>
  );
}

const accessability = (target, flag, audio, subtitle) => {
  if (audio === target || subtitle === target) return flag;
  if (audio !== target && subtitle === "?") return "?" + flag;
  if (audio === "?" && subtitle !== target) return "?" + flag;
  // Here we know that audio and subtitle are not target and not "?"
  if (audio !== target && subtitle !== target) return "🚫" + flag;
};

// Get a flag for a language.
const getNationalFlagForLanguage = (audio, subtitle) => {
  console.log("getNationalFlagForLanguage", audio, subtitle);

  let flags =
    " " +
    accessability("se", "🇸🇪", audio, subtitle) +
    " " +
    accessability("en", "🇬🇧", audio, subtitle);

  return flags;
};

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

// Display a single movie.
const MovieItem = (item) => {
  return (
    <div className="movie-item" key={item.index}>
      <h5 className="movie-title">
        {item.title}
        &nbsp;
        {getNationalFlagForLanguage(item.audio, item.subtitle)}
        &nbsp;
        <LanguageBadges audio={item.audio} subtitle={item.subtitle} />
      </h5>
      <p className="movie-details">
        {item["media-location"]} [{item["media-type"]}/{item["media-format"]}]
        &nbsp;
        {item.category.length > 0 && (
          <> (kategori: {item.category.join(", ")}) </>
        )}
        &nbsp;
        {item.latest === "true" && (
          <>
            {" "}
            {item.audio} {item.subtitle}
          </>
        )}
      </p>
    </div>
  );
};

// Display a list of movies.
const MovieList = (props) => {
  return props.filteredData.map((item) => (
    <MovieItem latest={props.latest} key={item.index} {...item} />
  ));
};

// create array from set

const App = (props) => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [filter, setFilter] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

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
          (!selectedCategory || item.category.includes(selectedCategory))
      )
    );
  }, [filter, selectedCategory, data]);

  const uniqueCategories = (data) => {
    const c = data.reduce(
      (allCategories, item) => [...allCategories, ...item.category],
      []
    );
    return [...new Set(c)];
  };

  const handleSubmit = (event) => {
    event.preventDefault();
  };

  return (
    <>
      {/* <MyBug /> */}
      <div>
        <form onSubmit={handleSubmit}>
          <input
            className="form-control"
            type="text"
            placeholder="Filtrera på filmnamn"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {props.latest === "true" && (
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
          )}
        </form>
        <MovieList filteredData={filteredData} latest={props.latest} />
      </div>
    </>
  );
};

export { App };
