import { describe, it, expect } from 'vitest';
import { extractGoogleDriveId } from '../../scripts/import-excel-to-firestore.js';

describe('Excel Importer Unit Tests', () => {
  it('should extract Google Drive file ID from standard drive share link', () => {
    const url = 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing';
    const id = extractGoogleDriveId(url);
    expect(id).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
  });

  it('should extract Google Drive file ID from Google Sheets link', () => {
    const url = 'https://docs.google.com/spreadsheets/d/1qpyC0X9xtrWP9Bw_4Bh931Ce5iBQ1_4Bh931Ce5iBQ/edit#gid=0';
    const id = extractGoogleDriveId(url);
    expect(id).toBe('1qpyC0X9xtrWP9Bw_4Bh931Ce5iBQ1_4Bh931Ce5iBQ');
  });

  it('should handle raw file ID directly', () => {
    const rawId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
    const id = extractGoogleDriveId(rawId);
    expect(id).toBe(rawId);
  });
});
