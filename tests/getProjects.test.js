const controller = require('../controllers/projectsController');
const mockSupabase = require('../config/db');

jest.mock('../config/db');

// Mock data
const mockUserId = 123;
const mockStakeholderProjects = [{ projectid: 1 }];
const mockProjectData = [{ projectid: 1, stage: 'Planning' }];
const mockFilesData = [];
const mockStakeholders = [{ userid: 123, role: 'Engineer' }];
const mockCargoData = [{ cargoname: 'Crane' }];
const mockScopeData = [{ work: 'Lifting' }];
const mockUserDetails = { username: 'JohnDoe', email: 'john@example.com' };

describe('getProjects', () => {
    let req, res;

    beforeEach(() => {
        req = { user: { id: mockUserId } };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        mockSupabase.from.mockImplementation((table) => {
            switch (table) {
                case 'stakeholders':
                    return {
                        select: jest.fn(() => Promise.resolve({ data: mockStakeholderProjects, error: null })),
                        eq: jest.fn().mockReturnThis()
                    };
                case 'projects':
                    return {
                        select: jest.fn(() => Promise.resolve({ data: mockProjectData, error: null })),
                        in: jest.fn().mockReturnThis()
                    };
                case 'files':
                    return {
                        select: jest.fn(() => Promise.resolve({ data: mockFilesData, error: null })),
                        eq: jest.fn().mockReturnThis()
                    };
                case 'cargo':
                    return {
                        select: jest.fn(() => Promise.resolve({ data: mockCargoData, error: null })),
                        eq: jest.fn().mockReturnThis()
                    };
                case 'scope':
                    return {
                        select: jest.fn(() => Promise.resolve({ data: mockScopeData, error: null })),
                        eq: jest.fn().mockReturnThis()
                    };
                case 'users':
                    return {
                        select: jest.fn(() => Promise.resolve({ data: mockUserDetails, error: null })),
                        eq: jest.fn().mockReturnThis(),
                        single: jest.fn(() => Promise.resolve({ data: mockUserDetails, error: null }))
                    };
                default:
                    return {};
            }
        });
    });

    test('should respond with 401 if no user is present', async () => {
        req = { user: {} };;
        await controller.getProjects(req, res);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: User not found in request.' });
    });


});
