const { getProjectDetails } = require('../controllers/projectsController');
const supabase = require('../config/db');

jest.mock('../config/db', () => {
    const responseMap = {
        project: {
            data: {
                projectid: 149,
                client: 'ACME Corp',
                projectname: 'Heavy Lift Project',
                startdestination: 'Warehouse A',
                enddestination: 'Site B'
            },
            error: null
        },
        cargo: {
            data: [
                {
                    cargoname: 'test',
                    length: 5,
                    breadth: 5,
                    height: 5,
                    weight: 5000,
                    quantity: 2,
                    projectid: 149
                },
                {
                    cargoname: 'twst',
                    length: 2,
                    breadth: 2,
                    height: 2,
                    weight: 200,
                    quantity: 2,
                    projectid: 149
                }
            ],
            error: null
        },
        scope: {
            data: [
                {
                    start: 'Start Point',
                    end: 'End Point',
                    work: 'Lifting',
                    equipment: '300 ton crane',
                    projectid: 149
                }
            ],
            error: null
        }
    };

    return {
        from: jest.fn((table) => {
            return {
                select: jest.fn(() => ({
                    eq: jest.fn(() => {
                        switch (table) {
                            case 'projects': return { single: () => responseMap.project };
                            case 'cargo': return responseMap.cargo;
                            case 'scope': return responseMap.scope;
                            default: return { data: null, error: { message: 'Table not mocked' } };
                        }
                    })
                }))
            };
        })
    };
});

describe('getProjectDetails', () => {
    test('returns project, cargos, and scopes correctly', async () => {
        const result = await getProjectDetails(149);

        expect(result.project.projectname).toBe('Heavy Lift Project');
        expect(result.cargos).toHaveLength(2); // ✅ Updated to correct expected length
        expect(result.scopes[0].equipment).toBe('300 ton crane');
    });

    test('throws error if project not found', async () => {
        supabase.from.mockImplementationOnce(() => ({
            select: () => ({
                eq: () => ({
                    single: () => ({ data: null, error: { message: 'Project not found' } })
                })
            })
        }));

        await expect(getProjectDetails(999)).rejects.toThrow('Project details not found. Project not found');
    });

    test('throws error if cargo not found', async () => {
        // Mock first call (project) with success
        supabase.from
            .mockImplementationOnce(() => ({
                select: () => ({
                    eq: () => ({
                        single: () => ({
                            data: {
                                projectid: 149,
                                projectname: 'Heavy Lift Project',
                            },
                            error: null
                        })
                    })
                })
            }))
            // Mock second call (cargo) with failure
            .mockImplementationOnce(() => ({
                select: () => ({
                    eq: () => ({
                        data: null,
                        error: { message: 'Cargo error' }
                    })
                })
            }));

        await expect(getProjectDetails(998)).rejects.toThrow('Cargo details not found.');
    });

    test('throws error if scope not found', async () => {
        // Mock project -> ok, cargo -> ok, scope -> fail
        supabase.from
            .mockImplementationOnce(() => ({
                select: () => ({
                    eq: () => ({
                        single: () => ({
                            data: { projectid: 149, projectname: 'Heavy Lift Project' },
                            error: null
                        })
                    })
                })
            }))
            .mockImplementationOnce(() => ({
                select: () => ({
                    eq: () => ({
                        data: [
                            { cargoname: 'test', projectid: 149 }
                        ],
                        error: null
                    })
                })
            }))
            .mockImplementationOnce(() => ({
                select: () => ({
                    eq: () => ({
                        data: null,
                        error: { message: 'Scope not found' }
                    })
                })
            }));

        await expect(getProjectDetails(997)).rejects.toThrow('Scope details not found.');
    });
});
