const supabase = require("../config/db");
const axios = require("axios");
const formidable = require('formidable');
const fs = require("fs");
const FormData = require('form-data'); 
const streamifier = require('streamifier');

async function saveProject(req, res) {
    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields, files) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const { projectid, scope } = fields;
        const VendorMS = files.VendorMS[0];
        const VendorRA = files.VendorRA[0];

        if (!projectid || !scope) {
            return res.status(400).json({ error: "Invalid request format" });
        }

        const projectidInt = parseInt(projectid[0]);
        const scopeArray = scope.map(item => JSON.parse(item)).flat();
        console.log(projectidInt, scopeArray);

        // Determine `startdestination` and `enddestination`
        const startdestination = scopeArray[0]?.start;
        const enddestination = scopeArray[scopeArray.length - 1]?.end;
        console.log(startdestination, enddestination);

        // Store in `projects` table
        await supabase
            .from("projects")
            .update({ startdestination, enddestination })
            .eq("projectid", projectidInt);

        // Insert all scope items
        const scopeData = scopeArray.map(({ start, end, work, equipment }) => ({
            projectid: projectidInt,
            start,
            end,
            work,
            equipment,
        }));
        await supabase.from("scope").insert(scopeData);

        // **Filter Equipment that contains "crane"**
        const craneEquipment = scopeArray.find(({ equipment }) =>
            equipment.toLowerCase().includes("crane")
        );
        if (craneEquipment) {
            const equipment = craneEquipment.equipment;
        }

        // Handle VendorMS API Call
        if (VendorMS) {
            const vendorMSPath = VendorMS.filepath;
            const vendorMSStream = fs.createReadStream(vendorMSPath);

            // Prepare form-data for VendorMS
            const vendorMSForm = new FormData();
            vendorMSForm.append("ms", vendorMSStream, { filename: "vendorMSFile" });
            vendorMSForm.append("scope", "Lifting");
            vendorMSForm.append("equipment", craneEquipment.equipment ? craneEquipment.equipment : "300 ton mobile crane");

            // Send the request with form-data
            try {
                const flaskResponse = await axios.post("http://127.0.0.1:5000/MSReader", vendorMSForm, {
                    headers: {
                        ...vendorMSForm.getHeaders(), // Automatically set proper headers for form-data
                    }
                });
                console.log("MS Read Successful");

            } catch (error) {
                console.error("Error in VendorMS API Call:", error.message);
            }
        }

        // Handle VendorRA API Call
        if (VendorRA) {
            const vendorRAPath = VendorRA.filepath;
            const vendorRABuffer = fs.readFileSync(vendorRAPath);
            const vendorRAStream = streamifier.createReadStream(vendorRABuffer);

            // Prepare form-data for VendorRA
            const vendorRAForm = new FormData();
            vendorRAForm.append("file", vendorRAStream, { filename: "vendorRAFile" });

            // Send the request with form-data
            try {
                const flaskResponse = await axios.post("http://127.0.0.1:5000/RAReader", vendorRAForm, {
                    headers: {
                        ...vendorRAForm.getHeaders(), // Automatically set proper headers for form-data
                    }
                });
                console.log("RA Read Successful");

            } catch (error) {
                console.error("Error in VendorRA API Call:", error);
            }
        }

        // Respond with success message
        res.json({ message: "Project scope updated and Document Readers ran successfully" });
    });
}

async function getProjects(req, res) {
    const userId = req.user.id;

    const { data: stakeholderData, error: stakeholderError } = await supabase
    .from("stakeholders")
    .select("projectid")
    .eq("userid", userId);

    if (stakeholderError) {
    return res.status(500).json({ error: "Error fetching stakeholder data" });
    }

    if (!stakeholderData.length) {
    return res.status(404).json({ error: "No projects found for this user" });
    }

    // Extract project IDs
    const projectIds = stakeholderData.map((stakeholder) => stakeholder.projectid);

    // Fetch all project details that match the retrieved project IDs
    const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("*")
    .in("projectid", projectIds);

    if (projectsError) {
    return res.status(500).json({ error: "Error fetching project data" });
    }

    res.json(projects);
}

async function getStakeholders(req, res) {
    const { data, error } = await supabase
    .from("users")
    .select("userid, username");

    if (error) {
        return res.status(500).json({error: "Error fetching data"})
    }

    res.json(data);
}

async function newProject(req,res) {
    const { projectname, client, emailsubjectheader, stakeholders, cargo } = req.body;

    // Step 1: Insert project and get project ID
    const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .insert([{ projectname, client, emailsubjectheader, startdate: new Date().toISOString(), stage: "seller" }])
        .select("projectid")
        .single();

    if (projectError) throw projectError;
    const projectid = projectData.projectid;

    // Step 2: Insert stakeholders
    const stakeholderEntries = stakeholders.map(s => ({
        projectid,
        userid: s.userid,
        role: s.role
    }));
    await supabase.from("stakeholders").insert(stakeholderEntries);

    // Step 3: Insert cargo & determine OOG status
    const threshold = { weight: 4000, length: 3, breadth: 3, height: 1 };
    
    const cargoEntries = cargo.map(item => ({
        projectid,
        cargoname: item.cargoname,
        length: item.length,
        breadth: item.breadth,
        height: item.height,
        weight: item.weight,
        quantity: item.quantity,
        oog: (item.weight > threshold.weight || item.length > threshold.length ||
                    item.breadth > threshold.breadth || item.height > threshold.height) ? "Yes" : "No"
    }));
    await supabase.from("cargo").insert(cargoEntries);

    // Step 4: Response Format
    res.json({
        projectid,
        cargo: cargoEntries
    });
}

async function changeProjectStage(req, res) {
    const { projectid, stage } = req.body;

    // Validate request body
    if (!projectid || !stage) {
        return res.status(400).json({ error: "projectid and stage are required" });
    }

    // Update the stage column for the given projectid
    const { data, error } = await supabase
        .from("projects")
        .update({ stage })
        .eq("projectid", projectid);

    if (error) throw error;

    res.json({ message: "Project stage updated successfully", projectid, stage });

}

module.exports = { getProjects, getStakeholders, newProject, changeProjectStage, saveProject };