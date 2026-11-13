import { ConsentError, PassphraseAuthenticator, DEFAULT_USER_ID } from '../../auth/authenticator.js';

describe('PassphraseAuthenticator', () => {
  const authenticator = new PassphraseAuthenticator('correct-horse-battery');

  it('正しいパスフレーズなら既定の利用者を返す', () => {
    expect(authenticator.authenticate({ passphrase: 'correct-horse-battery' })).toEqual({ id: DEFAULT_USER_ID });
  });

  it.each(['', 'wrong', 'correct-horse-battery ', 'correct-horse-batter'])('違うパスフレーズ %p は ConsentError', (passphrase) => {
    expect(() => authenticator.authenticate({ passphrase })).toThrow(ConsentError);
  });

  it('画面を差し替えて増やした欄は無視する', () => {
    expect(authenticator.authenticate({ passphrase: 'correct-horse-battery', note: 'x' })).toEqual({ id: DEFAULT_USER_ID });
  });
});
