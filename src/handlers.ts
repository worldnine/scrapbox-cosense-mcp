import { ListPagesHandlerParams, SearchPagesHandlerParams } from './types/handlers.js';

// ...existing code...

async function listPagesHandler(params: ListPagesHandlerParams) {
  const { cosenseSid, projectName } = params;
  // ...existing code...
}

async function searchPagesHandler(params: SearchPagesHandlerParams) {
  const { cosenseSid, projectName, query } = params;
  // ...existing code...
}

// ...existing code...
