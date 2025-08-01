# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

See README.md for basic installation and setup instructions. Key development commands:

```bash
npm run build        # Build the server (TypeScript → JavaScript) - uses tsconfig.build.json
npm run watch        # Auto-rebuild during development
npm run test         # Run tests using Jest with comprehensive test suite (142+ tests)
npm run lint         # Run ESLint with TypeScript support and console.log warnings
npm run inspector    # Debug with MCP Inspector
```

## Project Architecture

This is an MCP (Model Context Protocol) server for Scrapbox/Cosense that provides 6 main tools:

- `get_page`: Retrieve page content, metadata, and links
- `list_pages`: Browse and list pages with flexible sorting and pagination. Returns page metadata and first 5 lines of content. Max 1000 pages per request.
- `search_pages`: Search for content within pages using keywords or phrases. Returns matching pages with highlighted search terms and content snippets. Limited to 100 results (API limitation).
- `create_page`: Create new pages using WebSocket API with markdown body conversion to Scrapbox format. Creates pages immediately and returns success confirmation with URL. Requires COSENSE_SID for authentication.
- `get_page_url`: Generate direct URL for a page from its title. Useful for creating links or sharing page references.
- `insert_lines`: Insert text after a specified line in a page. If target line not found, text is appended to the end of the page.

### Key Components

**Core API Client (`src/cosense.ts`)**
- Main interface to Scrapbox REST API
- Handles authentication via `COSENSE_SID` cookie
- Provides typed response handling for all API endpoints

**Route Handlers (`src/routes/handlers/`)**
- Each tool has its own handler module
- Standardized error handling and response formatting
- Implements business logic for MCP tool operations

**Utilities (`src/utils/`)**
- `sort.ts`: Page sorting with pinned page handling
- `format.ts`: Response formatting and display utilities
- `markdown-converter.ts`: Markdown to Scrapbox format conversion (uses `md2sb`)

**Type System (`src/types/`)**
- Complete type definitions for Scrapbox API responses
- MCP request/response types
- Configuration and error types

**Test Suite (`src/__tests__/`)**
- `handlers/`: Unit tests for all MCP tool handlers
- `utils/`: Tests for utility functions (formatting, sorting, markdown conversion)
- `cosense.test.ts`: Core API client tests
- `integration.test.ts`: End-to-end MCP integration tests
- `debug-multiple-servers.test.ts`: Tests for multiple server instance scenarios
- `tool-naming.test.ts`: Tests for dynamic tool naming functionality
- `markdown-converter.integration.test.ts`: Integration tests for md2sb module
- Full Jest configuration with TypeScript and ESM support

### Environment Variables

See README.md for complete environment variable documentation. Key variables for development:

- `COSENSE_PROJECT_NAME`: Target Scrapbox project (required)
- `COSENSE_SID`: Session ID for private projects
- `COSENSE_PAGE_LIMIT`: Initial page fetch limit (1-1000, default: 100)
- `COSENSE_SORT_METHOD`: Initial sort method (default: "updated")
- `COSENSE_TOOL_SUFFIX`: Tool name suffix for multiple server instances (e.g., "main" creates "get_page_main")
- `COSENSE_CONVERT_NUMBERED_LISTS`: Convert numbered lists to bullet lists (default: false)

### Architecture Notes

1. **Modular Handler Pattern**: Each MCP tool is implemented as a separate handler module for maintainability
2. **TypeScript-First**: All API responses and internal data structures are fully typed with strict settings
3. **Error Resilience**: Comprehensive error handling with detailed error responses
4. **Flexible Sorting**: Client-side sorting with pinned page filtering
5. **Resource Management**: Initial resource loading with configurable limits
6. **Cookie Authentication**: Uses Scrapbox session cookies for private project access
7. **Modern Build System**: Dual TypeScript configurations for development and production
8. **Comprehensive Testing**: 142+ tests with full type safety and coverage
9. **Code Quality**: ESLint with TypeScript support, automated CI/CD, branch protection
10. **Quality Management**: Automated quality checks prevent debug logs and broken code from reaching production

### Development Notes

- **Tool Descriptions**: Updated descriptions clearly differentiate `list_pages` (browsing by metadata) vs `search_pages` (content search)
- **API Limitations**: `search_pages` is limited to 100 results by Scrapbox API
- **Output Format**: `list_pages` returns first 5 lines of content as descriptions
- **Testing**: Use `npm run inspector` for debugging MCP communication

