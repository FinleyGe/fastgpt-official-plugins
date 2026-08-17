import {
  createToolHandler,
  defineTool,
  type InputSchemaMetaType,
  type OutputSchemaMetaType,
  type SecretSchemaMetaType,
} from "@fastgpt-plugin/sdk-factory";
import z from "zod";
import {
  InputType,
  OutputType,
  SearchResultType,
  tool as toolCb,
  UrlType,
} from "./src";

const secretSchema = z.object({
  url: UrlType.meta({
    title: "SearXNG 实例地址",
    description:
      "填写自建或可信的 SearXNG 实例地址，例如 https://search.example.com",
    isSecret: false,
  } satisfies SecretSchemaMetaType),
});
const inputSchema = z.object({
  query: z
    .string()
    .min(1)
    .meta({
      title: "query",
      description: "检索词",
      toolDescription: "检索词",
    } satisfies InputSchemaMetaType),
});
const outputSchema = z.object({
  result: z.array(SearchResultType).meta({
    title: "搜索结果",
    description: "检索结果",
  } satisfies OutputSchemaMetaType),
});
const handler = createToolHandler({
  inputSchema,
  outputSchema,
  secretSchema,
  handler: async (input, ctx) => {
    const parsedInput = await InputType.parseAsync({
      ...input,
      ...ctx.secrets,
    });
    const output = await toolCb(parsedInput);
    return OutputType.parseAsync(output);
  },
});

const tool = defineTool({
  manifest: {
    pluginId: "searchXNG",
    name: {
      en: "Search XNG",
      "zh-CN": "SearXNG 搜索",
    },
    description: {
      en: "Use a configured SearXNG instance for web search.",
      "zh-CN": "使用配置的 SearXNG 实例进行网络搜索。",
    },
    version: "0.1.1",
    versionDescription: {
      en: "Use the SearXNG JSON Search API with a configured instance URL.",
      "zh-CN": "使用 SearXNG JSON 搜索 API，并配置实例地址。",
    },
    tags: ["search"],
  },
  handler,
});

export default tool;
