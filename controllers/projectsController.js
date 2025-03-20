const supabase = require("../config/db");
const axios = require("axios");
const formidable = require('formidable');
const fs = require("fs");
const FormData = require('form-data');
const streamifier = require('streamifier');
const { getFullChecklist } = require("../utils/azureFiles.js")


// Helper function to get project details from the database
async function getProjectDetails(projectId) {
  try {

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('projectid', projectId)
      .single();

    if (projectError || !project) {
      throw new Error('Project details not found.');
    }

    const { data: cargos, error: cargosError } = await supabase
      .from('cargo')
      .select('*')
      .eq('projectid', projectId);

    if (cargosError || !cargos) {
      throw new Error('Cargo details not found.');
    }

    const { data: scopes, error: scopesError } = await supabase
      .from('scope')
      .select('*')
      .eq('projectid', projectId);

    if (scopesError || !scopes) {
      throw new Error('Scope details not found.');
    }

    return { project, cargos, scopes };
  } catch (error) {
    throw new Error(`Error fetching project details: ${error.message}`);
  }
}

// Helper function to transform project data into the required format
function transformProjectData({ project, cargos, scopes }) {

  console.log(cargos)

  const transformedData = {
    projectid: project.projectid,
    client_name: project.client,
    project_name: project.projectname,
    start_location: project.startdestination,
    end_location: project.enddestination,
    cargos: cargos.map(cargo => ({
      cargo_name: cargo.cargoname,
      dimensions: {
        length: cargo.length,
        breadth: cargo.breadth,
        height: cargo.height,
        weight: cargo.weight
      },
      quantity: cargo.quantity
    })),
    scopes: scopes.map(scope => ({
      start: scope.start,
      description: scope.work,
      equipment: scope.equipment || ""
    }))
  };

  console.log(transformedData);
  return transformedData;
}

function categorizeScope(scopes) {
  let hasLifting = false;
  let hasTransportation = false;

  scopes.forEach(scope => {
    if (scope.work.toLowerCase().includes("lifting")) {
      hasLifting = true;
    }
    if (scope.work.toLowerCase().includes("transportation")) {
      hasTransportation = true;
    }
  });

  if (hasLifting && hasTransportation) return "LiftingandTransportation";
  if (hasLifting) return "Lifting";
  if (hasTransportation) return "Transportation";
  return "Other";
}

// Function to process the request and call the external API
async function processRequest(req, res) {
  const { projectid } = req.body;

  try {
    if (!projectid) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const projectDetails = await getProjectDetails(projectid);

    const requestBody = transformProjectData(projectDetails);
    const response1 = await axios.post('http://127.0.0.1:5000/generate_ms', requestBody);

    const scopeCategory = categorizeScope(projectDetails.scopes);
    console.log(scopeCategory);
    const scopeRequestBody = { scope: scopeCategory, projectid: projectid };
    const response2 = await axios.post('http://127.0.0.1:5000/generate_ra', scopeRequestBody);

    return res.status(200).json({
      first_api_response: response1.data,
      second_api_response: response2.data
    });

  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

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
    return res.status(500).json({ error: "Error fetching data" })
  }

  res.json(data);
}

