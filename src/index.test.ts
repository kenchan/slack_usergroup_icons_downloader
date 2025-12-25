import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebClient } from '@slack/web-api';
import { SlackUsergroupIconsDownloader } from './index.js';

vi.mock('@slack/web-api');

vi.mock('fs/promises');
vi.mock('fs');
vi.mock('stream/promises');
vi.mock('stream', async (importOriginal) => {
  const actual = await importOriginal<typeof import('stream')>();
  return {
    ...actual,
    Readable: {
      ...actual.Readable,
      fromWeb: vi.fn().mockReturnValue(actual.Readable.from(['mock data'])),
    },
  };
});

global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    body: {} as any,
  } as Response)
);

describe('SlackUsergroupIconsDownloader', () => {
  let downloader: SlackUsergroupIconsDownloader;
  let mockWebClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { mkdir } = await import('fs/promises');
    const { createWriteStream } = await import('fs');
    const { pipeline } = await import('stream/promises');

    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(createWriteStream).mockReturnValue({
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
    } as any);
    vi.mocked(pipeline).mockResolvedValue(undefined);

    mockWebClient = {
      usergroups: {
        list: vi.fn(),
        users: {
          list: vi.fn(),
        },
      },
      users: {
        info: vi.fn(),
      },
    };

    vi.mocked(WebClient).mockImplementation(function(this: any) {
      return mockWebClient;
    } as any);

    downloader = new SlackUsergroupIconsDownloader({ token: 'test-token' });
  });

  describe('resolveUsergroupId', () => {
    it('有効なUsergroup IDを渡すとAPI呼び出しをせずにそのまま返す', async () => {
      mockWebClient.usergroups.users.list.mockResolvedValue({
        ok: true,
        users: [],
      });

      await downloader.downloadUsergroupIcons('S12345678');

      expect(mockWebClient.usergroups.list).not.toHaveBeenCalled();
      expect(mockWebClient.usergroups.users.list).toHaveBeenCalledWith({
        usergroup: 'S12345678',
      });
    });

    it('usergroupハンドル名を渡すとAPI呼び出してIDを取得する', async () => {
      mockWebClient.usergroups.list.mockResolvedValue({
        ok: true,
        usergroups: [
          { id: 'S12345678', handle: 'engineers' },
        ],
      });
      mockWebClient.usergroups.users.list.mockResolvedValue({
        ok: true,
        users: [],
      });

      await downloader.downloadUsergroupIcons('engineers');

      expect(mockWebClient.usergroups.list).toHaveBeenCalled();
      expect(mockWebClient.usergroups.users.list).toHaveBeenCalledWith({
        usergroup: 'S12345678',
      });
    });

    it('存在しないusergroupハンドル名を渡すとエラーをthrowする', async () => {
      mockWebClient.usergroups.list.mockResolvedValue({
        ok: true,
        usergroups: [],
      });

      await expect(
        downloader.downloadUsergroupIcons('nonexistent')
      ).rejects.toThrow('Usergroup not found: nonexistent');
    });
  });

  describe('エラーハンドリング', () => {
    it('usergroups.listでmissing_scopeエラーが発生すると詳細なメッセージを表示', async () => {
      const error = new Error('missing_scope');
      (error as any).data = { error: 'missing_scope' };
      mockWebClient.usergroups.list.mockRejectedValue(error);

      await expect(
        downloader.downloadUsergroupIcons('engineers')
      ).rejects.toThrow(/usergroups:read/);
    });

    it('usergroups.users.listでAPIエラーが発生するとエラーをthrowする', async () => {
      mockWebClient.usergroups.users.list.mockResolvedValue({
        ok: false,
        error: 'invalid_auth',
      });

      await expect(
        downloader.downloadUsergroupIcons('S12345678')
      ).rejects.toThrow('API error (usergroups.users.list): invalid_auth');
    });
  });

  describe('downloadUsergroupIcons', () => {
    it('メンバーが0人の場合はダウンロード処理を行わない', async () => {
      mockWebClient.usergroups.users.list.mockResolvedValue({
        ok: true,
        users: [],
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await downloader.downloadUsergroupIcons('S12345678');

      expect(consoleLogSpy).toHaveBeenCalledWith('No members found in the usergroup.');
      expect(mockWebClient.users.info).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });
  });
});
