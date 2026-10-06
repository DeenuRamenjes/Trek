import { emitDbChanged, onDbChanged } from '../changes';

describe('db change scopes', () => {
  it('defaults to all and passes the logs scope through', () => {
    const seen: string[] = [];
    const off = onDbChanged((scope) => seen.push(scope));
    emitDbChanged();
    emitDbChanged('logs');
    off();
    emitDbChanged();
    expect(seen).toEqual(['all', 'logs']);
  });
});
