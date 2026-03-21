---
name: scrapbox-create
description: Create a new page in Scrapbox/Cosense. Requires COSENSE_SID.
disable-model-invocation: true
allowed-tools: Bash(scrapbox-cosense-mcp *)
argument-hint: <page title> [--body="content"]
---

Create a new page in the Scrapbox/Cosense project.

Run:
```bash
scrapbox-cosense-mcp create $ARGUMENTS
```

Body content is written in markdown by default and automatically converted to Scrapbox format. Do not duplicate the title in the body. Options:
- `--body="content"` or `--body-file=PATH` for page content
- `--format=scrapbox` for native Scrapbox syntax
- `--dry-run` to generate URL only without creating the page
