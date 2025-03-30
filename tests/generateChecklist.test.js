
const mockGetFullChecklist = jest.fn();
const mockGetScope = jest.fn();
const mockInsertChecklistEntries = jest.fn();
jest.mock('../utils/azureFiles', () => ({
    getFullChecklist: () => mockGetFullChecklist()
}));

jest.mock('../controllers/projectsController', () => {
    const originalModule = jest.requireActual('../controllers/projectsController');
    return {
        ...originalModule,
        getScope: (...args) => mockGetScope(...args),
        insertChecklistEntries: (...args) => mockInsertChecklistEntries(...args),
    };
});


const controller = require('../controllers/projectsController');

describe('generateChecklist', () => {
    let req, res;

    beforeEach(() => {
        req = { body: { projectid: 101 } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        jest.clearAllMocks();
    });

    test('should return 400 if projectid is missing', async () => {
        req.body = {};

        await controller.generateChecklist(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: "Project ID is required." });
    });

    test('should return 500 if getFullChecklist returns invalid data', async () => {
        mockGetFullChecklist.mockResolvedValueOnce(null);

        await controller.generateChecklist(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: expect.stringContaining('Failed to generate checklist: Invalid or empty checklist data')
        });
    });

    test('should return 500 if getScope returns empty array', async () => {
        mockGetFullChecklist.mockResolvedValueOnce({ Lifting: {}, OffSiteFixed: {}, OnSiteFixed: {} });
        mockGetScope.mockResolvedValueOnce([]);

        await controller.generateChecklist(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: expect.stringContaining('Failed to generate checklist: No valid scope entries found')
        });
    });

    test('should return 500 if insertChecklistEntries fails', async () => {
        mockGetFullChecklist.mockResolvedValueOnce({
            Lifting: { A: true, B: true },
            OnSiteFixed: { C: true },
            OffSiteFixed: { D: true }
        });
        mockGetScope.mockResolvedValueOnce(['Lifting']);
        mockInsertChecklistEntries.mockResolvedValueOnce({ success: false, error: 'Failed to generate checklist: No valid scope entries found for this project.' });

        await controller.generateChecklist(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Failed to generate checklist: No valid scope entries found for this project.' });
    });
});
