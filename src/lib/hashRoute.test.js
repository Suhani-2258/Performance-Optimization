import { describe, it, expect, beforeEach } from 'vitest';
import { parseHash, buildHash, navigate } from './hashRoute';

describe('parseHash', () => {
  it.each([['', 'summary'], ['#', 'summary'], ['#summary', 'summary'], ['#records', 'records'], ['#add-record', 'add-record'], ['#nonsense', 'summary'], ['#main', 'summary']])(
    '%j -> %s', (hash, route) => expect(parseHash(hash).route).toBe(route));
  it('parses query params', () => {
    expect(parseHash('#records?status=Completed')).toEqual({ route: 'records', params: { status: 'Completed' } });
    expect(parseHash('#records?status=Pending&focus=average').params).toEqual({ status: 'Pending', focus: 'average' });
  });
  it('ignores params on unknown routes and survives malformed encoding', () => {
    expect(parseHash('#nope?status=Pending').params).toEqual({});
    expect(() => parseHash('#records?status=%E0%A4%A')).not.toThrow();
  });
});

describe('buildHash', () => {
  it('builds canonical hashes and omits empty params', () => {
    expect(buildHash('records')).toBe('#records');
    expect(buildHash('records', { status: 'Completed' })).toBe('#records?status=Completed');
    expect(buildHash('records', { status: undefined, focus: '' })).toBe('#records');
    expect(buildHash('add-record', {})).toBe('#add-record');
  });
});

describe('navigate', () => {
  beforeEach(() => window.history.replaceState(null, '', window.location.pathname));
  it('pushes one history entry and ignores navigation to the current hash', () => {
    const before = window.history.length;
    navigate('records');
    navigate('records');
    expect(window.location.hash).toBe('#records');
    expect(window.history.length).toBe(before + 1);
  });
  it('can replace instead of push', () => {
    navigate('records');
    const before = window.history.length;
    navigate('records', { status: 'Pending' }, { replace: true });
    expect(window.history.length).toBe(before);
    expect(window.location.hash).toBe('#records?status=Pending');
  });
});

describe('analytics, activity and edit routes', () => {
  it.each([['#analytics', 'analytics'], ['#activity', 'activity'], ['#edit-record', 'edit-record']])('%s is a route', (h, r) => expect(parseHash(h).route).toBe(r));
  it('parses and round-trips an id parameter, including special characters', () => {
    expect(parseHash('#edit-record?id=2')).toEqual({ route: 'edit-record', params: { id: '2' } });
    const h = buildHash('edit-record', { id: 'a b&c#d' });
    expect(parseHash(h)).toEqual({ route: 'edit-record', params: { id: 'a b&c#d' } });
  });
});
