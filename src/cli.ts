import { readFileSync } from 'node:fs';
import { handleGetPage } from './routes/handlers/get-page.js';
import { handleListPages } from './routes/handlers/list-pages.js';
import { handleSearchPages } from './routes/handlers/search-pages.js';
import { handleCreatePage } from './routes/handlers/create-page.js';
import { handleGetPageUrl } from './routes/handlers/get-page-url.js';
import { handleInsertLines } from './routes/handlers/insert-lines.js';

const CLI_COMMANDS = ['get', 'list', 'search', 'create', 'url', 'insert'] as const;
type CliCommand = typeof CLI_COMMANDS[number];

interface ParsedArgs {
  command: CliCommand | 'help';
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [first, ...rest] = argv;

  if (!first || first === '--help' || first === '-h') {
    return { command: 'help', positional: [], flags: {} };
  }

  if (!CLI_COMMANDS.includes(first as CliCommand)) {
    return { command: 'help', positional: [], flags: {} };
  }

  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (const arg of rest) {
    if (arg === '--help' || arg === '-h') {
      flags['help'] = true;
    } else if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex >= 0) {
        const key = arg.slice(2, eqIndex);
        const value = arg.slice(eqIndex + 1);
        flags[key] = value;
      } else {
        flags[arg.slice(2)] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command: first as CliCommand, positional, flags };
}

const COMMON_OPTIONS = `Common Options:
  --project=NAME                 Override project name (default: COSENSE_PROJECT_NAME)
  --json                         Output as JSON
  --compact                      Token-efficient compact output
  --help, -h                     Show help`;

const COMMAND_HELP: Record<string, string> = {
  get: `Usage: scrapbox-cosense-mcp get <title> [options]

Retrieve page content, metadata, and links.

Arguments:
  <title>                        Page title (required)

${COMMON_OPTIONS}`,

  list: `Usage: scrapbox-cosense-mcp list [options]

List pages with sorting and pagination.

Options:
  --sort=METHOD                  Sort: updated|created|accessed|linked|views|title
  --limit=N                      Max pages (1-1000, default: 1000)
  --skip=N                       Pages to skip
  --exclude-pinned               Exclude pinned pages

${COMMON_OPTIONS}`,

  search: `Usage: scrapbox-cosense-mcp search <query> [options]

Search pages by keyword (max 100 results).
Supports AND search (multiple words), exclusion (-word), exact match ("phrase").

Arguments:
  <query>                        Search query (required)

${COMMON_OPTIONS}`,

  create: `Usage: scrapbox-cosense-mcp create <title> [options]

Create a new page. Requires COSENSE_SID.
Markdown body is automatically converted to Scrapbox format.
Do not duplicate the title in the body.

Arguments:
  <title>                        Page title (required)

Options:
  --body=TEXT                    Page body content
  --body-file=PATH               Read body from file
  --format=FORMAT                Body format: markdown (default) | scrapbox
  --dry-run                      Only generate URL, don't create

${COMMON_OPTIONS}`,

  url: `Usage: scrapbox-cosense-mcp url <title> [options]

Generate a direct URL for a page.

Arguments:
  <title>                        Page title (required)

${COMMON_OPTIONS}`,

  insert: `Usage: scrapbox-cosense-mcp insert <title> --after=TEXT --text=TEXT [options]

Insert text after a specified line in a page. Requires COSENSE_SID.
If the target line is not found, text is appended to the end.

Arguments:
  <title>                        Page title (required)

Options:
  --after=TEXT                   Target line to insert after (required)
  --text=TEXT                    Text to insert
  --text-file=PATH               Read insertion text from file
  --format=FORMAT                Text format: markdown (default) | scrapbox

${COMMON_OPTIONS}`,
};

function printHelp(command?: string): void {
  if (command && COMMAND_HELP[command]) {
    process.stdout.write(COMMAND_HELP[command] + '\n');
    return;
  }

  const help = `scrapbox-cosense-mcp - Scrapbox/Cosense CLI & MCP Server

Usage:
  scrapbox-cosense-mcp <command> [arguments] [options]
  scrapbox-cosense-mcp                          (start MCP server)

Commands:
  get <title>                    Get page content
  list                           List pages with sorting/pagination
  search <query>                 Search pages by keyword
  create <title>                 Create a new page
  url <title>                    Get page URL
  insert <title>                 Insert lines into a page

${COMMON_OPTIONS}

Run scrapbox-cosense-mcp <command> --help for command details.

Environment Variables:
  COSENSE_PROJECT_NAME           Target project (required for most commands)
  COSENSE_SID                    Session ID for private projects
  COSENSE_CONVERT_NUMBERED_LISTS Convert numbered lists to bullet lists
`;
  process.stdout.write(help);
}

interface HandlerResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

function output(result: HandlerResult, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    const text = result.content[0]?.text ?? '';
    if (result.isError) {
      process.stderr.write(text + '\n');
    } else {
      process.stdout.write(text + '\n');
    }
  }
}

