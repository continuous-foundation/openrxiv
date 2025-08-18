import { describe, it, expect } from 'vitest';
import { preprocessXMLContent } from './meca-processor.js';

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
