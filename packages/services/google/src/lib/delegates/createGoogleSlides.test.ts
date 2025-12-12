// createGoogleSlides.test.ts

import { drive_v3, slides_v1 } from 'googleapis';
import {
  CreateGoogleSlidesInput,
} from '@codestrap/developer-foundations-types';
import { createGoogleSlidesDelegate } from './createGoogleSlides';

// ------------------------------
// Mocks
// ------------------------------
const mockDriveClient = {
  files: {
    copy: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
  },
  permissions: {
    create: jest.fn(),
  }
} as unknown as drive_v3.Drive;

const mockSlidesClient = {
  presentations: {
    get: jest.fn(),
    batchUpdate: jest.fn(),
  },
} as unknown as slides_v1.Slides;

// Mock console methods to avoid noise in tests
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('createGoogleSlidesDelegate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('happy path – single template, multiple slides via placeholders', () => {
    beforeEach(() => {
      // drive.files.copy -> copied presentation
      (mockDriveClient.files.copy as jest.Mock).mockResolvedValue({
        data: {
          id: 'newPresId',
          name: 'Copied Name',
        },
      });

      // drive.files.get for final metadata
      (mockDriveClient.files.get as jest.Mock).mockResolvedValue({
        data: {
          id: 'newPresId',
          name: 'From PowerPoints to Outcomes – AI Era Enterprise Services',
          webViewLink:
            'https://docs.google.com/presentation/d/newPresId/edit',
          webContentLink:
            'https://docs.google.com/presentation/d/newPresId/export/pptx',
        },
      });

      // 🔹 NEW: drive.permissions.create for org-wide sharing
      (mockDriveClient.permissions.create as jest.Mock).mockResolvedValue({
        data: {
          id: 'permId',
          role: 'writer',
          type: 'domain',
          domain: 'codestrap.me',
        },
      });

      // slides.presentations.get -> template has one slide with objectId "p1"
      (mockSlidesClient.presentations.get as jest.Mock).mockResolvedValue({
        data: {
          slides: [
            {
              objectId: 'p1',
            },
          ],
        },
      });

      // slides.presentations.batchUpdate -> succeed
      (mockSlidesClient.presentations.batchUpdate as jest.Mock).mockResolvedValue(
        {
          data: {},
        }
      );
    });

    it('creates one presentation and duplicates the first slide for each GoogleSlide entry', async () => {
      const input: CreateGoogleSlidesInput = [
        {
          templateId:
            'https://docs.google.com/presentation/d/TEMPLATE_ID_HERE/edit',
          name: 'From PowerPoints to Outcomes – AI Era Enterprise Services',
          content: [
            {
              slideNumber: 1,
              content: [
                {
                  targetType: 'PLACEHOLDER',
                  placeholder: '{{TITLE}}',
                  text: 'Slide 1 Title',
                },
              ],
            },
            {
              slideNumber: 2,
              content: [
                {
                  targetType: 'PLACEHOLDER',
                  placeholder: '{{TITLE}}',
                  text: 'Slide 2 Title',
                }
              ],
            }
          ],
        },
      ];

      const result = await createGoogleSlidesDelegate({
        input,
        drive: mockDriveClient,
        slides: mockSlidesClient,
      });

      expect(result.failures).toHaveLength(0);
      expect(result.successes).toHaveLength(1);

      const success = result.successes[0];

      expect(success.presentationId).toBe('newPresId');
      expect(success.fileId).toBe('newPresId');
      expect(success.name).toBe(
        'From PowerPoints to Outcomes – AI Era Enterprise Services'
      );
      expect(success.webViewLink).toBe(
        'https://docs.google.com/presentation/d/newPresId/edit'
      );
      expect(success.webContentLink).toBe(
        'https://docs.google.com/presentation/d/newPresId/export/pptx'
      );

      // drive.files.copy called with normalized templateId
      expect(mockDriveClient.files.copy).toHaveBeenCalledTimes(1);
      expect(mockDriveClient.files.copy).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: 'TEMPLATE_ID_HERE',
          requestBody: {
            name: 'From PowerPoints to Outcomes – AI Era Enterprise Services',
          },
        })
      );

      // slides.presentations.get called for the copied deck
      expect(mockSlidesClient.presentations.get).toHaveBeenCalledTimes(1);
      expect(mockSlidesClient.presentations.get).toHaveBeenCalledWith({
        presentationId: 'newPresId',
      });

      // batchUpdate called once with 3 requests:
      // 1) replaceAllText on base slide p1 (slideNumber 1)
      // 2) duplicateObject of p1 -> p1_1 (for slideNumber 2)
      // 3) replaceAllText on duplicated slide p1_1 (slideNumber 2 content)
      expect(
        mockSlidesClient.presentations.batchUpdate
      ).toHaveBeenCalledTimes(1);

      const batchArgs = (
        mockSlidesClient.presentations.batchUpdate as jest.Mock
      ).mock.calls[0][0];

      expect(batchArgs.presentationId).toBe('newPresId');
      expect(batchArgs.requestBody).toBeDefined();

      const { requests } = batchArgs.requestBody;
      expect(Array.isArray(requests)).toBe(true);
      expect(requests).toHaveLength(3);

      const [r0, r1, r2] = requests;

      // r0: duplicateObject of base slide
      expect(r0.duplicateObject).toBeDefined();
      expect(r0.duplicateObject.objectId).toBe('p1');
      expect(r0.duplicateObject.objectIds).toEqual({ p1: 'p1_1' });

      // replaceAllText on base slide
      expect(r1.replaceAllText).toBeDefined();
      expect(r1.replaceAllText.containsText).toEqual({
        text: '{{TITLE}}',
        matchCase: true,
      });
      expect(r1.replaceAllText.replaceText).toBe('Slide 1 Title');
      expect(r1.replaceAllText.pageObjectIds).toEqual(['p1']);

      // r2: replaceAllText on duplicated slide
      expect(r2.replaceAllText).toBeDefined();
      expect(r2.replaceAllText.containsText).toEqual({
        text: '{{TITLE}}',
        matchCase: true,
      });
      expect(r2.replaceAllText.replaceText).toBe('Slide 2 Title');
      expect(r2.replaceAllText.pageObjectIds).toEqual(['p1_1']);
    });
  });

  describe('error handling – missing slides client', () => {
    it('returns CONFIG_ERROR when slides client is not provided', async () => {
      const input: CreateGoogleSlidesInput = [
        {
          templateId: 'TEMPLATE_ID_HERE',
          name: 'No Slides Client Deck',
          content: [
            {
              slideNumber: 1,
              content: [
                {
                  targetType: 'PLACEHOLDER',
                  placeholder: '{{TITLE}}',
                  text: 'Will not be used',
                },
              ],
            },
          ],
        },
      ];

      const result = await createGoogleSlidesDelegate({
        input,
        drive: mockDriveClient,
        slides: undefined,
      });

      expect(result.successes).toHaveLength(0);
      expect(result.failures).toHaveLength(1);

      const failure = result.failures[0];
      expect(failure.errorCode).toBe('CONFIG_ERROR');
      expect(failure.errorMessage).toMatch(/Slides client not available/i);

      // no Drive or Slides calls
      expect(mockDriveClient.files.copy).not.toHaveBeenCalled();
      expect(mockSlidesClient.presentations.get).not.toHaveBeenCalled();
      expect(
        mockSlidesClient.presentations.batchUpdate
      ).not.toHaveBeenCalled();
    });
  });

  describe('error handling – validation', () => {
    it('returns VALIDATION_ERROR when content includes OBJECT_ID targetType', async () => {
      const input: CreateGoogleSlidesInput = [
        {
          templateId: 'TEMPLATE_ID_HERE',
          name: 'Invalid Content Deck',
          content: [
            {
              slideNumber: 1,
              content: [
                {
                  targetType: 'OBJECT_ID',
                  objectId: 'S01_TITLE',
                  text: 'This should fail validation',
                },
              ],
            },
          ],
        },
      ];

      const result = await createGoogleSlidesDelegate({
        input,
        drive: mockDriveClient,
        slides: mockSlidesClient,
      });

      expect(result.successes).toHaveLength(0);
      expect(result.failures).toHaveLength(1);

      const failure = result.failures[0];
      expect(failure.errorCode).toBe('VALIDATION_ERROR');
      expect(failure.errorMessage).toMatch(/OBJECT_ID is not supported/i);

      expect(mockDriveClient.files.copy).not.toHaveBeenCalled();
      expect(mockSlidesClient.presentations.get).not.toHaveBeenCalled();
      expect(
        mockSlidesClient.presentations.batchUpdate
      ).not.toHaveBeenCalled();
    });

    it('returns VALIDATION_ERROR for invalid templateId', async () => {
      const input: CreateGoogleSlidesInput = [
        {
          // too short to pass /^[a-zA-Z0-9_-]{10,}$/ so normalizeTemplateId -> null
          templateId: 'bad',
          name: 'Invalid Template Deck',
          content: [
            {
              slideNumber: 1,
              content: [
                {
                  targetType: 'PLACEHOLDER',
                  placeholder: '{{TITLE}}',
                  text: 'Won\'t be used',
                },
              ],
            },
          ],
        },
      ];

      const result = await createGoogleSlidesDelegate({
        input,
        drive: mockDriveClient,
        slides: mockSlidesClient,
      });

      expect(result.successes).toHaveLength(0);
      expect(result.failures).toHaveLength(1);

      const failure = result.failures[0];
      expect(failure.errorCode).toBe('VALIDATION_ERROR');
      expect(failure.errorMessage).toMatch(
        /Invalid Google Drive file ID or URL format/i
      );

      expect(mockDriveClient.files.copy).not.toHaveBeenCalled();
      expect(mockSlidesClient.presentations.get).not.toHaveBeenCalled();
      expect(
        mockSlidesClient.presentations.batchUpdate
      ).not.toHaveBeenCalled();
    });
  });
});
