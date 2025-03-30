
const { getUserName } = require('./userUtils');

jest.mock('./userutils', () => ({
  getUserName: jest.fn()
}));

const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => Promise.resolve({ data: [{ commentid: 1 }], error: null })),
  upsert: jest.fn(() => ({ select: () => Promise.resolve({ data: [{ id: 1 }], error: null }) })),
  update: jest.fn(() => ({ eq: () => ({ select: () => Promise.resolve({ data: [{ id: 1 }], error: null }) }) })),
  delete: jest.fn(() => ({ eq: () => ({ select: () => Promise.resolve({ data: [{ id: 1 }], error: null }) }) })),
  single: jest.fn(() => Promise.resolve({ data: { userid: 42 }, error: null }))
};

jest.mock('../config/db', () => mockSupabase);
const controller = require('../controllers/projectsController');

describe('Comment controller tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {},
      body: {},
      user: { id: 42 }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  test('getTaskComments - missing taskid', async () => {
    await controller.getTaskComments(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing taskid' });
  });

  test('getTaskComments - success', async () => {
    req.query.taskid = '123';
    await controller.getTaskComments(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ commentid: 1 }]);
  });

  test('addTaskComments - missing taskid', async () => {
    await controller.addTaskComments(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });


  test('updateTaskComments - forbidden if not owner', async () => {
    mockSupabase.select = jest.fn(() => ({
      eq: () => Promise.resolve({ data: [{ userid: 99 }], error: null }) // Not the same user
    }));

    req.body = { commentid: 123, comments: 'Update comment' };
    await controller.updateTaskComments(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden: You are not the owner of this comment.'
    });
  });


  test('deleteTaskComments - success', async () => {
    req.query = { commentid: '1', taskid: '1' };

    mockSupabase.select = jest.fn(() => ({
      eq: () => ({
        single: () => Promise.resolve({ data: { userid: 42 }, error: null })
      })
    }));

    mockSupabase.delete = () => ({
      eq: () => ({
        select: () => Promise.resolve({ data: [{ id: 1 }], error: null })
      })
    });

    await controller.deleteTaskComments(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      deleted: [{ id: 1 }]
    });
  });
});
