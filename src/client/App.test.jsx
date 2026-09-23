import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { App, badge } from "./App.jsx";

vi.mock("axios");

const movies = () => [
  {
    title: "zorro",
    "media-location": "Hylla 1",
    "media-type": "DVD",
    "media-format": "PAL",
    category: ["action"],
    audio: "en",
    subtitle: "se",
  },
  {
    title: "Amelie",
    "media-location": "Hylla 2",
    "media-type": "Blu-ray",
    "media-format": "1080p",
    category: ["drama"],
    audio: "fr",
    subtitle: "?",
  },
  {
    title: "Matrix",
    "media-location": "Hylla 1",
    "media-type": "DVD",
    "media-format": "PAL",
    category: ["action", "scifi"],
    audio: "en",
    subtitle: "en",
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

describe("App", () => {
  beforeEach(() => {
    axios.get.mockResolvedValue({ data: movies() });
  });

  it("lists movies sorted by title, ignoring case", async () => {
    render(<App latest="false" />);
    await screen.findByText(/Matrix/);
    const t = titles();
    expect(t[0]).toMatch(/^Amelie/);
    expect(t[1]).toMatch(/^Matrix/);
    expect(t[2]).toMatch(/^zorro/);
  });

  it("filters movies by title", async () => {
    const user = userEvent.setup();
    render(<App latest="false" />);
    await screen.findByText(/Matrix/);
    await user.type(screen.getByPlaceholderText("Filtrera på filmnamn"), "ma");
    expect(titles()).toHaveLength(1);
    expect(titles()[0]).toMatch(/^Matrix/);
  });

  it("hides the category select unless latest is true", async () => {
    render(<App latest="false" />);
    await screen.findByText(/Matrix/);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("filters movies by category when latest is true", async () => {
    const user = userEvent.setup();
    render(<App latest="true" />);
    await screen.findByText(/Matrix/);
    await user.selectOptions(screen.getByRole("combobox"), "action");
    const t = titles();
    expect(t).toHaveLength(2);
    expect(t[0]).toMatch(/^Matrix/);
    expect(t[1]).toMatch(/^zorro/);
  });
});
