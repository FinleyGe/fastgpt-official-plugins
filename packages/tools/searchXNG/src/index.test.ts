import { afterEach, describe, expect, it, vi } from "vitest";
import { tool } from "./index";

describe("searchXNG tool", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("queries the configured instance through the JSON Search API", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              title: "SearXNG",
              url: "https://example.com",
              content: "A privacy-respecting metasearch engine.",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await tool({
      query: "SearXNG docs",
      url: "https://search.example.com/",
    });

    const requestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(requestUrl.pathname).toBe("/search");
    expect(requestUrl.searchParams.get("q")).toBe("SearXNG docs");
    expect(requestUrl.searchParams.get("format")).toBe("json");
    expect(result).toEqual({
      result: [
        {
          title: "SearXNG",
          link: "https://example.com",
          snippet: "A privacy-respecting metasearch engine.",
        },
      ],
    });
  });

  it("keeps an explicitly configured search endpoint", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [{ title: "Result", url: "", content: "" }],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await tool({
      query: "query",
      url: "https://search.example.com/searxng/search/",
    });

    const requestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(requestUrl.pathname).toBe("/searxng/search");
  });

  it("reports upstream HTTP errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("forbidden", { status: 403 })),
    );

    await expect(
      tool({ query: "query", url: "https://search.example.com" }),
    ).rejects.toThrow("SearXNG request failed: 403");
  });

  it("rejects empty result sets", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify({ results: [] }))),
    );

    await expect(
      tool({ query: "query", url: "https://search.example.com" }),
    ).rejects.toThrow("No search results");
  });

  it("rejects malformed JSON responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("not json", { status: 200 })),
    );

    await expect(
      tool({ query: "query", url: "https://search.example.com" }),
    ).rejects.toThrow();
  });

  it("normalizes fields and limits the result list", async () => {
    const results = Array.from({ length: 11 }, (_, index) => ({
      title: index === 0 ? null : `Title ${index}`,
      url: index === 0 ? null : `https://example.com/${index}`,
      content: index === 0 ? null : `Content ${index}`,
    }));
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify({ results }))),
    );

    const result = await tool({
      query: "query",
      url: "https://search.example.com",
    });

    expect(result.result).toHaveLength(10);
    expect(result.result[0]).toEqual({ title: "", link: "", snippet: "" });
  });

  it("only accepts HTTP and HTTPS instances", async () => {
    await expect(
      tool({ query: "query", url: "ftp://search.example.com" }),
    ).rejects.toThrow();
  });

  it("rejects oversized responses before parsing all results", async () => {
    const oversizedResponse = JSON.stringify({
      results: [
        { title: "Result", url: "", content: "x".repeat(2 * 1024 * 1024) },
      ],
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(oversizedResponse, { status: 200 })),
    );

    await expect(
      tool({ query: "query", url: "https://search.example.com" }),
    ).rejects.toThrow("SearXNG response is too large");
  });
});
