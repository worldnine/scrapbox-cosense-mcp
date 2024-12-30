import md2sbDefault from 'md2sb';

type Md2sbFunction = (input: string | Buffer) => Promise<string>;
const md2sb = md2sbDefault as unknown as Md2sbFunction;

export async function convertMarkdownToScrapbox(markdown: string): Promise<string> {
    const result = await md2sb(markdown);
    return result;
}
