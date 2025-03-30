
const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnValue(Promise.resolve({ data: [{}], error: null }))
}; jest.mock('../utils/azureFiles.js', () => ({
    getFullChecklist: jest.fn(() => ({})),
    uploadFile: jest.fn(() => 'mock-blob-url'),
    generateSasUrl: jest.fn(() => 'https://mock.blob.url/mockfile')
}));

const controller = require('../controllers/projectsController');
const fs = require('fs');
const streamifier = require('streamifier');
const axios = require('axios');
const FormData = require('form-data');
const formidable = require('formidable');

jest.mock('fs');
jest.mock('axios');
jest.mock('streamifier', () => ({
    createReadStream: jest.fn()
}));
jest.mock('form-data', () => {
    return jest.fn().mockImplementation(() => ({
        append: jest.fn(),
        getHeaders: jest.fn(() => ({ 'Content-Type': 'multipart/form-data' }))
    }));
});
jest.mock('formidable');

jest.mock('../config/db', () => mockSupabase);

describe('saveProject', () => {
    let req, res;

    beforeEach(() => {
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        jest.clearAllMocks();

        axios.post.mockResolvedValue({ data: { result: 'ok' } });

        fs.readFileSync.mockReturnValue(Buffer.from('mock buffer'));
        fs.createReadStream.mockReturnValue('mockStream');

        streamifier.createReadStream.mockReturnValue('mockStreamified');

        FormData.mockImplementation(() => ({
            append: jest.fn(),
            getHeaders: jest.fn(() => ({ 'Content-Type': 'multipart/form-data' }))
        }));
        formidable.IncomingForm.mockImplementation(() => ({
            parse: (req, cb) =>
                cb(null,
                    {
                        projectid: ['123'],
                        scope: [
                            JSON.stringify([
                                { start: 'A', end: 'B', work: 'Lifting', equipment: '300 ton crane' }
                            ])
                        ]
                    },
                    {
                        VendorMS: [{ filepath: 'mock/ms.pdf' }],
                        VendorRA: [{ filepath: 'mock/ra.pdf' }]
                    }
                )
        }));
    });


    test('should return 400 if projectid or scope is missing', async () => {
        formidable.IncomingForm.mockImplementation(() => ({
            parse: (req, cb) => cb(null, {}, {})
        }));

        await controller.saveProject(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid request format' });
    });

    test('should return 500 if scope is invalid JSON', async () => {
        formidable.IncomingForm.mockImplementation(() => ({
            parse: (req, cb) => cb(null, {
                projectid: ['123'],
                scope: ['INVALID JSON']
            }, {})
        }));

        await controller.saveProject(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Failed to save project scope.' });
    });

    test('should return 500 if database throws error', async () => {
        mockSupabase.update.mockReturnValueOnce({
            eq: jest.fn().mockReturnValue(Promise.reject(new Error('DB error')))
        });

        await controller.saveProject(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Failed to save project scope.' });
    });
});
