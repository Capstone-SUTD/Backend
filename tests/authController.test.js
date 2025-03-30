//mocks
jest.mock('../config/db', () => {

    const users = [
        { userid: 2, username: 'Test', email: 'testuser@gmail.com', password: 'password123' }, { userid: 1, username: 'HSE-Test', email: 'hsetest@gmail.com', password: 'password123' },
        { userid: 3, username: 'Operations-Test', email: 'opstest@gmail.com', password: 'password123' }
    ];

    return {
        from: jest.fn((table) => {
            if (table === "users") {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn((column, value) => ({
                            single: jest.fn(() => {
                                const user = users.find(u => u[column] === value);
                                return {
                                    data: user || null,
                                    error: user ? null : { message: "User not found" }
                                };
                            })
                        }))
                    })),
                    insert: jest.fn(() => ({
                        select: jest.fn(() => ({
                            data: [{ userid: 3, ...users[0] }],
                            error: null
                        }))
                    }))
                };
            }

            return {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({ data: [], error: null }))
                }))
            };
        })
    };
});
jest.mock('jsonwebtoken');
const { loginUser, registerUser } = require('../controllers/authController');

describe('authController', () => {
    test('loginUser should return token on valid credentials', async () => {
        const req = {
            body: { email: 'testuser@gmail.com', password: 'password123' }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        }
        await loginUser(req, res);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Login successful',
            token: 'mocked-jwt-token'
        });
    });
    test('loginUser should return 401 for invalid email', async () => {
        const req = {
            body: { email: 'invalid@example.com', password: 'password123' }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await loginUser(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });

    test('loginUser should return 401 for wrong password', async () => {
        const req = {
            body: { email: 'testuser@gmail.com', password: 'wrongpass' }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await loginUser(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });

    test('registerUser should register and return user', async () => {
        const req = {
            body: { username: 'newuser', email: 'new@example.com', password: 'abc123' }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await registerUser(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            message: 'User registered',
            user: expect.any(Object)
        });
    });
    test('registerUser should return 400 if missing fields', async () => {
        const req = {
            body: { username: '', email: '', password: '' }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await registerUser(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'All fields are required' });
    });

    test('registerUser should return 500 if insert fails', async () => {
        // Override insert to simulate error
        const db = require('../config/db');
        db.from.mockReturnValueOnce({
            insert: jest.fn(() => ({
                select: jest.fn(() => ({
                    data: null,
                    error: { message: 'Insert failed' }
                }))
            }))
        });

        const req = {
            body: { username: 'failuser', email: 'fail@example.com', password: 'abc123' }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await registerUser(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Insert failed' });
    });
});
