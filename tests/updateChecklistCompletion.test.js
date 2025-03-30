// ✅ Supabase mock
const mockSupabase = {
    from: jest.fn()
};

jest.mock('../config/db', () => mockSupabase);
const controller = require('../controllers/projectsController');

describe('updateChecklistCompletion', () => {
    let req, res;

    beforeEach(() => {
        req = { body: { taskid: 101 } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        jest.clearAllMocks();
    });

    test('should return 400 if taskid is missing or invalid', async () => {
        req.body = {};
        await controller.updateChecklistCompletion(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'taskid is required' });
    });

    test('should return 500 if fetch error occurs', async () => {
        mockSupabase.from.mockReturnValueOnce({
            select: () => ({
                eq: () => ({
                    single: () => Promise.resolve({
                        data: null,
                        error: { message: 'Fetch error' }
                    })
                })
            })
        });

        await controller.updateChecklistCompletion(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Database error while fetching checklist entry.'
        });
    });

    test('should return 404 if no checklist entry is found', async () => {
        mockSupabase.from.mockReturnValueOnce({
            select: () => ({
                eq: () => ({
                    single: () => Promise.resolve({
                        data: null,
                        error: null
                    })
                })
            })
        });

        await controller.updateChecklistCompletion(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Checklist entry not found.'
        });
    });

    test('should return 500 if update fails', async () => {
        // Step 1: Mock fetching current checklist entry
        mockSupabase.from
            .mockReturnValueOnce({
                select: () => ({
                    eq: () => ({
                        single: () => Promise.resolve({
                            data: { completed: false },
                            error: null
                        })
                    })
                })
            })
            // Step 2: Mock update failing
            .mockReturnValueOnce({
                update: () => ({
                    eq: () => ({
                        select: () => Promise.resolve({
                            data: null,
                            error: { message: 'Update error' }
                        })
                    })
                })
            });

        await controller.updateChecklistCompletion(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Database error while updating checklist.'
        });
    });

    test('should return 200 and success message if update succeeds', async () => {
        // Step 1: Mock fetching current checklist entry
        mockSupabase.from
            .mockReturnValueOnce({
                select: () => ({
                    eq: () => ({
                        single: () => Promise.resolve({
                            data: { completed: false },
                            error: null
                        })
                    })
                })
            })
            // Step 2: Mock successful update
            .mockReturnValueOnce({
                update: () => ({
                    eq: () => ({
                        select: () => Promise.resolve({
                            data: [{ taskid: 101, completed: true }],
                            error: null
                        })
                    })
                })
            });

        await controller.updateChecklistCompletion(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            message: 'Checklist task 101 marked as completed.',
            updatedData: [{ taskid: 101, completed: true }]
        });
    });
});
