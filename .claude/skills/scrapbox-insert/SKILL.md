---
name: scrapbox-insert
description: Insert text into an existing Scrapbox/Cosense page. Requires COSENSE_SID.
disable-model-invocation: true
allowed-tools: Bash(scrapbox-cosense-mcp *)
argument-hint: <page title> --after="target line" --text="content"
---

Insert text after a specific line in an existing Scrapbox/Cosense page.

Run:
```bash
scrapbox-cosense-mcp insert $ARGUMENTS
```

If the target line is not found, text is appended to the end of the page. Options:
- `--after="target line text"` (required) line to insert after
- `--text="content"` or `--text-file=PATH` (required) text to insert
- `--format=scrapbox` for native Scrapbox syntax
