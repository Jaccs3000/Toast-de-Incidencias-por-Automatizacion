import assert from 'node:assert/strict';
import test from 'node:test';

import { jiraDescriptionToText } from '../src/shared/jira/descriptionText.js';

test('converts Jira rich text descriptions to readable text', () => {
  const description = {
    type: 'doc',
    version: 1,
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Primera línea' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Segunda línea' }] },
    ],
  };

  assert.equal(jiraDescriptionToText(description), 'Primera línea\nSegunda línea');
});

test('does not persist an object conversion artifact as a description', () => {
  assert.equal(jiraDescriptionToText('[object Object]'), null);
});
