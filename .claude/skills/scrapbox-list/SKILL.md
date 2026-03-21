---
name: scrapbox-list
description: List pages in Scrapbox/Cosense with sorting and pagination. Use when browsing pages, checking recent updates, or discovering content.
allowed-tools: Bash(scrapbox-cosense-mcp *)
argument-hint: [--sort=updated|created|views|linked|title] [--limit=N]
---

Browse and list pages from the Scrapbox/Cosense project.

Run:
```bash
scrapbox-cosense-mcp list $ARGUMENTS
```

If no arguments provided, lists recent pages sorted by update time. Available sort methods: updated, created, accessed, linked, views, title. Use --limit=N to control how many pages to show.
