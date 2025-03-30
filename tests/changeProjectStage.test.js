// tests/changeProjectStage.test.js

const mockSupabase = {
    from: jest.fn(() => ({
        update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ data: [{}], error: null }))
        }))
    }))
};
const controller = require('../controllers/projectsController');


jest.mock('../config/db', () => mockSupabase);

describe('changeProjectStage', () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {
                projectid: 123,
                stage: 'Execution'
            }
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
    });

    test('should return 400 if projectid or stage is missing', async () => {
        req.body = {}; // simulate missing input

        await controller.changeProjectStage(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: 'projectid and stage are required'
        });
    });

    test('should update project stage successfully', async () => {
        await controller.changeProjectStage(req, res);

        expect(res.json).toHaveBeenCalledWith({
            message: 'Project stage updated successfully',
            projectid: 123,
            stage: 'Execution'
        });
    });

    test('should throw error if supabase update fails', async () => {
        mockSupabase.from.mockReturnValueOnce({
            update: () => ({
                eq: () => Promise.resolve({ data: null, error: { message: 'Update failed' } })
            })
        });

        await expect(controller.changeProjectStage(req, res)).rejects.toEqual({ message: 'Update failed' });
    });
});
