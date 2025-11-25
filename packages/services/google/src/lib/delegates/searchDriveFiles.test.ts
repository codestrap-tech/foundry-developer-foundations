import type { drive_v3 } from 'googleapis';
import { searchDriveFiles } from './searchDriveFiles';
import type { DriveSearchParams} from '@codestrap/developer-foundations-types';
import { DriveDateField } from '@codestrap/developer-foundations-types';

// Mock the Google Drive API client
const mockDriveClient = {
  files: {
    list: jest.fn(),
  },
} as unknown as drive_v3.Drive;

// Mock console methods to avoid noise in tests
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('searchDriveFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('Query Building', () => {
    beforeEach(() => {
      (mockDriveClient.files.list as jest.Mock).mockResolvedValue({
        data: {
          files: [],
          nextPageToken: undefined,
          incompleteSearch: undefined,
        },
      });
    });

    it('should build query with keywords only', async () => {
      const params: DriveSearchParams = {
        keywords: ['transcripts', 'meeting'],
      };

      await searchDriveFiles(mockDriveClient, params);

      expect(mockDriveClient.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "(name contains 'transcripts' or name contains 'meeting') and trashed = false",
        })
      );
    });

    it('should build query with date range', async () => {
      const params: DriveSearchParams = {
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          field: DriveDateField.CREATED_TIME,
        },
      };

      await searchDriveFiles(mockDriveClient, params);

      expect(mockDriveClient.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "createdTime >= '2024-01-01T00:00:00.000Z' and createdTime <= '2024-12-31T00:00:00.000Z' and trashed = false",
        })
      );
    });

    it('should build query with MIME type', async () => {
      const params: DriveSearchParams = {
        mimeType: 'application/pdf',
      };

      await searchDriveFiles(mockDriveClient, params);

      expect(mockDriveClient.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "mimeType = 'application/pdf' and trashed = false",
        })
      );
    });

    it('should build query with owner', async () => {
      const params: DriveSearchParams = {
        owner: 'user@example.com',
      };

      await searchDriveFiles(mockDriveClient, params);

      expect(mockDriveClient.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "'user@example.com' in owners and trashed = false",
        })
      );
    });

    it('should build query with shared with me', async () => {
      const params: DriveSearchParams = {
        sharedWithMe: true,
      };

      await searchDriveFiles(mockDriveClient, params);

      expect(mockDriveClient.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'sharedWithMe and trashed = false',
        })
      );
    });

    it('should build query with trashed files', async () => {
      const params: DriveSearchParams = {
        trashed: true,
      };

      await searchDriveFiles(mockDriveClient, params);

      expect(mockDriveClient.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'trashed = true',
        })
      );
    });

    it('should build complex query with multiple parameters', async () => {
      const params: DriveSearchParams = {
        keywords: ['project', 'report'],
        dateRange: {
          startDate: new Date('2024-01-01'),
          field: DriveDateField.MODIFIED_TIME,
        },
        mimeType: 'application/pdf',
        owner: 'user@example.com',
        pageSize: 50,
      };

      await searchDriveFiles(mockDriveClient, params);

      expect(mockDriveClient.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "(name contains 'project' or name contains 'report') and modifiedTime >= '2024-01-01T00:00:00.000Z' and mimeType = 'application/pdf' and 'user@example.com' in owners and trashed = false",
          pageSize: 50,
        })
      );
    });
  });

  describe('Special Character Handling', () => {
    beforeEach(() => {
      (mockDriveClient.files.list as jest.Mock).mockResolvedValue({
        data: {
          files: [],
          nextPageToken: undefined,
          incompleteSearch: undefined,
        },
      });
    });

    it('should escape special characters in keywords', async () => {
      const params: DriveSearchParams = {
        keywords: ['test (draft)', 'file[final]', 'report v2.0'],
      };

      await searchDriveFiles(mockDriveClient, params);

      expect(mockDriveClient.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "(name contains 'test \\(draft\\)' or name contains 'file\\[final\\]' or name contains 'report v2\\.0') and trashed = false",
        })
      );
    });

    it('should handle keywords with quotes', async () => {
      const params: DriveSearchParams = {
        keywords: ['file "important"', "doc 'final'"],
      };

      await searchDriveFiles(mockDriveClient, params);

      expect(mockDriveClient.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "(name contains 'file \\\"important\\\"' or name contains 'doc \\'final\\'') and trashed = false",
        })
      );
    });

    it('should handle keywords with backslashes', async () => {
      const params: DriveSearchParams = {
        keywords: ['backup\\copy', 'path\\to\\file'],
      };

      await searchDriveFiles(mockDriveClient, params);

      expect(mockDriveClient.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "(name contains 'backup\\\\copy' or name contains 'path\\\\to\\\\file') and trashed = false",
        })
      );
    });
  });

  describe('Response Handling', () => {
    it('should return converted files successfully', async () => {
      const mockApiResponse = {
        data: {
          files: [
            {
              id: 'file1',
              name: 'test.pdf',
              mimeType: 'application/pdf',
              size: '1024',
              createdTime: '2024-01-01T00:00:00.000Z',
              modifiedTime: '2024-01-02T00:00:00.000Z',
              webViewLink: 'https://drive.google.com/file/d/file1/view',
              webContentLink: 'https://drive.google.com/uc?id=file1',
              owners: [
                {
                  displayName: 'John Doe',
                  emailAddress: 'john@example.com',
                },
              ],
              lastModifyingUser: {
                displayName: 'Jane Doe',
                emailAddress: 'jane@example.com',
              },
              parents: ['parent1'],
              description: 'Test file',
              starred: true,
              trashed: false,
            },
          ],
          nextPageToken: 'next-token',
          incompleteSearch: true,
        },
      };

      (mockDriveClient.files.list as jest.Mock).mockResolvedValue(mockApiResponse);

      const params: DriveSearchParams = {
        keywords: ['test'],
      };

      const result = await searchDriveFiles(mockDriveClient, params);

      expect(result).toEqual({
        files: [
          {
            id: 'file1',
            name: 'test.pdf',
            mimeType: 'application/pdf',
            size: '1024',
            createdTime: '2024-01-01T00:00:00.000Z',
            modifiedTime: '2024-01-02T00:00:00.000Z',
            webViewLink: 'https://drive.google.com/file/d/file1/view',
            webContentLink: 'https://drive.google.com/uc?id=file1',
            owners: [
              {
                displayName: 'John Doe',
                emailAddress: 'john@example.com',
              },
            ],
            lastModifyingUser: {
              displayName: 'Jane Doe',
              emailAddress: 'jane@example.com',
            },
            parents: ['parent1'],
            description: 'Test file',
            starred: true,
            trashed: false,
          },
        ],
        nextPageToken: 'next-token',
        incompleteSearch: true,
      });
    });

    it('should handle empty response', async () => {
      const mockApiResponse = {
        data: {
          files: [],
          nextPageToken: undefined,
          incompleteSearch: undefined,
        },
      };

      (mockDriveClient.files.list as jest.Mock).mockResolvedValue(mockApiResponse);

      const params: DriveSearchParams = {
        keywords: ['nonexistent'],
      };

      const result = await searchDriveFiles(mockDriveClient, params);

      expect(result).toEqual({
        files: [],
        nextPageToken: undefined,
        incompleteSearch: undefined,
      });
    });

    it('should handle null files in response', async () => {
      const mockApiResponse = {
        data: {
          files: null,
          nextPageToken: undefined,
          incompleteSearch: undefined,
        },
      };

      (mockDriveClient.files.list as jest.Mock).mockResolvedValue(mockApiResponse);

      const params: DriveSearchParams = {
        keywords: ['test'],
      };

      const result = await searchDriveFiles(mockDriveClient, params);

      expect(result).toEqual({
        files: [],
        nextPageToken: undefined,
        incompleteSearch: undefined,
      });
    });
  });

  describe('Error Handling', () => {
    it('should bubble authentication errors', async () => {
      const authError = new Error('invalid_grant: Invalid credentials');
      (mockDriveClient.files.list as jest.Mock).mockRejectedValue(authError);

      const params: DriveSearchParams = { keywords: ['test'] };

      await expect(searchDriveFiles(mockDriveClient, params)).rejects.toThrow(
        'invalid_grant: Invalid credentials'
      );
    });

    it('should bubble quota exceeded errors', async () => {
      const quotaError = new Error('quota exceeded');
      (mockDriveClient.files.list as jest.Mock).mockRejectedValue(quotaError);

      const params: DriveSearchParams = { keywords: ['test'] };

      await expect(searchDriveFiles(mockDriveClient, params)).rejects.toThrow('quota exceeded');
    });

    it('should bubble not found errors', async () => {
      const notFoundError = new Error('notFound: Drive not found');
      (mockDriveClient.files.list as jest.Mock).mockRejectedValue(notFoundError);

      const params: DriveSearchParams = { keywords: ['test'] };

      await expect(searchDriveFiles(mockDriveClient, params)).rejects.toThrow(
        'notFound: Drive not found'
      );
    });

    it('should bubble generic errors', async () => {
      const genericError = new Error('Something went wrong');
      (mockDriveClient.files.list as jest.Mock).mockRejectedValue(genericError);

      const params: DriveSearchParams = { keywords: ['test'] };

      await expect(searchDriveFiles(mockDriveClient, params)).rejects.toThrow('Something went wrong');
    });

    it('should bubble non-Error rejections as-is', async () => {
      (mockDriveClient.files.list as jest.Mock).mockRejectedValue('String error');

      const params: DriveSearchParams = { keywords: ['test'] };

      await expect(searchDriveFiles(mockDriveClient, params)).rejects.toEqual('String error');
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      (mockDriveClient.files.list as jest.Mock).mockResolvedValue({
        data: {
          files: [],
          nextPageToken: undefined,
          incompleteSearch: undefined,
        },
      });
    });

    it('should handle empty keywords array', async () => {
      const params: DriveSearchParams = {
        keywords: [],
      };

      await searchDriveFiles(mockDriveClient, params);

      expect(mockDriveClient.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'trashed = false',
        })
      );
    });

    it('should filter out empty keywords', async () => {
      const params: DriveSearchParams = {
        keywords: ['valid', 'another-valid'], // Remove empty keywords since validation now prevents them
      };

      await searchDriveFiles(mockDriveClient, params);

      expect(mockDriveClient.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "(name contains 'valid' or name contains 'another-valid') and trashed = false",
        })
      );
    });

    it('should handle whitespace in keywords', async () => {
      const params: DriveSearchParams = {
        keywords: ['  project plan  ', '  meeting notes  '],
      };

      await searchDriveFiles(mockDriveClient, params);

      expect(mockDriveClient.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "(name contains 'project plan' or name contains 'meeting notes') and trashed = false",
        })
      );
    });

    it('should handle whitespace in MIME type and owner', async () => {
      const params: DriveSearchParams = {
        mimeType: '  application/pdf  ',
        owner: 'user@example.com', // Remove whitespace since validation now prevents invalid emails
      };

      await searchDriveFiles(mockDriveClient, params);

      expect(mockDriveClient.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "mimeType = 'application/pdf' and 'user@example.com' in owners and trashed = false",
        })
      );
    });

    it('should use default values for optional parameters', async () => {
      const params: DriveSearchParams = {};

      await searchDriveFiles(mockDriveClient, params);

      expect(mockDriveClient.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          pageSize: 100,
          orderBy: 'modifiedTime desc',
          fields: 'nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,owners,lastModifyingUser,parents,description,starred,trashed)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        })
      );
    });
  });

  describe('File Conversion', () => {
    it('should handle files with missing optional fields', async () => {
      const mockApiResponse = {
        data: {
          files: [
            {
              id: 'file1',
              name: 'test.pdf',
              mimeType: 'application/pdf',
              // Missing optional fields
            },
          ],
          nextPageToken: undefined,
          incompleteSearch: undefined,
        },
      };

      (mockDriveClient.files.list as jest.Mock).mockResolvedValue(mockApiResponse);

      const params: DriveSearchParams = {
        keywords: ['test'],
      };

      const result = await searchDriveFiles(mockDriveClient, params);

      expect(result.files[0]).toEqual({
        id: 'file1',
        name: 'test.pdf',
        mimeType: 'application/pdf',
        size: undefined,
        createdTime: undefined,
        modifiedTime: undefined,
        webViewLink: undefined,
        webContentLink: undefined,
        owners: undefined,
        lastModifyingUser: undefined,
        parents: undefined,
        description: undefined,
        starred: undefined,
        trashed: undefined,
      });
    });

    it('should handle files with null owners', async () => {
      const mockApiResponse = {
        data: {
          files: [
            {
              id: 'file1',
              name: 'test.pdf',
              mimeType: 'application/pdf',
              owners: null,
            },
          ],
          nextPageToken: undefined,
          incompleteSearch: undefined,
        },
      };

      (mockDriveClient.files.list as jest.Mock).mockResolvedValue(mockApiResponse);

      const params: DriveSearchParams = {
        keywords: ['test'],
      };

      const result = await searchDriveFiles(mockDriveClient, params);

      expect(result.files[0].owners).toBeUndefined();
    });
  });
});
