const { categorizeScope } = require('../controllers/projectsController');

describe('categorizeScope', () => {
    test('returns "Lifting and Transportation" when both types exist', () => {
        const scopes = [
            { work: 'Lifting cargo' },
            { work: 'Transportation to site' }
        ];
        expect(categorizeScope(scopes)).toBe('LiftingandTransportation');
    });

    test('returns "Lifting" when only lifting scopes exist', () => {
        const scopes = [
            { work: 'Lifting operations' },
            { work: 'Lifting machinery' }
        ];
        expect(categorizeScope(scopes)).toBe('Lifting');
    });

    test('returns "Transportation" when only transportation scopes exist', () => {
        const scopes = [
            { work: 'Transportation of equipment' },
            { work: 'Transportation to site' }
        ];
        expect(categorizeScope(scopes)).toBe('Transportation');
    });

    test('returns "Other" when neither lifting nor transportation is mentioned', () => {
        const scopes = [
            { work: 'Site setup' },
            { work: 'Inspection and testing' }
        ];
        expect(categorizeScope(scopes)).toBe('Other');
    });

    test('is case-insensitive when matching keywords', () => {
        const scopes = [
            { work: 'LIFTING of beams' },
            { work: 'TRANSPORTATION by trailer' }
        ];
        expect(categorizeScope(scopes)).toBe('LiftingandTransportation');
    });

    test('returns "Other" for empty array', () => {
        expect(categorizeScope([])).toBe('Other');
    });

    test('throws error when input is not an array', () => {
        expect(() => categorizeScope('not an array')).toThrow('Invalid input: scopes should be an array.');
        expect(() => categorizeScope(null)).toThrow('Invalid input: scopes should be an array.');
        expect(() => categorizeScope(undefined)).toThrow('Invalid input: scopes should be an array.');
        expect(() => categorizeScope(123)).toThrow('Invalid input: scopes should be an array.');
    });
});
