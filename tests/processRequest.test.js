const axios = require('axios');
const controller = require('../controllers/projectsController');

jest.mock('axios');

describe('processRequest', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should respond with 200 and data from both APIs', async () => {
        // Mock dependencies from the same module
        jest.spyOn(controller, 'getProjectDetails').mockResolvedValue({
            project: {
                projectid: 149,
                client: 'ACME Corp',
                projectname: 'Heavy Lift Project',
                startdestination: 'Warehouse A',
                enddestination: 'Site B'
            },
            cargos: [],
            scopes: []
        });

        jest.spyOn(controller, 'transformProjectData').mockReturnValue({
            projectid: 149,
            client_name: 'ACME Corp',
            project_name: 'Heavy Lift Project',
            start_location: 'Warehouse A',
            end_location: 'Site B',
            cargos: [],
            scopes: []
        });

        jest.spyOn(controller, 'categorizeScope').mockReturnValue('Lifting');

        axios.post.mockImplementation((url) => {
            if (url.includes('generate_ms')) {
                return Promise.resolve({ data: { ms: 'mocked-ms-response' } });
            }
            if (url.includes('generate_ra')) {
                return Promise.resolve({ data: { ra: 'mocked-ra-response' } });
            }
        });

        const req = { body: { projectid: 149 } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await controller.processRequest(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            first_api_response: { ms: 'mocked-ms-response' },
            second_api_response: { ra: 'mocked-ra-response' }
        });
    }); test('should respond with 400 if projectid is missing', async () => {
        const req = { body: {} };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await controller.processRequest(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Invalid Input. Project ID is required'
        });
    }); test('should respond with 500 if MS API returns no data', async () => {
        jest.spyOn(controller, 'getProjectDetails').mockResolvedValue({ project: {}, cargos: [], scopes: [] });
        jest.spyOn(controller, 'transformProjectData').mockReturnValue({});
        jest.spyOn(controller, 'categorizeScope').mockReturnValue('Lifting');

        axios.post.mockImplementation((url) => {
            if (url.includes('generate_ms')) {
                return Promise.resolve({ data: null });
            }
        });

        const req = { body: { projectid: 149 } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await controller.processRequest(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: expect.stringContaining('Failed to process project: MS API did not return any data')
        });
    });
    test('should respond with 500 if RA API throws an error', async () => {
        jest.spyOn(controller, 'getProjectDetails').mockResolvedValue({ project: {}, cargos: [], scopes: [] });
        jest.spyOn(controller, 'transformProjectData').mockReturnValue({});
        jest.spyOn(controller, 'categorizeScope').mockReturnValue('Lifting');

        axios.post.mockImplementation((url) => {
            if (url.includes('generate_ms')) {
                return Promise.resolve({ data: { ms: 'valid' } });
            }
            if (url.includes('generate_ra')) {
                throw new Error('RA API failed');
            }
        });

        const req = { body: { projectid: 149 } };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await controller.processRequest(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: expect.stringContaining('Failed to process project: RA API failed')
        });
    });


});