async function newProject(req, res) {
  const { projectname, client, emailsubjectheader, stakeholders, cargo } = req.body;

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .insert([{ projectname, client, emailsubjectheader, startdate: new Date().toISOString(), stage: "seller" }])
    .select("projectid")
    .single();

  if (projectError) throw projectError;
  const projectid = projectData.projectid;

  const stakeholderEntries = stakeholders.map(s => ({
    projectid,
    userid: s.userid,
    role: s.role
  }));
  await supabase.from("stakeholders").insert(stakeholderEntries);

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
//helper function
async function getScope(req, res) {
  try {
    const { projectid } = req.body;

    if (!projectid) {
      return res.status(400).json({ error: "Project ID is required" });
    }

    const { data, error } = await supabase
      .from("scope")
      .select("work")
      .eq("projectid", projectid);

    if (error) {
      console.error("Error fetching scope:", error);
      return res.status(500).json({ error: error.message });
    }
    const scopeArr = [];

    data.forEach(obj => {
      if (obj.work == "Lifting" || obj.work == "Transportation" || obj.work == "Forklift") {
        scopeArr.push(obj["work"]);
      }
    })
    res.json(scopeArr)
    return scopeArr
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
async function insertChecklistEntries(checklist_obj) {
  const { data, error } = await supabase
    .from("checklist")
    .insert(checklist_obj)
    .select();

  if (error) {
    console.error("Error inserting rows:", error.message);
    return { success: false, error: error.message };
  } else {
    console.log("Inserted rows:", data);
    return { success: true, insertedData: data };
  }
}

//add to checklist table
//required: pass projectid into req.body
async function generateChecklist(req, res) {
  const { projectid } = req.body
  // get the full checklist from azure 
  const fullChecklist = await getFullChecklist();
  //get scope
  const scopeArr = await getScope(req, res);
  // console.log(scopeArr)
  const filteredChecklist = {}
  filteredChecklist.OffSiteFixed = fullChecklist["OffSiteFixed"]
  filteredChecklist.OnSiteFixed = fullChecklist["OnSiteFixed"]
  scopeArr.forEach(scope => {
    filteredChecklist[scope] = fullChecklist[scope]
  })
  const checklist_obj = []
  for (let key in filteredChecklist) {
    for (let subkey in filteredChecklist[key]) {
      checklist_obj.push({ completed: false, type: key, subtype: subkey, projectid: projectid })
    }
  }
  const insertResult = await insertChecklistEntries(checklist_obj);

  if (!insertResult.success) {
    return res.status(500).json({ error: insertResult.error });
  }

  res.json({ message: "Checklist generated and inserted successfully", insertedData: insertResult.insertedData });

}

async function updateChecklistCompletion(req, res) {
  try {
    const { type, subtype, projectid } = req.body;

    if (!type || !subtype || !projectid) {
      return res.status(400).json({ error: "type, subtype and projectid is required" });
    }
    const { data: existingData, error: fetchError } = await supabase
      .from("checklist")
      .select("completed")
      .eq("type", type)
      .eq("subtype", subtype)
      .eq("projectid", projectid)
      .single();

    if (fetchError || !existingData) {
      return res.status(404).json({ error: "Checklist entry not found" });
    }

    const newCompletedValue = !existingData.completed;

    const { data, error } = await supabase
      .from("checklist")
      .update({ completed: newCompletedValue })
      .eq("type", type)
      .eq("subtype", subtype)
      .eq("projectid", projectid)
      .select();

    if (error) {
      console.error("Error updating checklist:", error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, updatedData: data });

  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function getProjectChecklist(req, res) {
  const fullChecklist = await getFullChecklist();
  try {
    const { projectid } = req.body;
    const { data, error } = await supabase
      .from("checklist")
      .select("type, subtype, completed")
      .eq("projectid", projectid)

    let uniqueScopes;
    if (error) {
      console.error("Error fetching checklist types:", error.message);
    } else {
      uniqueScopes = [...new Set(data.map(item => item.type))];
    }
    const filteredChecklist = {}
    filteredChecklist.OffSiteFixed = fullChecklist["OffSiteFixed"]
    filteredChecklist.OnSiteFixed = fullChecklist["OnSiteFixed"]
    uniqueScopes.forEach(scope => {
      filteredChecklist[scope] = fullChecklist[scope]
    })
    for (const checklistItem of data) {
      const { type, subtype, completed } = checklistItem;
      if (filteredChecklist[type] && filteredChecklist[type][subtype]) {
        filteredChecklist[type][subtype] = { ...filteredChecklist[type][subtype], completed };
      }
    }
    res.json(filteredChecklist);
  } catch (err) {
    console.error("Error fetching checklist:", err);
    return null;
  }
}

module.exports = { getProjects, getStakeholders, newProject, changeProjectStage, saveProject, processRequest, getScope, generateChecklist, insertChecklistEntries, updateChecklistCompletion, getProjectChecklist };