import { searchPages } from "../../cosense.js";
import { formatPageOutput } from '../../utils/format.js';

export interface SearchPagesParams {
  query: string;
}

export async function handleSearchPages(
  projectName: string,
  cosenseSid: string | undefined,
  params: SearchPagesParams
) {
  try {
    const query = String(params.query);
    const results = await searchPages(projectName, query, cosenseSid);
    
    if (!results) {
      return {
        content: [{
          type: "text",
          text: [
            `Error: No search results`,
            `Operation: search_pages`,
            `Project: ${projectName}`,
            `Query: ${query}`,
            `Status: 404`,
            `Timestamp: ${new Date().toISOString()}`
          ].join('\n')
        }],
        isError: true
      };
    }

    let output = [
      `Project: ${projectName}`,
      `Search query: ${results.searchQuery}`,
      `Total results: ${results.count}`,
      '---'
    ].join('\n') + '\n';

    output += results.pages.map((page, index) => 
      formatPageOutput(page, index, {
        showMatches: true,
        showSnippet: true
      }) + '\n---'
    ).join('\n');

    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: [
          'Error details:',
          `Message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          `Operation: search_pages`,
          `Project: ${projectName}`,
          `Query: ${params.query}`,
          `Timestamp: ${new Date().toISOString()}`
        ].join('\n')
      }],
      isError: true
    };
  }
}