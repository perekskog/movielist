import React, { useState, useEffect } from "react";
import axios from "axios";

const App = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [filter, setFilter] = useState("");
  const [selectedTag, setSelectedTag] = useState("");

  // add field to array which is the index of the item in the array

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
      <ul>
        {filteredData.map((item) => (
          <li key={item.index}>
            {item.title}
            {item.subtitle.length > 0 && (
                <> [text {item.subtitle}] </>
            )}
            {item.category.length > 0 && (
              <> (kategori {item.category.join(", ")}) </>
            )} -> {item["media-location"]} [{item["media-type"]}/
            {item["media-format"]}]
          </li>
        ))}
      </ul>
    </div>
  );
};

export { App };
