import showdown from 'showdown';
import { JSDOM } from 'jsdom';

export async function parseContentChunks(chunks: ContentChunk[]): Promise<ContentChunk[]> {
  try {
    const dom = new JSDOM();
    const converter = new showdown.Converter();
    const markdownChunks = chunks.map(chunk => converter.makeMarkdown(chunk, dom.window.document));

    return markdownChunks;
  } catch (e) {
    throw new FailedParseContent(e);
  }
}

export class FailedParseContent extends Error {
  contextMessage = 'Parsing content failed';
}

export type ContentChunk = string;
