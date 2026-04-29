# Google Search Console MCP setup

MCP server configured in repo:

```json
{
  "gsc": {
    "command": "npx",
    "args": ["-y", "mcp-server-gsc"],
    "env": {
      "GOOGLE_APPLICATION_CREDENTIALS": "C:\\Users\\thann\\.config\\gsc\\noctalia-search-console-service-account.json"
    }
  }
}
```

## Credentials required

The MCP needs a Google Cloud service account JSON key with access to the Search Console property:

```text
sc-domain:noctalia.app
```

Do not store this JSON key in the repo.

Recommended local path:

```text
C:\Users\thann\.config\gsc\noctalia-search-console-service-account.json
```

## Google Cloud steps

1. Open Google Cloud Console:
   `https://console.cloud.google.com/`
2. Create or select a project for Noctalia SEO tooling.
3. Enable the Search Console API:
   `https://console.cloud.google.com/marketplace/product/google/searchconsole.googleapis.com`
4. Go to APIs & Services > Credentials:
   `https://console.cloud.google.com/apis/credentials`
5. Create a service account.
6. Create a JSON key for that service account.
7. Move the downloaded JSON key to:
   `C:\Users\thann\.config\gsc\noctalia-search-console-service-account.json`

## Search Console permission step

1. Open Search Console users/settings for the domain property:
   `https://search.google.com/search-console/settings/users?resource_id=sc-domain%3Anoctalia.app&hl=fr`
2. Add the service account email as a user.
3. Use Full permission if you only need analytics and inspection. Owner/admin is not required for read-only analytics.

The service account email looks like:

```text
name@project-id.iam.gserviceaccount.com
```

## Restart required

After the JSON key is in place, restart Codex / MCP so the new `.mcp.json` entry is loaded.

## Useful calls once the MCP is available

Use `siteUrl`:

```text
sc-domain:noctalia.app
```

Recommended first queries:

```json
{
  "siteUrl": "sc-domain:noctalia.app",
  "startDate": "2026-01-29",
  "endDate": "2026-04-27",
  "dimensions": "date",
  "type": "web",
  "rowLimit": 25000
}
```

```json
{
  "siteUrl": "sc-domain:noctalia.app",
  "startDate": "2026-01-29",
  "endDate": "2026-04-27",
  "dimensions": "query,page",
  "type": "web",
  "rowLimit": 25000,
  "detectQuickWins": true
}
```