### Recent Development

**Quality Management Automation (v0.3.0 - Latest)**
- Added ESLint v9 configuration with TypeScript support and console.log warnings
- Implemented GitHub Actions CI/CD pipeline for automated quality checks (lint, test, build)
- Configured branch protection rules requiring PR and passing status checks
- Added PR and Issue templates with quality checklists
- Created comprehensive documentation structure (`docs/` folder)
- Fixed timezone-dependent test failures for CI environment compatibility
- All tests passing (142/142), zero linting errors, 6 acceptable warnings
- Prevents debug logs and broken code from reaching production through automated checks

**Markdown Conversion Improvements**
- Fixed numbered list conversion issue where Scrapbox misinterprets markdown numbered lists
- Added automatic conversion of numbered lists to bullet lists (configurable via COSENSE_CONVERT_NUMBERED_LISTS)
- Preserves nested list structure while removing numbers
- Improved create_page tool description to prevent title duplication through better prompting
- All tests passing (142/142), including new comprehensive list conversion tests

**Multiple Project Support (v0.2.0 - Released)**
- Added optional `projectName` parameter to all MCP tools for single-server multi-project usage
- Implemented dynamic tool naming with COSENSE_TOOL_SUFFIX for multiple server instances
- Resolved issue #7: proper support for running multiple MCP server instances
- Two approaches: recommended multiple servers vs. single server with optional parameters
- Maintains full backward compatibility with existing configurations
- Fixed md2sb module loading issue and added integration tests
- All tests passing (126/126), TypeScript compilation successful
- Released as v0.2.0 with comprehensive documentation updates

The server entry point (`src/index.ts`) initializes resources, sets up MCP handlers, and manages the stdio transport connection.

## TypeScript Configuration

### Modern TypeScript Setup
- **ES2023 Target**: Uses modern JavaScript features and ESM modules
- **Strict Type Checking**: Full strict mode with `exactOptionalPropertyTypes: true`
- **Path Aliases**: Configured in TypeScript for IDE support, but actual imports use relative paths for runtime compatibility
- **Dual Configuration**: 
  - `tsconfig.json`: Main config for IDE and development (includes test files)
  - `tsconfig.build.json`: Production build config (excludes test files)

### Testing Infrastructure
- **Jest with TypeScript**: Uses `ts-jest` with ESM support
- **Comprehensive Coverage**: 142+ tests covering all handlers and utilities
- **Path Alias Support**: Jest configured to resolve `@/` imports
- **Type Safety**: Tests use optional chaining (`?.`) for `noUncheckedIndexedAccess` compatibility

### Key TypeScript Features
- **Optional Chaining**: Used throughout test files for array access safety
- **Union Types**: Optional properties explicitly include `| undefined` for `exactOptionalPropertyTypes`
- **Import Paths**: Uses relative imports for runtime compatibility (TypeScript path aliases are configured for IDE support only)
- **ESM Modules**: Full ES module support with `.js` extensions in imports

### Configuration Files
- `tsconfig.json`: Main TypeScript configuration with strict settings
- `tsconfig.build.json`: Production build configuration (excludes tests)
- `jest.config.js`: Jest configuration with TypeScript and ESM support
- Path alias mappings: `@/` → `src/`, configured in both TypeScript and Jest

## Recent Development

**WebSocket Page Creation Support (v0.4.0 - Latest)**
- Enhanced `create_page` tool with WebSocket API for immediate page creation with body content
- Fixed critical issue where page body content was not being posted to created pages
- Added `createActually` parameter to control WebSocket API usage (default: true)
- Implemented proper authentication checks requiring COSENSE_SID for page creation
- Maintained backward compatibility with URL-only generation mode (createActually: false)
- Added comprehensive debugging and error handling for WebSocket operations
- All tests passing (146/146), TypeScript compilation successful
- Verified working implementation with actual Scrapbox project integration

**WebSocket API Foundation (v0.3.0)**
- Added `insert_lines` tool with WebSocket API support for direct page modification
- Integrated `@cosense/std` and `@cosense/types` libraries for WebSocket functionality
- Implemented line insertion logic with fallback to append mode if target line not found
- Added comprehensive test suite for WebSocket handlers with proper mocking
- Created WebSocket API documentation and specifications
- Enhanced authentication requirements documentation for WebSocket operations
- Follows yosider/cosense-mcp-server implementation pattern for compatibility