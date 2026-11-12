import { gzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readCollectionFile, resolveCollection } from '../data/collection';

const row = (q: string, cands: object[]) => JSON.stringify({ q, min: 1, count: cands.length, cands });
const c = (name: string, score: number, extra: object = {}) => ({ id: 'x', name, score, ...extra });

describe('resolveCollection', () => {
  it('accepts a score-100 exact name with a country', () => {
    const r = resolveCollection(row('Test Band', [c('Test Band', 100, { country: 'se', area: 'Sweden' })]));
    expect(r.origins['test band']).toEqual({ country: 'SE', area: 'Sweden' });
    expect(r.stats.accepted).toBe(1);
  });

  it('accepts an exact alias and counts it', () => {
    const r = resolveCollection(
      row('Old Name', [c('New Name', 100, { country: 'GB', aliases: ['old name'] })]),
    );
    expect(r.origins['old name']?.country).toBe('GB');
    expect(r.stats.viaAlias).toBe(1);
  });

  it('matches case, spacing and curly apostrophes', () => {
    const r = resolveCollection(row('Guns n’  Roses', [c("guns n' roses", 100, { country: 'US' })]));
    expect(Object.keys(r.origins)).toHaveLength(1);
  });

  it('leaves out ties, near matches, missing country and empty results', () => {
    const text = [
      row('Tie', [c('Tie', 100, { country: 'US' }), c('Tie', 100, { country: 'GB' })]),
      row('Near', [c('Near Miss', 100, { country: 'US' })]),
      row('Low', [c('Low', 90, { country: 'US' })]),
      row('NoCountry', [c('NoCountry', 100)]),
      row('Nothing', []),
    ].join('\n');
    const r = resolveCollection(text);
    expect(r.origins).toEqual({});
    expect(r.stats).toMatchObject({
      total: 5,
      accepted: 0,
      ambiguous: 1,
      noExactMatch: 2,
      noCountry: 1,
      noCandidates: 1,
    });
  });

  it('ignores a tie with a non-100 candidate only when the top is unique', () => {
    const r = resolveCollection(
      row('A', [c('A', 100, { country: 'DE' }), c('A feat. B', 68, { country: 'US' })]),
    );
    expect(r.origins['a']?.country).toBe('DE');
  });

  it('never carries tags into the result', () => {
    const r = resolveCollection(
      row('A', [c('A', 100, { country: 'DE', tags: [{ name: 'rock', count: 3 }] })]),
    );
    expect(JSON.stringify(r)).not.toContain('rock');
  });

  it('counts invalid lines, bad country codes and repeated names once', () => {
    const text = [
      'not json',
      '{"q":1}',
      row('Dup', [c('Dup', 100, { country: 'FR' })]),
      row('Dup', [c('Dup', 100, { country: 'FR' })]),
      row('Bad', [c('Bad', 100, { country: 'Sweden' })]),
    ].join('\n');
    const r = resolveCollection(text);
    expect(r.stats).toMatchObject({ invalid: 2, total: 2, accepted: 1, noCountry: 1 });
  });
});

describe('readCollectionFile', () => {
  const text = row('Gz Band', [c('Gz Band', 100, { country: 'JP' })]) + '\n';
  it('reads plain and gzipped files', async () => {
    const plain = new File([text], 'artists.jsonl');
    const gz = new File([gzipSync(new TextEncoder().encode(text))], 'artists.jsonl.gz');
    expect((await readCollectionFile(plain)).origins['gz band']?.country).toBe('JP');
    expect((await readCollectionFile(gz)).origins['gz band']?.country).toBe('JP');
  });
  it('rejects a file with no artist rows', async () => {
    await expect(readCollectionFile(new File(['{"a":1}\n'], 'x.json'))).rejects.toThrow(/No artist rows/);
  });
});

describe('store.loadCollection', () => {
  it('keeps only artists that are in the loaded history and clears on reset', async () => {
    const { useAppStore } = await import('../state/store');
    useAppStore.setState({
      aggregates: [{ month: '2024-01', artist: 'Mine', track: 't', ms: 1000 }],
    });
    const text = [
      row('Mine', [c('Mine', 100, { country: 'NO' })]),
      row('Not In History', [c('Not In History', 100, { country: 'FR' })]),
    ].join('\n');
    await useAppStore.getState().loadCollection(new File([text], 'artists.jsonl'));
    expect(Object.keys(useAppStore.getState().origins)).toEqual(['mine']);
    expect(useAppStore.getState().collectionStats?.total).toBe(2);
    useAppStore.getState().reset();
    expect(useAppStore.getState().origins).toEqual({});
    expect(useAppStore.getState().collectionStats).toBeNull();
  });
});

describe('fmtMinutes', () => {
  it('rounds fractional minutes instead of printing float noise', async () => {
    const { fmtMinutes } = await import('../data/stats');
    expect(fmtMinutes(723.8640000000003)).toBe('724 min');
    expect(fmtMinutes(8600)).toBe('8.6k min');
  });
});
