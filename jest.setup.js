beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => { });
});
beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => { });
});