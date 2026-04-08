import { QueryKeys } from './query-keys';

describe('QueryKeys', () => {
  test('builds stable A2A keys', () => {
    expect(QueryKeys.a2a.stats()).toEqual(['a2a', 'stats']);
    expect(QueryKeys.a2a.assets()).toEqual(['a2a', 'assets', {}]);
    expect(QueryKeys.a2a.assets({ type: 'Gene' })).toEqual([
      'a2a',
      'assets',
      { type: 'Gene' },
    ]);
    expect(QueryKeys.a2a.assetLineage('sha256:demo')).toEqual([
      'a2a',
      'asset',
      'sha256:demo',
      'lineage',
    ]);
  });

  test('builds search, task, and swarm keys with predictable defaults', () => {
    expect(QueryKeys.assets.search('security')).toEqual([
      'assets',
      'search',
      'security',
      1,
    ]);
    expect(QueryKeys.task.list('proj-1')).toEqual(['task', 'list', 'proj-1', 1]);
    expect(QueryKeys.swarm.list()).toEqual(['swarm', 'list']);
  });
});
