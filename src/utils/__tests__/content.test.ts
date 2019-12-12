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
    description: '',
    originalPath: 'old/foo/bar/cancion.jpg',
    path: 'hello/canción.jpg',
    name: 'canción.jpg',
  };

  const image2 = {
    description: '',
    originalPath: 'old/another/whatever/picture.jpg',
    path: 'another/picture.jpg',
    name: 'bar.jpg',
  };

  const image3 = {
    description: '',
    originalPath: 'hello/old/inlink.jpg',
    path: 'image/inlink.jpg',
    name: 'baz.jpg',
  };

  it('Should replace the images in a markdown chunk', () => {
    const chunk = `
      <p>Hello World</p>
      <img src="old/foo/bar/cancion.jpg" alt="Hey there, first image" />

      <p>And another</p>
      <img src="old/another/whatever/picture.jpg" />

      <a href="hello/old/inlink.jpg">Hello World</a>
    `;

    expect(replaceImages(chunk, [image1, image2, image3])).toMatchInlineSnapshot(`
      "<p>Hello World</p>
            <img src=\\"./images/canción.jpg\\" alt=\\"Hey there, first image\\">

            <p>And another</p>
            <img src=\\"./images/bar.jpg\\">

            <a href=\\"./images/baz.jpg\\">Hello World</a>
          "
    `);
  });
});
