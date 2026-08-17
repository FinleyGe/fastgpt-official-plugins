import { z } from "zod";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export const UrlType = z.url({ protocol: /^https?$/ });

export const InputType = z.object({
  query: z.string().min(1),
  url: UrlType,
});

export const SearchResultType = z.object({
  title: z.string(),
  link: z.string(),
  snippet: z.string(),
});

export const OutputType = z.object({
  result: z.array(SearchResultType),
});

const SearXNGResponseType = z.looseObject({
  results: z.array(
    z.object({
      title: z
        .string()
        .nullish()
        .transform((value) => value ?? ""),
      url: z
        .string()
        .nullish()
        .transform((value) => value ?? ""),
      content: z
        .string()
        .nullish()
        .transform((value) => value ?? ""),
    }),
  ),
});

function getSearchUrl(url: string, query: string): string {
  const endpoint = new URL(url);
  const pathname = endpoint.pathname.replace(/\/+$/, "");

  endpoint.pathname = pathname.endsWith("/search")
    ? pathname || "/search"
    : `${pathname}/search`;
  endpoint.search = "";
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("language", "auto");

  return endpoint.toString();
}

async function getResponseJson(response: Response): Promise<unknown> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw new Error("SearXNG response is too large");
  }

  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
      throw new Error("SearXNG response is too large");
    }
    return JSON.parse(text);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytesRead = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    bytesRead += value.byteLength;
    if (bytesRead > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("SearXNG response is too large");
    }

    chunks.push(decoder.decode(value, { stream: true }));
  }

  chunks.push(decoder.decode());
  return JSON.parse(chunks.join(""));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown SearXNG request error";
}

export async function tool({
  query,
  url,
}: z.infer<typeof InputType>): Promise<z.infer<typeof OutputType>> {
  const response = await fetch(getSearchUrl(url, query));

  if (!response.ok) {
    throw new Error(
      `SearXNG request failed: ${response.status} ${response.statusText}`,
    );
  }

  try {
    const results = SearXNGResponseType.parse(
      await getResponseJson(response),
    ).results;

    if (results.length === 0) {
      throw new Error("No search results");
    }

    return {
      result: results
        .slice(0, 10)
        .map(({ title, url: resultUrl, content }) => ({
          title,
          link: resultUrl,
          snippet: content,
        })),
    };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}
