// tests/newProject.test.js

const defaultMockResult = Promise.resolve({ data: [{}], error: null });

const mockSupabase = {
    from: jest.fn((table) => {
        if (table === 'projects') {
            return {
                insert: () => ({
                    select: () => ({
                        single: () =>
                            Promise.resolve({
                                data: { projectid: 101 },
                                error: null
                            })
                    })
                })
            };
        }

        if (table === 'stakeholders' || table === 'cargo') {
            return {
                insert: jest.fn(() => Promise.resolve({ data: [{}], error: null }))
            };
        }

        return {
            insert: jest.fn(() => defaultMockResult),
            select: jest.fn(() => defaultMockResult)
        };
    })
};

jest.mock('../config/db', () => mockSupabase);
const controller = require('../controllers/projectsController');

describe('newProject', () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {
                projectname: 'Project X',
                client: 'ACME Corp',
                emailsubjectheader: 'ACME-X',
                stakeholders: [
                    { userId: 1, role: 'Engineer' },
                    { userId: 2, role: 'Coordinator' }
                ],
                cargo: [
                    { cargoname: 'Box', length: 10, breadth: 2, height: 2, weight: 30000, quantity: 2 }
                ]
            }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        // Mock insert for project
        mockSupabase.from.mockImplementation((table) => {
            switch (table) {
                case 'projects':
                    return {
                        insert: () => ({
                            select: () => ({
                                single: () => Promise.resolve({ data: { projectid: 101 }, error: null })
                            })
                        })
                    };
                case 'stakeholders':
                    return {
                        insert: jest.fn().mockResolvedValue({ data: [{}], error: null })
                    };
                case 'cargo':
                    return {
                        insert: jest.fn().mockResolvedValue({ data: [{}], error: null })
                    };
                default:
                    return {};
            }
        });
    });

    test('should create a new project and return projectid + cargo', async () => {
        await controller.newProject(req, res);

        expect(res.json).toHaveBeenCalledWith({
            projectid: 101,
            cargo: [
                {
                    projectid: 101,
                    cargoname: 'Box',
                    length: 10,
                    breadth: 2,
                    height: 2,
                    weight: 30000,
                    quantity: 2,
                    oog: 'No'
                }
            ]
        });
    });

    test('should throw error if project insert fails', async () => {
        mockSupabase.from.mockReturnValueOnce({
            insert: () => ({
                select: () => ({
                    single: () => Promise.resolve({ data: null, error: { message: 'Insert failed' } })
                })
            })
        });

        await expect(controller.newProject(req, res)).rejects.toEqual({ message: 'Insert failed' });
    });
});

