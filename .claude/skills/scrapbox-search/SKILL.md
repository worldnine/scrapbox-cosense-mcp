---
name: scrapbox-search
description: Search Scrapbox/Cosense pages by keyword. Use when looking for information, finding pages about a topic, or when the user mentions searching Scrapbox.
allowed-tools: Bash(scrapbox-cosense-mcp *)
argument-hint: <search query>
---

Search for pages matching the query in Scrapbox/Cosense.

Run:
```bash
scrapbox-cosense-mcp search "$ARGUMENTS"
```

Display results to the user. Supports AND search (multiple words), exclusion (-word), and exact phrases ("phrase"). Limited to 100 results.
