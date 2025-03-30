const controller = require('../controllers/projectsController');

jest.mock('../config/db', () => ({
    from: jest.fn()
}));

const mockSupabase = require('../config/db');

describe('stakeholderComments', () => {
    let req, res;

    beforeEach(() => {
        req = { body: { projectid: 1 } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        jest.clearAllMocks();
    });

    test('should return 400 if projectid is missing', async () => {
        req.body = {};

        await controller.stakeholderComments(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'All fields are required' });
    });

    test('should return 500 if stakeholder query fails', async () => {
        mockSupabase.from.mockReturnValueOnce({
            select: () => ({
                eq: () => Promise.resolve({ data: null, error: { message: 'Stakeholder error' } })
            })
        });

        await controller.stakeholderComments(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error fetching stakeholders' });
    });

    test('should return empty array if no stakeholders are found', async () => {
        mockSupabase.from.mockReturnValueOnce({
            select: () => ({
                eq: () => Promise.resolve({ data: [], error: null })
            })
        });

        await controller.stakeholderComments(req, res);

        expect(res.json).toHaveBeenCalledWith([]);
    });

    test('should return 500 if user query fails', async () => {
        // 1st call: stakeholders
        mockSupabase.from.mockReturnValueOnce({
            select: () => ({
                eq: () => Promise.resolve({
                    data: [{ userid: 101, comments: 'Looks good', role: 'Client' }],
                    error: null
                })
            })
        });

        // 2nd call: users
        mockSupabase.from.mockReturnValueOnce({
            select: () => ({
                in: () => Promise.resolve({ data: null, error: { message: 'User error' } })
            })
        });

        await controller.stakeholderComments(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error fetching user data' });
    });

    test('should return formatted stakeholder comments with usernames', async () => {
        // 1st call: stakeholders
        mockSupabase.from.mockReturnValueOnce({
            select: () => ({
                eq: () => Promise.resolve({
                    data: [
                        { userid: 101, comments: 'All good', role: 'Client' },
                        { userid: 102, comments: 'Needs work', role: 'Vendor' }
                    ],
                    error: null
                })
            })
        });

        // 2nd call: users
        mockSupabase.from.mockReturnValueOnce({
            select: () => ({
                in: () => Promise.resolve({
                    data: [
                        { userid: 101, username: 'Alice' },
                        { userid: 102, username: 'Bob' }
                    ],
                    error: null
                })
            })
        });

        await controller.stakeholderComments(req, res);

        expect(res.json).toHaveBeenCalledWith([
            { userid: 101, role: 'Client', name: 'Alice', comments: 'All good' },
            { userid: 102, role: 'Vendor', name: 'Bob', comments: 'Needs work' }
        ]);
    });
});
describe('getStakeholders', () => {
    let req, res;

    beforeEach(() => {
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
    });

    test('should return user data', async () => {
        mockSupabase.from.mockReturnValueOnce({
            select: jest.fn().mockResolvedValueOnce({
                data: [{ userid: 1, username: 'Alice' }],
                error: null
            })
        });

        await controller.getStakeholders(req, res);

        expect(res.json).toHaveBeenCalledWith([{ userid: 1, username: 'Alice' }]);
    });

    test('should return 500 on supabase error', async () => {
        mockSupabase.from.mockReturnValueOnce({
            select: jest.fn().mockResolvedValueOnce({
                data: null,
                error: { message: 'DB error' }
            })
        });

        await controller.getStakeholders(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Error fetching data' });
    });
});
