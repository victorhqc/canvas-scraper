import { cleanupDefinitionTables, replaceTableForText } from '../markdown';

describe('cleanupDefinitionTables', () => {
  it('Should cleanup definition tables', () => {
    const html = `
      <div>
        <table>
          <td class="definicion"><strong>Hello:</strong>World</td>
        </table>
        <p>This should be unchanged</p>
        <table>
          <td class="foo"><strong>Foo Bar:</strong> Another definition.</td>
        </table>
        <table class="im-not-a-definition">
          <td>Hello World</td>
        </table>
      </div>
    `;

    expect(cleanupDefinitionTables(html)).toMatchInlineSnapshot(`
      "
            <div>
              <blockquote><strong>Hello:</strong>World</blockquote>
              <p>This should be unchanged</p>
              <blockquote><strong>Foo Bar:</strong> Another definition.</blockquote>
              <table class=\\"im-not-a-definition\\">
                <tbody><tr><td>Hello World</td>
              </tr></tbody></table>
            </div>
          "
    `);
  });
});

describe('replaceTableForText', () => {
  it('Should replace table elements for just text', () => {
    const html = `
      <table>
        <thead>
          <tr><td>Name</td><td>Description</td></tr>
        </thead>
        <tbody>
          <tr><td><strong>Foo:</strong></td><td>Something, lalala</td></tr>
          <tr><td><strong>Bar:</strong></td><td>Something, lololo</td></tr>
        </tbody>
      </table>
    `;

    expect(replaceTableForText(html)).toMatchInlineSnapshot(`
      "
            <p>Name |Description |</p><p><strong>Foo:</strong> |Something, lalala |</p><p><strong>Bar:</strong> |Something, lololo |</p>
          "
    `);
  });
});
