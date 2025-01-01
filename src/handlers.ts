import {
  ListPagesHandlerParams,
  SearchPagesHandlerParams,
} from "./types/handlers.js";
async function listPagesHandler(params: ListPagesHandlerParams) {
  const { cosenseSid, projectName } = params;
}
async function searchPagesHandler(params: SearchPagesHandlerParams) {
  const { cosenseSid, projectName, query } = params;
}
