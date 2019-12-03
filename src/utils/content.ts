import showdown from 'showdown';
import { JSDOM } from 'jsdom';

export async function parseContentChunks(chunks: string[]): Promise<void> {
  try {
    const dom = new JSDOM();
    console.log('DOCUMENT', dom.window.document);
    const converter = new showdown.Converter();
    const markdownChunks = chunks.map(chunk => converter.makeMarkdown(chunk, dom.window.document));
    console.log(markdownChunks);
  } catch (e) {
    console.log(e);
    throw new FailedParseContent(e);
  }
}

export class FailedParseContent extends Error {
  contextMessage = 'Parsing content failed';
}
