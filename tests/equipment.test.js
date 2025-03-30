const axios = require('axios');
const { equipment } = require('../controllers/projectsController'); // adjust path if needed

jest.mock('axios');

describe('equipment controller', () => {
    let req, res;

    beforeEach(() => {
        req = { body: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        jest.clearAllMocks();
    });

    test('returns 400 if any field is not a number', async () => {
        req.body = { width: 'bad', length: 5, height: 10, weight: 1000 };

        await equipment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Invalid input. width, length, height, and weight must be numbers.'
        });
    });

    test('returns 502 if no data returned from API', async () => {
        req.body = { width: 2, length: 5, height: 10, weight: 1000 };
        axios.post.mockResolvedValue({}); // no data

        await equipment(req, res);

        expect(res.status).toHaveBeenCalledWith(502);
        expect(res.json).toHaveBeenCalledWith({
            error: 'No data returned from equipment service.'
        });
    });

    test('returns 200 and data if API call succeeds', async () => {
        req.body = { width: 2, length: 5, height: 10, weight: 1000 };
        const mockResponse = { equipment: 'Crane', type: 'Heavy' };
        axios.post.mockResolvedValue({ data: mockResponse });

        await equipment(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(mockResponse);
    });

    test('returns 500 if API call throws error', async () => {
        req.body = { width: 2, length: 5, height: 10, weight: 1000 };
        axios.post.mockRejectedValue(new Error('Service not available'));

        await equipment(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Internal server error',
            details: 'Service not available'
        });
    });
});
