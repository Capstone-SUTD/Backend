// __mocks__/config/db.js
console.log("🧪 Mock Supabase loaded");

const users = [
    { userid: 1, username: 'HSE-Test', email: 'hsetest@gmail.com', password: 'password123' },
    { userid: 2, username: 'Test', email: 'testuser@gmail.com', password: 'password123' },
    { userid: 3, username: 'Operations-Test', email: 'opstest@gmail.com', password: 'password123' },
];
const supabase = {
    from: jest.fn((table) => {
        console.log(`🔍 Mocked supabase.from called with table: ${table}`);
        if (table === "users") {
            return {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn(() => {
                            const user = users.find(u => u.email === "testuser@gmail.com"); // or match on value param
                            return {
                                data: user,
                                error: user ? null : { message: "User not found" }
                            };
                        })
                    }))
                })),
                insert: jest.fn(() => ({
                    select: jest.fn(() => {
                        const newUser = { userid: 4, ...users[0] }; // or customize with insertData
                        return { data: [newUser], error: null };
                    })
                }))
            };
        }
        return {
            select: jest.fn(() => ({
                eq: jest.fn((column, value) => {
                    switch (table) {
                        case 'projects':
                            return {
                                data: {
                                    projectid: 149,
                                    client: 'ACME Corp',
                                    projectname: 'Heavy Lift Project',
                                    startdestination: 'Warehouse A',
                                    enddestination: 'Site B'
                                },
                                error: null,
                            };
                        case 'cargo':
                            return {
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
                            };
                        case 'scope':
                            return {
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
                            };
                        case 'checklist':
                            return {
                                data: [
                                    {
                                        taskid: 449,
                                        type: 'OffSiteFixed',
                                        subtype: 'Administrative',
                                        completed: true,
                                        has_comments: true,
                                        has_attachment: false,
                                        projectid: 149
                                    }
                                ],
                                error: null
                            };
                        case 'checklist_comments':
                            return {
                                data: [
                                    {
                                        commentid: 34,
                                        comments: 'hey there',
                                        username: 'Test',
                                        userid: 2,
                                        projectid: 149,
                                        taskid: 449
                                    }
                                ],
                                error: null
                            };
                        case 'checklist_attachments':
                            return {
                                data: [
                                    {
                                        taskid: 495,
                                        bloburl: '1743313407702-Screenshot.png',
                                        filename: null
                                    }
                                ],
                                error: null
                            };
                        case 'files':
                            return {
                                data: [
                                    {
                                        fileid: 152,
                                        projectid: 149,
                                        filetype: 'MS',
                                        bloburl: 'https://capstoneproj.blob.core.windows.net/files/MS-example.pdf',
                                        version: 1
                                    }
                                ],
                                error: null
                            };
                        case 'ms_reader':
                            return {
                                data: [
                                    {
                                        id: 8,
                                        scope: 'Lifting',
                                        equipment: '300 ton crane',
                                        procedure: '1. Checking of cargoes by lifting team'
                                    }
                                ],
                                error: null
                            };
                        case 'projects':
                            return {
                                data: [
                                    { projectid: 149, projectname: 'Test', startdestination: 'SG', enddestination: 'kl', client: 'Tvli' },
                                    { projectid: 150, projectname: 'zx', startdestination: 'local', enddestination: 'kl', client: 'zx' },
                                    { projectid: 151, projectname: 'hii', startdestination: 'SG', enddestination: 'KL', client: 'hiii' },
                                ],
                                error: null,
                            };
                        case 'ra_reader':
                            return {
                                data: [
                                    {
                                        id: 1,
                                        scope: "Lifting",
                                        workactivity: "Lifting Operation Cont",
                                        hazard: "Unsafe lifting procedures Pinch Point",
                                        injury: "Rigger handling of loads when lifted or lowered",
                                        riskcontrol: "12 Centre of Gravity CG It is always important to identify CG of the load",
                                        s: 4,
                                        l: 2,
                                        rpn: 8
                                    },
                                    {
                                        id: 2,
                                        scope: "Lifting",
                                        workactivity: "Lifting Operation Cont",
                                        hazard: "Invalid test certificate for LG LA or LP",
                                        injury: "Snapping of lifting equipment Property Damage",
                                        riskcontrol: "4 Visual check on chains there are no knots or signs of wear",
                                        s: 4,
                                        l: 2,
                                        rpn: 8
                                    },
                                ],
                                error: null,
                            };
                        case 'scope':
                            return {
                                data: [
                                    { projectid: 149, start: 'SG', end: 'SG', work: 'Lifting', equipment: '300 ton crane' },
                                    { projectid: 149, start: 'sg', end: 'kl', work: 'Transportation', equipment: 'Low Bed trailer' },
                                    { projectid: 150, start: 'local', end: 'local', work: 'Lifting', equipment: '300 ton crane' },
                                ],
                                error: null,
                            };
                        case 'stakeholders':
                            return {
                                data: [
                                    { projectid: 149, userid: 1, role: 'HSEOfficer' },
                                    { projectid: 149, userid: 3, role: 'Operations' },
                                    { projectid: 149, userid: 2, role: 'Additional' },
                                ],
                                error: null,
                            };
                        default:
                            return { data: null, error: { message: 'Mock table not found' } };
                    }
                })
            })),
            insert: jest.fn(() => ({ data: [], error: null })),
            update: jest.fn(() => ({ data: [], error: null })),
            delete: jest.fn(() => ({ data: [], error: null })),
            upsert: jest.fn(() => ({ data: [], error: null })),
        };
    })
};

module.exports = supabase;