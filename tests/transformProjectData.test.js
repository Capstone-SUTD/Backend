const { transformProjectData } = require('../controllers/projectsController.js');

describe('transformProjectData', () => {
    const project = {
        projectid: 149,
        client: 'ACME Corp',
        projectname: 'Heavy Lift Project',
        startdestination: 'Warehouse A',
        enddestination: 'Site B'
    };

    const cargos = [
        {
            cargoname: 'test',
            length: 5,
            breadth: 5,
            height: 5,
            weight: 5000,
            quantity: 2,
            projectid: 149
        }
    ];

    const scopes = [
        {
            start: 'Start Point',
            end: 'End Point',
            work: 'Lifting',
            equipment: '300 ton crane',
            projectid: 149
        }
    ];

    test('should transform valid input correctly', () => {
        const result = transformProjectData({ project, cargos, scopes });
        expect(result.project_name).toBe('Heavy Lift Project');
        expect(result.client_name).toBe('ACME Corp');
        expect(result.cargos[0].cargo_name).toBe('test');
        expect(result.scopes[0].equipment).toBe('300 ton crane');
    });

    test('should throw error if project is missing', () => {
        expect(() => transformProjectData({ cargos, scopes })).toThrow('Missing project, cargos, or scopes data.');
    });

    test('should throw error if cargos is missing', () => {
        expect(() => transformProjectData({ project, scopes })).toThrow('Missing project, cargos, or scopes data.');
    });

    test('should throw error if scopes is missing', () => {
        expect(() => transformProjectData({ project, cargos })).toThrow('Missing project, cargos, or scopes data.');
    });

    test('fills in empty string if equipment is missing in scope', () => {
        const input = {
            project,
            cargos,
            scopes: [{ start: 'Point A', work: 'Transport' }]
        };

        const result = transformProjectData(input);
        expect(result.scopes[0].equipment).toBe('');
    });

    test('should handle multiple cargos and scopes', () => {
        const input = {
            project,
            cargos: [
                ...cargos,
                {
                    cargoname: 'extra',
                    length: 10,
                    breadth: 5,
                    height: 4,
                    weight: 1200,
                    quantity: 1,
                    projectid: 149
                }
            ],
            scopes: [
                ...scopes,
                {
                    start: 'Another Point',
                    work: 'Rigging',
                    equipment: '500 ton crane'
                }
            ]
        };

        const result = transformProjectData(input);
        expect(result.cargos).toHaveLength(2);
        expect(result.scopes).toHaveLength(2);
    });

    test('should preserve numeric values correctly', () => {
        const result = transformProjectData({ project, cargos, scopes });
        expect(result.cargos[0].dimensions.weight).toBe(5000);
        expect(result.cargos[0].dimensions.length).toBe(5);
    });
});
