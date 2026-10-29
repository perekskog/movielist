import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { App, badge, locationIcon } from "./App.jsx";

vi.mock("axios");

const movies = () => [
  {
    title: "zorro",
    "media-location": "ms",
    "media-type": "DVD",
    "media-format": "PAL",
    category: ["action"],
    audio: "en",
    subtitle: "se",
  },
  {
    title: "Amelie",
    "media-location": "ms",
    "media-type": "Blu-ray",
    "media-format": "1080p",
    category: ["drama"],
    audio: "fr",
    subtitle: "?",
  },
  {
    title: "Matrix",
    "media-location": "ms",
    "media-type": "DVD",
    "media-format": "PAL",
    category: ["action", "scifi"],
    audio: "en",
    subtitle: "en",
  },
  {
    title: "Zulu",
    "media-location": "Hsorterat",
    "media-type": "DVD",
    "media-format": "PAL",
    category: ["scifi"],
    audio: "en",
    subtitle: "se",
  },
  {
    title: "Brazil",
    "media-location": "B30",
    "media-type": "DVD",
    "media-format": "PAL",
    category: ["drama"],
    audio: "en",
    subtitle: "se",
  },
  {
    title: "Halo",
    "media-location": "Hspel-ps",
    "media-type": "disc",
    "media-format": "ps",
    category: [],
    audio: "en",
    subtitle: "se",
  },
  {
    title: "Heat",
    "media-location": "Hsaknas",
    "media-type": "disc",
    "media-format": "dvd",
    category: [],
    audio: "en",
    subtitle: "se",
  },
];

const titles = () =>
  screen.getAllByRole("heading", { level: 5 }).map((h) => h.textContent);

describe("badge", () => {
  it("is empty when audio or subtitle matches the target", () => {
    expect(badge("se", "se", "en")).toBe("");
    expect(badge("se", "en", "se")).toBe("");
  });

  it("is ? when the language is unknown", () => {
    expect(badge("se", "en", "?")).toBe("?");
    expect(badge("se", "?", "en")).toBe("?");
  });

  it("is X when neither audio nor subtitle matches", () => {
    expect(badge("se", "en", "fr")).toBe("X");
  });
});

describe("locationIcon", () => {
  it("is a server for ms", () => {
    expect(locationIcon("ms")).toBe("🖥️");
  });

  it("is a bookshelf for H locations", () => {
    for (const location of ["Hsorterat", "Hserie", "Hanim"]) {
      render(<>{locationIcon(location)}</>);
    }
    expect(screen.getAllByRole("img", { name: "Bokhylla" })).toHaveLength(3);
  });

  it("is a game for Hspel locations", () => {
    expect(locationIcon("Hspel-ps")).toBe("🎮");
    expect(locationIcon("Hspel-nintendo")).toBe("🎮");
  });

  it("is missing for Hsaknas", () => {
    expect(locationIcon("Hsaknas")).toBe("❓");
  });

  it("is a storage box for A, B and C locations", () => {
    expect(locationIcon("A3")).toBe("📦");
    expect(locationIcon("B30")).toBe("📦");
    expect(locationIcon("C109")).toBe("📦");
  });

  it("is empty for other locations", () => {
    expect(locationIcon("D1")).toBe("");
  });
});

describe("App", () => {
  beforeEach(() => {
    axios.get.mockResolvedValue({ data: movies() });
  });

  it("lists movies sorted by title, ignoring case", async () => {
    render(<App />);
    await screen.findByText(/Matrix/);
    const t = titles();
    expect(t[0]).toMatch(/^Amelie/);
    expect(t[1]).toMatch(/^Matrix/);
    expect(t[2]).toMatch(/^zorro/);
    expect(t[3]).toMatch(/^Zulu/);
  });

  it("filters movies by title", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/Matrix/);
    await user.type(screen.getByPlaceholderText("Filtrera på filmnamn"), "ma");
    expect(titles()).toHaveLength(1);
    expect(titles()[0]).toMatch(/^Matrix/);
  });

  it("shows raw language codes", async () => {
    render(<App />);
    await screen.findByText(/Matrix/);
    expect(screen.getByText(/fr\/\?/)).toBeInTheDocument();
  });

  // The category dropdown is disabled in App.jsx. Re-enable these tests with it.
  it.skip("shows category filtering by default", async () => {
    render(<App />);
    await screen.findByText(/Matrix/);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it.skip("lists categories sorted", async () => {
    render(<App />);
    await screen.findByText(/Matrix/);
    const options = screen
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual(["Alla kategorier", "action", "drama", "scifi"]);
  });

  it.skip("filters movies by category", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/Matrix/);
    await user.selectOptions(screen.getByRole("combobox"), "action");
    const t = titles();
    expect(t).toHaveLength(2);
    expect(t[0]).toMatch(/^Matrix/);
    expect(t[1]).toMatch(/^zorro/);
  });

  it("shows server and shelf movies by default", async () => {
    render(<App />);
    await screen.findByText(/Matrix/);
    expect(screen.getByRole("button", { name: /Server/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Hylla/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Låda/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Spel/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Saknas/ })).toHaveAttribute("aria-pressed", "false");
    expect(titles()).toHaveLength(4);
  });

  it("filters movies by location groups", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/Matrix/);
    await user.click(screen.getByRole("button", { name: /Server/ }));
    expect(titles()).toHaveLength(1);
    expect(titles()[0]).toMatch(/^Zulu/);
    await user.click(screen.getByRole("button", { name: /Hylla/ }));
    await user.click(screen.getByRole("button", { name: /Låda/ }));
    await user.click(screen.getByRole("button", { name: /Spel/ }));
    expect(titles()).toHaveLength(2);
    expect(titles()[0]).toMatch(/^Brazil/);
    expect(titles()[1]).toMatch(/^Halo/);
    await user.click(screen.getByRole("button", { name: /Låda/ }));
    await user.click(screen.getByRole("button", { name: /Spel/ }));
    await user.click(screen.getByRole("button", { name: /Saknas/ }));
    expect(titles()).toHaveLength(1);
    expect(titles()[0]).toMatch(/^Heat/);
  });

  it("shows all movies when no location group is selected", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/Matrix/);
    await user.click(screen.getByRole("button", { name: /Server/ }));
    await user.click(screen.getByRole("button", { name: /Hylla/ }));
    expect(titles()).toHaveLength(7);
  });
});
