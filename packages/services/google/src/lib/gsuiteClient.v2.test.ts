import { makeGSuiteClientV2 } from './gsuiteClient.v2';
import { makeGSuiteClient } from './gsuiteClient';
import { searchDriveFiles } from './delegates/searchDriveFiles';
import type { DriveSearchParams} from '@codestrap/developer-foundations-types';
import { DriveDateField } from '@codestrap/developer-foundations-types';

// Mock the v1 client
jest.mock('./gsuiteClient');
const mockMakeGSuiteClient = makeGSuiteClient as jest.MockedFunction<typeof makeGSuiteClient>;

// Mock the searchDriveFiles delegate
jest.mock('./delegates/searchDriveFiles');
const mockSearchDriveFiles = searchDriveFiles as jest.MockedFunction<typeof searchDriveFiles>;

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

describe('makeGSuiteClientV2', () => {
  const mockUser = 'test@example.com';
  const mockV1Client = {
    getCalendarClient: jest.fn().mockReturnValue({}),
    getEmailClient: jest.fn().mockReturnValue({}),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMakeGSuiteClient.mockResolvedValue(mockV1Client);
    // Provide a minimal fake service account for v2 drive auth
    const fakeCreds = {
      type: 'service_account',
      project_id: 'test-project',
      private_key_id: 'test-key',
      private_key: 'dummy',
      client_email: 'service@test.iam.gserviceaccount.com',
      client_id: '1234567890',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/service%40test.iam.gserviceaccount.com',
      universe_domain: 'googleapis.com',
    };
    process.env['GSUITE_SERVICE_ACCOUNT'] = Buffer.from(JSON.stringify(fakeCreds)).toString('base64');
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
  });

  describe('searchDriveFiles method', () => {
    it('should call searchDriveFiles delegate with correct parameters', async () => {
      const mockSearchResult = {
        files: [
          {
            id: 'file1',
            name: 'test.pdf',
            mimeType: 'application/pdf',
          },
        ],
        nextPageToken: 'next-token',
        incompleteSearch: false,
      };

      mockSearchDriveFiles.mockResolvedValue(mockSearchResult);

      const client = await makeGSuiteClientV2(mockUser);
      const searchParams: DriveSearchParams = {
        keywords: ['test'],
        mimeType: 'application/pdf',
      };

      const result = await client.searchDriveFiles(searchParams);

      expect(mockSearchDriveFiles).toHaveBeenCalledWith(expect.any(Object), searchParams);
      expect(result).toEqual({
        message: 'Found 1 files matching your search criteria',
        files: mockSearchResult.files,
        totalResults: 1,
        nextPageToken: 'next-token',
        incompleteSearch: false,
      });
    });

    it('should handle empty search results', async () => {
      const mockSearchResult = {
        files: [],
        nextPageToken: undefined,
        incompleteSearch: false,
      };

      mockSearchDriveFiles.mockResolvedValue(mockSearchResult);

      const client = await makeGSuiteClientV2(mockUser);
      const searchParams: DriveSearchParams = {
        keywords: ['nonexistent'],
      };

      const result = await client.searchDriveFiles(searchParams);

      expect(result).toEqual({
        message: 'Found 0 files matching your search criteria',
        files: [],
        totalResults: 0,
        nextPageToken: undefined,
        incompleteSearch: false,
      });
    });

    it('should handle multiple files in search results', async () => {
      const mockSearchResult = {
        files: [
          {
            id: 'file1',
            name: 'test1.pdf',
            mimeType: 'application/pdf',
          },
          {
            id: 'file2',
            name: 'test2.docx',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
          {
            id: 'file3',
            name: 'test3.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        ],
        nextPageToken: 'next-token',
        incompleteSearch: true,
      };

      mockSearchDriveFiles.mockResolvedValue(mockSearchResult);

      const client = await makeGSuiteClientV2(mockUser);
      const searchParams: DriveSearchParams = {
        keywords: ['test'],
      };

      const result = await client.searchDriveFiles(searchParams);

      expect(result).toEqual({
        message: 'Found 3 files matching your search criteria',
        files: mockSearchResult.files,
        totalResults: 3,
        nextPageToken: 'next-token',
        incompleteSearch: true,
      });
    });

    it('should propagate errors from searchDriveFiles delegate', async () => {
      const error = new Error('Search failed');
      mockSearchDriveFiles.mockRejectedValue(error);

      const client = await makeGSuiteClientV2(mockUser);
      const searchParams: DriveSearchParams = {
        keywords: ['test'],
      };

      await expect(client.searchDriveFiles(searchParams)).rejects.toThrow('Search failed');
    });

    it('should handle complex search parameters', async () => {
      const mockSearchResult = {
        files: [
          {
            id: 'file1',
            name: 'project-report.pdf',
            mimeType: 'application/pdf',
          },
        ],
        nextPageToken: undefined,
        incompleteSearch: false,
      };

      mockSearchDriveFiles.mockResolvedValue(mockSearchResult);

      const client = await makeGSuiteClientV2(mockUser);
      const searchParams: DriveSearchParams = {
        keywords: ['project', 'report'],
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          field: DriveDateField.CREATED_TIME,
        },
        mimeType: 'application/pdf',
        owner: 'user@example.com',
        sharedWithMe: true,
        pageSize: 50,
        orderBy: 'createdTime desc',
      };

      const result = await client.searchDriveFiles(searchParams);

      expect(mockSearchDriveFiles).toHaveBeenCalledWith(expect.any(Object), searchParams);
      expect(result.message).toBe('Found 1 files matching your search criteria');
      expect(result.totalResults).toBe(1);
    });
    
  });

  describe('integration with v1 client', () => {
    it('should call makeGSuiteClient with correct user', async () => {
      await makeGSuiteClientV2(mockUser);

      expect(mockMakeGSuiteClient).toHaveBeenCalledWith(mockUser);
    });

    it('should return all v1 client methods plus searchDriveFiles', async () => {
      const client = await makeGSuiteClientV2(mockUser);

      // Check that v2 specific methods are available
      expect(client.searchDriveFiles).toBeDefined();
      expect(client.summarizeCalendars).toBeDefined();
      expect(client.getAvailableMeetingTimes).toBeDefined();
    });

    it('should preserve v1 client functionality', async () => {
      const client = await makeGSuiteClientV2(mockUser);

      // Test that v1 methods are available on the client
      expect(typeof client.getCalendarClient).toBe('function');
      expect(typeof client.getEmailClient).toBe('function');
      expect(typeof client.getDriveClient).toBe('function');
    });
  });

  describe('error handling', () => {
    it('should propagate errors from makeGSuiteClient', async () => {
      const error = new Error('Failed to create v1 client');
      mockMakeGSuiteClient.mockRejectedValue(error);

      await expect(makeGSuiteClientV2(mockUser)).rejects.toThrow('Failed to create v1 client');
    });
  });
});
