import { getSmartContext } from "../../cosense.js";
import { formatError } from '../../utils/format.js';

export interface GetSmartContextParams {
  title: string;
  hopCount?: 1 | 2 | undefined;
  projectName?: string | undefined;
  compact?: boolean | undefined;
}

export async function handleGetSmartContext(
  defaultProjectName: string,
  cosenseSid: string | undefined,
  params: GetSmartContextParams
) {
  try {
    const projectName = params.projectName || defaultProjectName;

    if (!cosenseSid) {
      return formatError(
        'Authentication required: COSENSE_SID is needed for Smart Context',
        {
          Operation: 'get_smart_context',
          Project: projectName,
          Timestamp: new Date().toISOString(),
        },
        params.compact
      );
    }

    const hopCount = params.hopCount ?? 1;
    const result = await getSmartContext(projectName, params.title, hopCount, cosenseSid);

    if (!result.ok) {
      return formatError(
        `Smart Context for "${params.title}" failed: ${result.error}`,
        {
          Operation: 'get_smart_context',
          Project: projectName,
          Page: params.title,
          HopCount: String(hopCount),
          Timestamp: new Date().toISOString(),
        },
        params.compact
      );
    }

    const text = result.text;

    if (params.compact) {
      // compact モード: <PageList> ～ </PageList> 内のみ抽出
      const startTag = '<PageList>';
      const endTag = '</PageList>';
      const startIndex = text.indexOf(startTag);
      const endIndex = text.indexOf(endTag);
      if (startIndex >= 0 && endIndex >= 0) {
        return {
          content: [{
            type: "text" as const,
            text: text.substring(startIndex, endIndex + endTag.length),
          }]
        };
      }
      // フォールバック: タグが見つからない場合は全文
    }

    return {
      content: [{
        type: "text" as const,
        text,
      }]
    };
  } catch (error) {
    return formatError(
      error instanceof Error ? error.message : 'Unknown error',
      {
        Operation: 'get_smart_context',
        Project: params.projectName || defaultProjectName,
        Page: params.title,
        Timestamp: new Date().toISOString(),
      },
      params.compact
    );
  }
}
