import { describe, it, expect, vi, beforeEach } from 'vitest';
import { preprocessXMLContent } from './meca-processor.js';

// Mock fs module for testing
vi.mock('fs', () => ({
  default: {
    statSync: vi.fn(),
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
}));

describe('preprocessXMLContent - Ampersand Handling', () => {
  it.each([
    {
      name: 'should escape unescaped ampersands',
      input: 'Bill & Melinda Gates Foundation',
      expected: 'Bill &#38; Melinda Gates Foundation',
    },
    {
      name: 'should preserve already escaped ampersands',
      input: 'Bill &amp; Melinda Gates Foundation',
      expected: 'Bill &#38; Melinda Gates Foundation',
    },
    {
      name: 'should preserve numeric entities for ampersands',
      input: 'Bill &#38; Melinda Gates Foundation',
      expected: 'Bill &#38; Melinda Gates Foundation',
    },
    {
      name: 'should handle mixed ampersand scenarios',
      input: 'Company & Associates &amp; Partners &lt; 100',
      expected: 'Company &#38; Associates &#38; Partners &#60; 100',
    },
    {
      name: 'should handle complex academic text with various ampersands',
      input: 'The Bill & Melinda Gates Foundation &amp; European Commission&#39;s Horizon 2020',
      expected:
        'The Bill &#38; Melinda Gates Foundation &#38; European Commission&#39;s Horizon 2020',
    },
    {
      name: 'should handle multiple unescaped ampersands in sequence',
      input: 'A & B & C & D',
      expected: 'A &#38; B &#38; C &#38; D',
    },
    {
      name: 'should preserve valid HTML entities while escaping unescaped ampersands',
      input: 'Temperature &lt; 5 &deg;C &#38; Pressure &gt; 100 &mu;Pa',
      expected: 'Temperature &#60; 5 °C &#38; Pressure &#62; 100 μPa',
    },
    {
      name: 'rsquor',
      input: 'dataset&rsquor;s terms of use.',
      expected: 'dataset’s terms of use.',
    },
  ])('$name', ({ input, expected }) => {
    const result = preprocessXMLContent(input);
    expect(result).toBe(expected);
  });
});

describe('preprocessXMLContent - XML Declaration Reordering', () => {
  it('should reorder XML declaration to first line when it appears after DOCTYPE', () => {
    const input = `<!DOCTYPE article PUBLIC "-//NLM//DTD JATS (Z39.96) Journal Archiving and Interchange DTD v1.2d1 20170631//EN" "JATS-archivearticle1.dtd">
<?xml version="1.0" encoding="UTF-8"?>
<article xmlns:mml="http://www.w3.org/1998/Math/MathML">
  <title>Test Article</title>
</article>`;

    const result = preprocessXMLContent(input);

    // Check that XML declaration is now first
    expect(result.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);

    // Check that DOCTYPE is second
    expect(result.includes('<!DOCTYPE article PUBLIC')).toBe(true);

    // Check that the content is preserved
    expect(result).toContain('<article xmlns:mml="http://www.w3.org/1998/Math/MathML">');
    expect(result).toContain('<title>Test Article</title>');
  });

  it('should trim leading whitespace from XML declaration on first line', () => {
    const input = ` <?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE article PUBLIC "-//NLM//DTD JATS (Z39.96) Journal Archiving and Interchange DTD v1.2d1 20170631//EN" "JATS-archivearticle1.dtd">
<article xmlns:mml="http://www.w3.org/1998/Math/MathML">
  <title>Test Article</title>
</article>`;

    const result = preprocessXMLContent(input);

    // Check that XML declaration is first and has no leading whitespace
    expect(result.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);

    // Check that DOCTYPE is second
    expect(result.includes('<!DOCTYPE article PUBLIC')).toBe(true);

    // Check that the content is preserved
    expect(result).toContain('<article xmlns:mml="http://www.w3.org/1998/Math/MathML">');
    expect(result).toContain('<title>Test Article</title>');
  });

  it('should not reorder when XML declaration is already first', () => {
    const input = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE article PUBLIC "-//NLM//DTD JATS (Z39.96) Journal Archiving and Interchange DTD v1.2d1 20170631//EN" "JATS-archivearticle1.dtd">
<article>
  <title>Test Article</title>
</article>`;

    const result = preprocessXMLContent(input);

    // Should remain unchanged
    expect(result).toBe(input);
  });

  it('should not reorder when XML declaration is beyond 4th line', () => {
    const input = `<!DOCTYPE article PUBLIC "-//NLM//DTD JATS (Z39.96) Journal Archiving and Interchange DTD v1.2d1 20170631//EN" "JATS-archivearticle1.dtd">
<article>
  <title>Test Article</title>
  <abstract>This is a test abstract</abstract>
  <body>Test body content</body>
<?xml version="1.0" encoding="UTF-8"?>
</article>`;

    const result = preprocessXMLContent(input);

    // Should not reorder since XML declaration is on the 5th line (index 4)
    // and we only reorder if it's within the first 4 lines (indices 0-3)
    expect(result).toBe(input);
  });

  it('should handle case with no XML declaration', () => {
    const input = `<!DOCTYPE article PUBLIC "-//NLM//DTD JATS (Z39.96) Journal Archiving and Interchange DTD v1.2d1 20170631//EN" "JATS-archivearticle1.dtd">
<article>
  <title>Test Article</title>
</article>`;

    const result = preprocessXMLContent(input);

    // Should remain unchanged
    expect(result).toBe(input);
  });
});
