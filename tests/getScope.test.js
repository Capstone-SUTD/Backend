// getScope.test.js

const mockSupabase = {
    from: jest.fn(() => ({
        select: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ data: [{ work: "Lifting" }, { work: "Cooking" }, { work: "Forklift" }], error: null }))
        }))
    }))
};
const { getScope } = require('../controllers/projectsController'); 

jest.mock('../config/db', () => mockSupabase);

describe('getScope', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should return filtered scope data with matching works', async () => {
        const result = await getScope(123);

        expect(result).toEqual(["Lifting", "Forklift"]);
        expect(mockSupabase.from).toHaveBeenCalledWith("scope");
    });

    test('should throw error if projectid is missing', async () => {
        await expect(getScope(null)).rejects.toThrow("getScope failed: Project ID is required");
    });

    test('should throw error if Supabase returns error', async () => {
        mockSupabase.from.mockReturnValueOnce({
            select: () => ({
                eq: () => Promise.resolve({ data: null, error: { message: "DB error" } })
            })
        });

        await expect(getScope(123)).rejects.toThrow("getScope failed: Failed to fetch scope data from database.");
    });

    test('should throw error if data is not an array', async () => {
        mockSupabase.from.mockReturnValueOnce({
            select: () => ({
                eq: () => Promise.resolve({ data: null, error: null })
            })
        });

        await expect(getScope(123)).rejects.toThrow("getScope failed: Invalid scope data received.");
    });
});
