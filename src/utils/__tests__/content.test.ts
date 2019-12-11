import { getImageName } from '../content';

describe('getImageName', () => {
  it('Should obtain the image name from a path', () => {
    const path = '/some/path/can-be_comp.lex@123/foo.jpg';

    expect(getImageName(path)).toBe('foo.jpg');
  });

  it('Should throw when path is invalid', () => {
    expect(() => getImageName('huh')).toThrow('huh');
  });
});
