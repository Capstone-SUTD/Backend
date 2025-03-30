const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn(),
    eq: jest.fn()
};

const mockGetFullChecklist = jest.fn();

jest.mock('../config/db', () => mockSupabase);
jest.mock('../utils/azureFiles', () => ({
    getFullChecklist: () => mockGetFullChecklist()
}));
const controller = require('../controllers/projectsController'); // adjust if needed




describe('getProjectChecklist', () => {
    let req, res;

    beforeEach(() => {
        req = { query: { projectid: '101' } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        jest.clearAllMocks();
    });

    test('should return 400 if projectid is missing', async () => {
        req.query = {};

        await controller.getProjectChecklist(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: "Missing 'projectid' in query."
        });
    });

    test('should return 500 if fullChecklist is invalid', async () => {
        mockGetFullChecklist.mockResolvedValueOnce(null);

        await controller.getProjectChecklist(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: "Invalid or missing checklist template."
        });
    });

    test('should return 500 if supabase returns error', async () => {
        mockGetFullChecklist.mockResolvedValueOnce({ OffSiteFixed: {}, OnSiteFixed: {} });

        mockSupabase.select.mockReturnThis();
        mockSupabase.eq.mockResolvedValueOnce({
            data: null,
            error: { message: 'DB error' }
        });

        await controller.getProjectChecklist(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: "Database error while fetching checklist."
        });
    });

    test('should return 404 if no checklist data found', async () => {
        mockGetFullChecklist.mockResolvedValueOnce({ OffSiteFixed: {}, OnSiteFixed: {} });

        mockSupabase.select.mockReturnThis();
        mockSupabase.eq.mockResolvedValueOnce({
            data: [],
            error: null
        });

        await controller.getProjectChecklist(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            error: "No checklist found for the specified project."
        });
    });

    test('should return 200 and structured checklist if data is valid', async () => {
        const checklistData = [
            {
                taskid: 1,
                type: 'Lifting',
                subtype: 'Lift1',
                completed: true,
                has_comments: false,
                has_attachment: true
            }
        ];

        const fullChecklist = {
            Lifting: {
                Lift1: { label: 'Lifting Task' }
            },
            OnSiteFixed: { OS1: { label: 'OS Task' } },
            OffSiteFixed: { OF1: { label: 'OF Task' } }
        };

        mockGetFullChecklist.mockResolvedValueOnce(fullChecklist);

        mockSupabase.select.mockReturnThis();
        mockSupabase.eq.mockResolvedValueOnce({
            data: checklistData,
            error: null
        });

        await controller.getProjectChecklist(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            Lifting: {
                Lift1: {
                    label: 'Lifting Task',
                    taskid: 1,
                    completed: true,
                    has_comments: false,
                    has_attachment: true
                }
            },
            OnSiteFixed: { OS1: { label: 'OS Task' } },
            OffSiteFixed: { OF1: { label: 'OF Task' } }
        });
    });
});
