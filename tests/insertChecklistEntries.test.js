// insertChecklistEntries.test.js

const mockFrom = jest.fn(() => ({
    insert: mockInsert
}));

const { insertChecklistEntries } = require('../controllers/projectsController'); // adjust if needed

// Mock Supabase
const defaultResult = { data: [{ id: 1 }], error: null };
const mockInsert = jest.fn(() => ({
    select: jest.fn(() => Promise.resolve(defaultResult))
}));
jest.mock('../config/db', () => ({
    from: mockFrom
}));

describe('insertChecklistEntries', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should insert checklist entries successfully', async () => {
        const checklist = [{ name: 'Check safety', status: 'Pending' }];

        const result = await insertChecklistEntries(checklist);

        expect(mockFrom).toHaveBeenCalledWith('checklist');
        expect(mockInsert).toHaveBeenCalledWith(checklist);
        expect(result).toEqual({
            success: true,
            insertedData: defaultResult.data
        });
    });

    test('should return error if input is not an array', async () => {
        const result = await insertChecklistEntries(null);

        expect(result).toEqual({
            success: false,
            error: 'Checklist object must be a non-empty array.'
        });
    });

    test('should return error if input array is empty', async () => {
        const result = await insertChecklistEntries([]);

        expect(result).toEqual({
            success: false,
            error: 'Checklist object must be a non-empty array.'
        });
    });

    test('should handle supabase insert error', async () => {
        const errorResult = { data: null, error: { message: 'Insert failed' } };

        mockInsert.mockReturnValueOnce({
            select: jest.fn(() => Promise.resolve(errorResult))
        });

        const result = await insertChecklistEntries([{ name: 'X' }]);

        expect(result).toEqual({
            success: false,
            error: 'Insert failed'
        });
    });

    test('should catch and return unexpected errors', async () => {
        mockInsert.mockImplementationOnce(() => {
            throw new Error('Unexpected crash');
        });

        const result = await insertChecklistEntries([{ name: 'Crash test' }]);

        expect(result).toEqual({
            success: false,
            error: 'Unexpected crash'
        });
    });
});
