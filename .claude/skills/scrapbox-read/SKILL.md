---
name: scrapbox-read
description: Read a specific page from Scrapbox/Cosense. Use when the user wants to see page content, check what's written on a page, or retrieve page details.
allowed-tools: Bash(scrapbox-cosense-mcp *)
argument-hint: <page title>
---

Retrieve and display the content of a specific Scrapbox/Cosense page.

Run:
```bash
scrapbox-cosense-mcp get "$ARGUMENTS"
```

Present the page content, metadata (created/updated dates, editors), and linked pages to the user.
