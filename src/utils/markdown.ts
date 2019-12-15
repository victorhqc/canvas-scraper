// import { TPage as Page } from 'foxr';
import { JSDOM } from 'jsdom';
import showdown from 'showdown';
import cheerio from 'cheerio';
import { ContentChunk } from './content';

export function cleanupDefinitionTables(chunk: ContentChunk): ContentChunk {
  const dom = new JSDOM(`<!DOCTYPE html><body><div id="CANVAS_SCRAPER">${chunk}</div></body>`);
  const doc = dom.window.document;
  const element = doc.querySelector('#CANVAS_SCRAPER');
  if (!element) {
    throw new CleanMarkdownError('Tables definition cleanup failed');
  }

  const reduce = Array.prototype.reduce;

  const tables = doc.querySelectorAll('table');
  tables.forEach(table => {
    if (table.classList.length > 0) return;
    const tdWithDefinition = reduce.call<
      NodeListOf<HTMLTableDataCellElement>,
      CleanTablesReducer[],
      HTMLTableDataCellElement | null
    >(table.querySelectorAll('td'), (acc, td) => {
      const className = td.getAttribute('class');
      if (acc || !className) return acc;

      if (className.match(/definicion/gi)) {
        return td;
      }

      return acc;
    });

    if (!tdWithDefinition) return;

    const blockquote = doc.createElement('blockquote');
    blockquote.innerHTML = tdWithDefinition.innerHTML;

    replaceElement(blockquote, table, doc);
  });

  return element.innerHTML;
}

export function replaceTableForText(chunk: ContentChunk): ContentChunk {
  const dom = new JSDOM(`<!DOCTYPE html><body><div id="CANVAS_SCRAPER">${chunk}</div></body>`);
  const doc = dom.window.document;
  const element = doc.querySelector('#CANVAS_SCRAPER');
  if (!element) {
    throw new CleanMarkdownError('Tables definition cleanup failed');
  }

  const tables = element.querySelectorAll('table');

  tables.forEach(table => {
    Array.prototype.forEach.call(table.rows, (row: HTMLTableRowElement) => {
      const paragraph = doc.createElement('p');

      let content = '';
      for (let i = 0; i < row.cells.length; i++) {
        const cell = row.cells[i];

        content += `${cell.innerHTML} |`;
      }

      paragraph.innerHTML = `${content}`;
      table.parentNode?.insertBefore(paragraph, table);
    });
  });

  element.querySelectorAll('table').forEach(table => table.remove());

  return element.innerHTML;
}

export function sanitizeMarkdown(chunk: ContentChunk): ContentChunk {
  const dom = new JSDOM();
  const converter = new showdown.Converter();
  const $ = cheerio.load(chunk, { decodeEntities: false });
  const text = $('body').text();

  const markdownChunk = converter.makeMarkdown(chunk, dom.window.document);

  if (markdownChunk.length <= text.length * 0.4) {
    return `
  **FAILED MARKDOWN PARSING**

  Original HTML
  \`\`\`html
  ${$('body').html()}
  \`\`\`

  Failed Markdown Parsing
  \`\`\`markdown
  ${markdownChunk}
  \`\`\`
  `;
  }

  return markdownChunk;
}

function replaceElement(newElement: HTMLElement, oldElement: HTMLElement, doc: Document): void {
  let parentNode = oldElement.parentNode;
  if (!parentNode) {
    parentNode = doc;
  }

  parentNode.replaceChild(newElement, oldElement);
}

export class CleanMarkdownError extends Error {
  contextMessage = "Can't cleanup Markdown text";
}

type CleanTablesReducer = (
  acc: HTMLTableDataCellElement | null,
  element: HTMLTableDataCellElement
) => HTMLTableDataCellElement | null;