function requireProjectName(flags: Record<string, string | boolean>): string {
  const project = (typeof flags['project'] === 'string' ? flags['project'] : undefined)
    || process.env.COSENSE_PROJECT_NAME;
  if (!project) {
    process.stderr.write('Error: COSENSE_PROJECT_NAME is not set. Use --project=NAME or set the environment variable.\n');
    process.exit(2);
  }
  return project;
}

function readFileContent(path: string): string {
  try {
    return readFileSync(path, 'utf-8');
  } catch (error) {
    process.stderr.write(`Error: Cannot read file "${path}": ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exit(2);
  }
}

export async function runCli(argv: string[]): Promise<void> {
  const { command, positional, flags } = parseArgs(argv);
  const json = flags['json'] === true;
  const compact = flags['compact'] === true;
  const sid = process.env.COSENSE_SID;

  if (command === 'help') {
    printHelp();
    return;
  }
  if (flags['help']) {
    printHelp(command);
    return;
  }

  let result: HandlerResult;

  switch (command) {
    case 'get': {
      const title = positional[0];
      if (!title) {
        process.stderr.write('Error: Page title is required. Usage: scrapbox-cosense-mcp get <title>\n');
        process.exit(2);
      }
      const project = requireProjectName(flags);
      result = await handleGetPage(project, sid, {
        pageTitle: title,
        projectName: typeof flags['project'] === 'string' ? flags['project'] : undefined,
        compact,
      });
      break;
    }

    case 'list': {
      const project = requireProjectName(flags);
      const listParams: Record<string, unknown> = {
        excludePinned: flags['exclude-pinned'] === true,
      };
      if (typeof flags['sort'] === 'string') listParams['sort'] = flags['sort'];
      if (typeof flags['limit'] === 'string') listParams['limit'] = parseInt(flags['limit'], 10);
      if (typeof flags['skip'] === 'string') listParams['skip'] = parseInt(flags['skip'], 10);
      if (typeof flags['project'] === 'string') listParams['projectName'] = flags['project'];
      if (compact) listParams['compact'] = true;
      result = await handleListPages(project, sid, listParams as Parameters<typeof handleListPages>[2]);
      break;
    }

    case 'search': {
      const query = positional[0];
      if (!query) {
        process.stderr.write('Error: Search query is required. Usage: scrapbox-cosense-mcp search <query>\n');
        process.exit(2);
      }
      const project = requireProjectName(flags);
      result = await handleSearchPages(project, sid, {
        query,
        projectName: typeof flags['project'] === 'string' ? flags['project'] : undefined,
        compact,
      });
      break;
    }

    case 'create': {
      const title = positional[0];
      if (!title) {
        process.stderr.write('Error: Page title is required. Usage: scrapbox-cosense-mcp create <title>\n');
        process.exit(2);
      }
      const project = requireProjectName(flags);
      let body: string | undefined;
      if (typeof flags['body-file'] === 'string') {
        body = readFileContent(flags['body-file']);
      } else if (typeof flags['body'] === 'string') {
        body = flags['body'];
      }
      result = await handleCreatePage(project, sid, {
        title,
        body,
        createActually: flags['dry-run'] !== true,
        format: flags['format'] === 'scrapbox' ? 'scrapbox' : undefined,
        projectName: typeof flags['project'] === 'string' ? flags['project'] : undefined,
        compact,
      });
      break;
    }

    case 'url': {
      const title = positional[0];
      if (!title) {
        process.stderr.write('Error: Page title is required. Usage: scrapbox-cosense-mcp url <title>\n');
        process.exit(2);
      }
      const project = requireProjectName(flags);
      result = await handleGetPageUrl(project, sid, {
        title,
        projectName: typeof flags['project'] === 'string' ? flags['project'] : undefined,
      });
      break;
    }

    case 'insert': {
      const pageTitle = positional[0];
      if (!pageTitle) {
        process.stderr.write('Error: Page title is required. Usage: scrapbox-cosense-mcp insert <title> --after=TEXT --text=TEXT\n');
        process.exit(2);
      }
      const afterText = typeof flags['after'] === 'string' ? flags['after'] : undefined;
      if (!afterText) {
        process.stderr.write('Error: --after=TEXT is required. Usage: scrapbox-cosense-mcp insert <title> --after=TEXT --text=TEXT\n');
        process.exit(2);
      }
      let text: string | undefined;
      if (typeof flags['text-file'] === 'string') {
        text = readFileContent(flags['text-file']);
      } else if (typeof flags['text'] === 'string') {
        text = flags['text'];
      }
      if (!text) {
        process.stderr.write('Error: --text=TEXT or --text-file=PATH is required.\n');
        process.exit(2);
      }
      const project = requireProjectName(flags);
      result = await handleInsertLines(project, sid, {
        pageTitle,
        targetLineText: afterText,
        text,
        format: flags['format'] === 'scrapbox' ? 'scrapbox' : undefined,
        projectName: typeof flags['project'] === 'string' ? flags['project'] : undefined,
        compact,
      });
      break;
    }
  }

  output(result, json);
  process.exit(result.isError ? 1 : 0);
}
