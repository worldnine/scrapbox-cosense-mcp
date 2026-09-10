import {
  getProjectAllowList,
  isProjectAllowed,
  projectNotAllowedMessage,
  checkProjectAllowed,
} from '@/utils/project.js';

describe('COSENSE_PROJECT_ALLOW_LIST', () => {
  const originalAllowList = process.env.COSENSE_PROJECT_ALLOW_LIST;
  const originalProjectName = process.env.COSENSE_PROJECT_NAME;

  beforeEach(() => {
    process.env.COSENSE_PROJECT_NAME = 'default-project';
  });

  afterEach(() => {
    if (originalAllowList === undefined) {
      delete process.env.COSENSE_PROJECT_ALLOW_LIST;
    } else {
      process.env.COSENSE_PROJECT_ALLOW_LIST = originalAllowList;
    }
    if (originalProjectName === undefined) {
      delete process.env.COSENSE_PROJECT_NAME;
    } else {
      process.env.COSENSE_PROJECT_NAME = originalProjectName;
    }
  });

  describe('getProjectAllowList', () => {
    test('未設定なら undefined（無制限）を返すこと', () => {
      delete process.env.COSENSE_PROJECT_ALLOW_LIST;
      expect(getProjectAllowList()).toBeUndefined();
    });

    test('空白のみなら空配列を返すこと（設定されている以上は制限モード）', () => {
      process.env.COSENSE_PROJECT_ALLOW_LIST = '   ';
      expect(getProjectAllowList()).toEqual([]);
    });

    test('空文字なら空配列を返すこと', () => {
      process.env.COSENSE_PROJECT_ALLOW_LIST = '';
      expect(getProjectAllowList()).toEqual([]);
    });

    test('カンマ区切りを分割すること', () => {
      process.env.COSENSE_PROJECT_ALLOW_LIST = 'alpha,beta';
      expect(getProjectAllowList()).toEqual(['alpha', 'beta']);
    });

    test('各要素の前後の空白をトリムし、空要素を無視すること', () => {
      process.env.COSENSE_PROJECT_ALLOW_LIST = ' alpha , , beta ,';
      expect(getProjectAllowList()).toEqual(['alpha', 'beta']);
    });

    test('カンマだけなら空配列を返すこと', () => {
      process.env.COSENSE_PROJECT_ALLOW_LIST = ',,,';
      expect(getProjectAllowList()).toEqual([]);
    });

    test('呼び出しごとに環境変数を読み直すこと', () => {
      process.env.COSENSE_PROJECT_ALLOW_LIST = 'alpha';
      expect(getProjectAllowList()).toEqual(['alpha']);
      process.env.COSENSE_PROJECT_ALLOW_LIST = 'beta';
      expect(getProjectAllowList()).toEqual(['beta']);
    });
  });

  describe('isProjectAllowed', () => {
    test('未設定ならどのプロジェクトも許可されること（後方互換）', () => {
      delete process.env.COSENSE_PROJECT_ALLOW_LIST;
      expect(isProjectAllowed('anything')).toBe(true);
    });

    test('リストに含まれるプロジェクトを許可すること', () => {
      process.env.COSENSE_PROJECT_ALLOW_LIST = 'alpha,beta';
      expect(isProjectAllowed('beta')).toBe(true);
    });

    test('リストに無いプロジェクトを拒否すること', () => {
      process.env.COSENSE_PROJECT_ALLOW_LIST = 'alpha,beta';
      expect(isProjectAllowed('gamma')).toBe(false);
    });

    test('既定プロジェクトはリストに書かれていなくても許可されること', () => {
      process.env.COSENSE_PROJECT_ALLOW_LIST = 'alpha';
      expect(isProjectAllowed('default-project')).toBe(true);
    });

    test('実質空の許可リストなら既定プロジェクトだけが許可されること', () => {
      // 「設定したつもりで無制限」より「既定プロジェクトだけ許可」に倒す
      process.env.COSENSE_PROJECT_ALLOW_LIST = ',,,';
      expect(isProjectAllowed('default-project')).toBe(true);
      expect(isProjectAllowed('alpha')).toBe(false);
    });

    test('空文字の許可リストでも制限がかかること', () => {
      process.env.COSENSE_PROJECT_ALLOW_LIST = '';
      expect(isProjectAllowed('default-project')).toBe(true);
      expect(isProjectAllowed('alpha')).toBe(false);
    });

    test('大文字小文字を区別すること', () => {
      process.env.COSENSE_PROJECT_ALLOW_LIST = 'alpha';
      expect(isProjectAllowed('Alpha')).toBe(false);
    });

    test('COSENSE_PROJECT_NAME が未設定でもリストだけで判定できること', () => {
      delete process.env.COSENSE_PROJECT_NAME;
      process.env.COSENSE_PROJECT_ALLOW_LIST = 'alpha';
      expect(isProjectAllowed('alpha')).toBe(true);
      expect(isProjectAllowed('beta')).toBe(false);
    });

    test('既定プロジェクトの判定に呼び出し側の引数を使わないこと', () => {
      // CLI は --project=NAME の値をそのまま defaultProjectName としてハンドラに渡すため、
      // 引数を基準にすると「指定した名前＝既定」が常に成立して許可リストが素通りになる
      process.env.COSENSE_PROJECT_NAME = 'allowed-default';
      process.env.COSENSE_PROJECT_ALLOW_LIST = 'allowed-default';
      expect(isProjectAllowed('forbidden-project')).toBe(false);
    });
  });

  describe('projectNotAllowedMessage', () => {
    test('許可済みプロジェクトの一覧を含むこと', () => {
      process.env.COSENSE_PROJECT_ALLOW_LIST = 'alpha,beta';
      const message = projectNotAllowedMessage('gamma');
      expect(message).toContain("Project 'gamma' is not allowed");
      expect(message).toContain('COSENSE_PROJECT_ALLOW_LIST');
      expect(message).toContain('default-project, alpha, beta');
    });

    test('暗黙に許可される既定プロジェクトを一覧に含めること', () => {
      process.env.COSENSE_PROJECT_ALLOW_LIST = 'alpha';
      expect(projectNotAllowedMessage('gamma')).toContain('default-project');
    });

    test('許可されるものが1つも無ければ (none) と出すこと', () => {
      delete process.env.COSENSE_PROJECT_NAME;
      process.env.COSENSE_PROJECT_ALLOW_LIST = ',,,';
      expect(projectNotAllowedMessage('gamma')).toContain('Permitted projects: (none)');
    });

    test('既定プロジェクトがリストにもある場合に重複させないこと', () => {
      process.env.COSENSE_PROJECT_ALLOW_LIST = 'default-project,alpha';
      expect(projectNotAllowedMessage('gamma'))
        .toContain('Permitted projects: default-project, alpha');
    });
  });

  describe('checkProjectAllowed', () => {
    test('許可されていれば undefined を返すこと', () => {
      process.env.COSENSE_PROJECT_ALLOW_LIST = 'alpha';
      expect(checkProjectAllowed('alpha')).toBeUndefined();
    });

    test('未設定なら undefined を返すこと', () => {
      delete process.env.COSENSE_PROJECT_ALLOW_LIST;
      expect(checkProjectAllowed('anything')).toBeUndefined();
    });

    test('拒否時はメッセージ文字列を返すこと（例外は投げない）', () => {
      process.env.COSENSE_PROJECT_ALLOW_LIST = 'alpha';
      expect(checkProjectAllowed('gamma'))
        .toBe(projectNotAllowedMessage('gamma'));
    });
  });
});
