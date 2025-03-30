const controller = require('../controllers/projectsController');
const mockSupabase = require('../config/db');

jest.mock('../config/db');

describe('submitFeedback', () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {
                projectid: 1,
                comments: 'This is great!',
                role: 'Client'
            },
            user: {
                id: 42
            }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
    });

    test('should return 400 if projectid is missing', async () => {
        req.body.projectid = null;

        await controller.submitFeedback(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'All fields are required' });
    });

    test('should return 403 if user is not a stakeholder', async () => {
        mockSupabase.from.mockReturnValueOnce({
            select: () => ({
                eq: () => ({
                    eq: () => Promise.resolve({ data: [], error: null })
                })
            })
        });

        await controller.submitFeedback(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'You are not a stakeholder for this project.' });
    });

    test('should return 403 if role does not match', async () => {
        mockSupabase.from.mockReturnValueOnce({
            select: () => ({
                eq: () => ({
                    eq: () => Promise.resolve({ data: [{ role: 'Contractor' }], error: null })
                })
            })
        });

        await controller.submitFeedback(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Only Client can submit feedback here but Contractor provided'
        });
    });

    test('should return 500 if supabase select has error', async () => {
        mockSupabase.from.mockReturnValueOnce({
            select: () => ({
                eq: () => ({
                    eq: () => Promise.resolve({ data: null, error: { message: 'DB failure' } })
                })
            })
        });

        await controller.submitFeedback(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'DB failure' });
    });

    test('should return 500 if supabase update has error', async () => {
        mockSupabase.from
            .mockReturnValueOnce({ // for select
                select: () => ({
                    eq: () => ({
                        eq: () => Promise.resolve({ data: [{ role: 'Client' }], error: null })
                    })
                })
            })
            .mockReturnValueOnce({ // for update
                update: () => ({
                    eq: () => ({
                        eq: () => ({
                            select: () => Promise.resolve({ error: { message: 'Update failed' } })
                        })
                    })
                })
            });

        await controller.submitFeedback(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Update failed' });
    });

    test('should respond with success if feedback is submitted correctly', async () => {
        mockSupabase.from
            .mockReturnValueOnce({ // for select
                select: () => ({
                    eq: () => ({
                        eq: () => Promise.resolve({ data: [{ role: 'Client' }], error: null })
                    })
                })
            })
            .mockReturnValueOnce({ // for update
                update: () => ({
                    eq: () => ({
                        eq: () => ({
                            select: () => Promise.resolve({ data: [{}], error: null })
                        })
                    })
                })
            });

        await controller.submitFeedback(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: 'Submitted Successfully' });
    });
});
