import { getImageName, replaceImages } from '../content';

describe('getImageName', () => {
  it('Should obtain the image name from a path', () => {
    const path = '/some/path/can-be_comp.lex@123/foo.jpg';

    expect(getImageName(path)).toBe('foo.jpg');
  });

  it('Should throw when path is invalid', () => {
    expect(() => getImageName('huh')).toThrow('huh');
  });
});

describe('replaceImages', () => {
  const image1 = {
    path: '/some/path/can-be_comp.lex@123/foo.jpg',
    name: 'foo.jpg',
  };

  const image2 = {
    path: '/some/path/can-be_comp.lex@123/bar.jpg',
    name: 'bar.jpg',
  };

  it('Should replace the images in a markdown chunk', () => {
    const chunk = `
      Hello World
      ![REPLACE THIS](<hello/world.jpg> "Something that should be deleted plz. 123@~!")

      And another
      ![Another picture](some/broke._-npath "hello")
    `;

    expect(replaceImages(chunk, [image1, image2])).toMatchInlineSnapshot(`
      "
            Hello World
            ![foo.jpg](./images/foo.jpg)

            And another
            ![bar.jpg](./images/bar.jpg)
          "
    `);
  });
});
