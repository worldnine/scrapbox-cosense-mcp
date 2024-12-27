/** 雑な型を使っている */
import { fetch } from "@whatwg-node/fetch";

const API_DOMAIN = process.env.API_DOMAIN || "cosense.ce";

// /api/pages/:projectname/:pagetitle
type GetPageResponse = {
  id: string;
  title: string;
  lines: {
    text: string;
  }[];
  links: string[];
  relatedPages: {
    links1hop: {
      title: string;
      descriptions: string[];
    }[];
  };
};

async function getPage(
  projectName: string,
  pageName: string,
  sid?: string,
): Promise<GetPageResponse | null> {
  try {
    const response = sid
      ? await fetch(`https://${API_DOMAIN}/api/pages/${projectName}/${encodeURIComponent(pageName)}`, {
          headers: { Cookie: `connect.sid=${sid}` },
        })
      : await fetch(
          `https://${API_DOMAIN}/api/pages/${projectName}/${encodeURIComponent(pageName)}`,
        );

    if (!response.ok) {
      console.error(`API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const page = await response.json();
    
    // レスポンスの型チェック
    if (!page || typeof page !== 'object') {
      console.error('Invalid page response format: not an object');
      return null;
    }

    const typedPage = page as GetPageResponse;
    if (!Array.isArray(typedPage.lines)) {
      console.error('Invalid page response format: lines is not an array');
      return null;
    }

    return typedPage;
  } catch (error) {
    console.error('Error fetching page:', error);
    return null;
  }
}

function toReadablePage(page: GetPageResponse): {
  title: string;
  description: string;
} {
  const lines = Array.isArray(page.lines) ? page.lines.map(line => line.text).join("\n") : '';
  const titleAndDescription = `
${page.title}
---

${lines}
`;

  const relatedPages =
    page.links.length > 0
      ? `## 関連するページのタイトル
${page.links.join("\n")}
`
      : "";
  return {
    title: page.title,
    description: titleAndDescription + "\n" + relatedPages,
  };
}

// /api/pages/:projectname
type ListPagesResponse = {
  limit: number;
  count: number;
  skip: number;
  projectName: string;
  pages: {
    title: string;
  }[];
};

async function listPages(
  projectName: string,
  sid?: string,
): Promise<ListPagesResponse> {
  try {
    const response = sid
      ? await fetch(`https://${API_DOMAIN}/api/pages/${projectName}`, {
          headers: { Cookie: `connect.sid=${sid}` },
        })
      : await fetch(`https://${API_DOMAIN}/api/pages/${projectName}`);
    
    if (!response.ok) {
      console.error(`API error: ${response.status} ${response.statusText}`);
      return {
        limit: 0,
        count: 0,
        skip: 0,
        projectName: projectName,
        pages: []
      };
    }

    const pages = await response.json();
    return pages as ListPagesResponse;
  } catch (error) {
    console.error('Error fetching pages:', error);
    return {
      limit: 0,
      count: 0,
      skip: 0,
      projectName: projectName,
      pages: []
    };
  }
}

function encodeScrapboxBody(body: string): string {
  // Scrapboxの本文用にエンコード
  return encodeURIComponent(body);
}

function createPageUrl(projectName: string, title: string, body?: string): string {
  const baseUrl = `https://${API_DOMAIN}/${projectName}/${encodeURIComponent(title)}`;
  return body ? `${baseUrl}?body=${encodeScrapboxBody(body)}` : baseUrl;
}

export { getPage, listPages, toReadablePage, createPageUrl };
