import axios from "axios";
import {
  damerauLevenshtein,
  normalizeSearchText,
  rankFuzzyCandidates,
  searchMediaWithFuzzyFallback,
} from "../services/fuzzyMediaSearch";

jest.mock("axios");

describe("fuzzy media search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("normalizes Turkish characters and punctuation", () => {
    expect(normalizeSearchText("  Çığlık: İstanbul! ")).toBe("ciglik istanbul");
  });

  test("treats a swapped letter as one edit", () => {
    expect(damerauLevenshtein("interstllar", "interstellar")).toBeLessThanOrEqual(2);
    expect(damerauLevenshtein("pottre", "potter")).toBe(1);
  });

  test("finds closest movie title without changing unrelated results", () => {
    const items = [
      { id: 1, title: "Interstellar", popularity: 100 },
      { id: 2, title: "The Godfather", popularity: 200 },
    ];
    expect(rankFuzzyCandidates(items, "Interstllar", "movie")).toEqual([items[0]]);
  });

  test("matches a query against the beginning of a longer title", () => {
    const item = { id: 3, title: "Harry Potter and the Philosopher's Stone" };
    expect(rankFuzzyCandidates([item], "Harry Pottre", "movie")).toEqual([item]);
  });

  test("supports actor and TV names", () => {
    const actor = { id: 4, name: "Brad Pitt", popularity: 50 };
    const show = { id: 5, name: "Breaking Bad", popularity: 90 };
    expect(rankFuzzyCandidates([actor], "Brad Pit", "person")).toEqual([actor]);
    expect(rankFuzzyCandidates([show], "Breking Bad", "tv")).toEqual([show]);
  });

  test("keeps the regular TMDB flow when the query already matches", async () => {
    const movie = { id: 6, title: "Interstellar", vote_count: 100 };
    axios.get.mockResolvedValueOnce({ data: { results: [movie] } });

    const result = await searchMediaWithFuzzyFallback({
      mediaType: "movie",
      query: "Interstellar",
      language: "tr-TR",
      adultContent: false,
      API_KEY: "token",
    });

    expect(result).toEqual({ results: [movie], usedFuzzyFallback: false });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test("moves a close TMDB typo match ahead without extra requests", async () => {
    const unrelated = { id: 8, title: "The Godfather", vote_count: 500 };
    const closest = { id: 9, title: "Interstellar", vote_count: 100 };
    axios.get.mockResolvedValueOnce({
      data: { results: [unrelated, closest] },
    });

    const result = await searchMediaWithFuzzyFallback({
      mediaType: "movie",
      query: "Interstllar",
      language: "tr-TR",
      adultContent: false,
      API_KEY: "token",
    });

    expect(result.results).toEqual([closest, unrelated]);
    expect(result.usedFuzzyFallback).toBe(true);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test("uses cached-catalog candidates when TMDB has no close typo result", async () => {
    const movie = { id: 7, title: "Interstellar", popularity: 100 };
    axios.get
      .mockResolvedValueOnce({ data: { results: [] } })
      .mockResolvedValueOnce({ data: { results: [movie] } })
      .mockResolvedValueOnce({ data: { results: [] } })
      .mockResolvedValueOnce({ data: { results: [] } })
      .mockResolvedValueOnce({ data: { results: [] } });

    const result = await searchMediaWithFuzzyFallback({
      mediaType: "movie",
      query: "Interstllar",
      language: "en-US",
      adultContent: false,
      API_KEY: "token",
    });

    expect(result.results).toEqual([movie]);
    expect(result.usedFuzzyFallback).toBe(true);
    expect(axios.get).toHaveBeenCalledTimes(5);
  });
});
