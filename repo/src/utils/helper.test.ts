import { generateSlug } from './helper';

describe('generateSlug', () => {
  it('should convert text to URL-safe slug', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });
  it('should handle non-alphanumeric characters', () => {
    expect(generateSlug('Hello, World!')).toBe('hello-world');
  });
  it('should handle multiple spaces', () => {
    expect(generateSlug('Hello   World')).toBe('hello-world');
  });
});