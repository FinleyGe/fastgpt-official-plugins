# searchXNG

Use a configured SearXNG instance for web search.

## Configuration

Set the SearXNG instance URL in the tool Secret configuration. The plugin does
not provide a default public instance because the SearXNG project does not
operate an official hosted search service.

The configured instance must enable JSON responses in `settings.yml`:

```yaml
search:
  formats:
    - html
    - json
```

See the [SearXNG Search API documentation](https://docs.searxng.org/dev/search_api.html)
and the [public instance directory](https://searx.space/) for more information.
