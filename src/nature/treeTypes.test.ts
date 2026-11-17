import { expect, test } from 'vitest';
import { TREE_TYPES, type TreeType } from './treeTypes';

test('bushes let you walk through them; trees block at the trunk', () => {
  for (const [name, t] of Object.entries(TREE_TYPES) as [string, TreeType][]) expect(!!t.block, name).toBe(!name.endsWith('bush'));
});
