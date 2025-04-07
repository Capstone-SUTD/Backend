require("dotenv").config();
const supabase = require("../config/db");
const axios = require("axios");
const formidable = require('formidable');
const fs = require("fs");
const FormData = require('form-data');
const streamifier = require('streamifier');
const { getFullChecklist, uploadFile, generateSasUrl } = require("../utils/azureFiles.js");

async function getStage(req, res) {
  try {
    const projectid = parseInt(req.query.projectid, 0);
    if (!projectid) return res.status(400).json({ error: "Project ID is required" });

    const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select('*')
    .eq('projectid', projectid)
    .single();

    if (projectError || !projectData) {
      return res.status(403).json({ error: "Project not found." });
    }

    return res.status(200).json({stage: projectData.stage});
  } catch (err) {
    throw new Error(`Error fetching project details: ${err.message}`);
  }
};


async function closeProject(req, res) {
  const { projectid } = req.body;
  const userid = req.user.id;

  const { data: userData, error: userError } = await supabase
    .from("stakeholders")
    .select('*')
    .eq('projectid', projectid)
    .eq('userid', userid)
    .single();

  console.log(userData);
  console.log(userError);

  if (userError || !userData) {
    return res.status(403).json({ error: "You are not a stakeholder for this project." });
  }

  if (userData.role != "Operations") {
    return res.status(403).json({ error: "Only Operations Manager can close the project." });
  } else {
    const { error: updateError } = await supabase
      .from("projects")
      .update({ stage: "Project Completion" })
      .eq("projectid", projectid);

    if (updateError) {
      return res.status(500).json({ error: "Failed to update project stage." });
    }

    return res.status(200).json({ message: "Project successfully closed." });
  }
}

// Helper function to get project details from the database
async function getProjectDetails(projectId) {
  try {

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('projectid', projectId)
      .single();

    if (projectError || !project) {
      throw new Error(`Project details not found. ${projectError?.message || ''}`);
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
    console.error('Supabase fetch failed:', error);
    throw new Error(`Error fetching project details: ${error.message}`);
  }
}

// Helper function to transform project data into the required format
function transformProjectData({ project, cargos, scopes }) {
  if (!project || !cargos || !scopes) {
    throw new Error('Missing project, cargos, or scopes data.');
  }

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

  return transformedData;
}

function categorizeScope(scopes) {
  if (!Array.isArray(scopes)) {
    throw new Error('Invalid input: scopes should be an array.');
  }
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

async function equipment(req, res) {
  const { width, length, height, weight } = req.body;
  if ([width, length, height, weight].some(val => typeof val !== 'number')) {
    return res.status(400).json({ error: 'Invalid input. width, length, height, and weight must be numbers.' });
  }
  const requestBody = {
    "width": width,
    "length": length,
    "height": height,
    "weight": weight
  }
  try {
    const response = await axios.post('https://subsystems.azurewebsites.net/api/equipment', requestBody);
    if (!response?.data) {
      return res.status(502).json({ error: 'No data returned from equipment service.' });
    }
    return res.status(200).json(response.data)
  } catch (error) {

    console.error('Equipment API error:', error.message);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
// Function to process the request and call the external API
async function processRequest(req, res) {
  const { projectid } = req.body;

  if (!projectid) {
    return res.status(400).json({ error: 'Invalid Input. Project ID is required' });
  }

  try {

    const projectDetails = await getProjectDetails(projectid);

    const requestBody = transformProjectData(projectDetails);
    const response1 = await axios.post('https://subsystems.azurewebsites.net/api/generate_ms', requestBody);
    if (!response1?.data) throw new Error("MS API did not return any data");

    const scopeCategory = categorizeScope(projectDetails.scopes);
    console.log(scopeCategory);
    const scopeRequestBody = { scope: scopeCategory, projectid: projectid };
    const response2 = await axios.post('https://subsystems.azurewebsites.net/api/generate_ra', scopeRequestBody);
    if (!response2?.data) throw new Error("RA API did not return any data");
    const { error: updateError } = await supabase
      .from("projects")
      .update({ stage: "MSRA Generated" })
      .eq("projectid", projectid);

    console.log(updateError);
    if (updateError) {
      return res.status(500).json({ error: "Failed to update project stage." });
    }
    return res.status(200).json({
      first_api_response: response1.data,
      second_api_response: response2.data
    });

  } catch (error) {
    console.error("Error in processRequest:", error.message);
    return res.status(500).json({ error: `Failed to process project: ${error.message}` });
  }
}

async function saveProject(req, res) {
  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to parse form data', details: err.message });
    }

    const { projectid, scope } = fields;
    const VendorMS = files?.VendorMS;
    const VendorRA = files?.VendorRA;

    if (!projectid || !scope) {
      return res.status(400).json({ error: "Invalid request format" });
    }

    const projectidInt = parseInt(projectid[0]);
    const scopeArray = scope.map(item => {
      try {
        return JSON.parse(item);
      } catch (e) {
        console.error("Invalid JSON in scope:", item);
        return null;
      }
    }).flat();
    if (!scopeArray.length) {
      return res.status(400).json({ error: "Invalid or empty scope data" });
    }
    // Determine `startdestination` and `enddestination`
    const startdestination = scopeArray[0]?.start;
    const enddestination = scopeArray[scopeArray.length - 1]?.end;
    console.log(startdestination, enddestination);

    // Store in `projects` table
    try {
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
    } catch (dbError) {
      console.error("Database error:", dbError.message);
      return res.status(500).json({ error: "Failed to save project scope." });
    }

    let equip = "300 ton crane"
    // **Filter Equipment that contains "crane"**
    const craneEquipment = scopeArray.find(({ equipment }) =>
      equipment?.toLowerCase().includes("crane")
    );
    if (craneEquipment) {
      equip = craneEquipment.equipment;
    } else {
      equip = "";
    }

    // Handle VendorMS API Call
    try {
      if (VendorMS && equip) {
        const vendorMSPath = VendorMS[0].filepath;
        const vendorMSStream = fs.createReadStream(vendorMSPath);

        // Prepare form-data for VendorMS
        const vendorMSForm = new FormData();
        vendorMSForm.append("ms", vendorMSStream, { filename: "vendorMSFile" });
        vendorMSForm.append("scope", "Lifting");
        vendorMSForm.append("equipment", equip);

        // Send the request with form-data
        await axios.post("https://subsystems.azurewebsites.net/api/MSReader", vendorMSForm, {
          headers: {
            ...vendorMSForm.getHeaders(), // Automatically set proper headers for form-data
          }
        });
        console.log("MS Read Successful");
      }

    } catch (msErr) {
      console.error("VendorMS Error:", msErr.message);
    }


    // Handle VendorRA API Call
    try {
      if (VendorRA) {
        const vendorRAPath = VendorRA[0].filepath;
        const vendorRABuffer = fs.readFileSync(vendorRAPath);
        const vendorRAStream = streamifier.createReadStream(vendorRABuffer);

        // Prepare form-data for VendorRA
        const vendorRAForm = new FormData();
        vendorRAForm.append("file", vendorRAStream, { filename: "vendorRAFile" });

        await axios.post("https://subsystems.azurewebsites.net/api/RAReader", vendorRAForm, {
          headers: vendorRAForm.getHeaders()
        });
        console.log("RA Read Successful");
      }
    }
    catch (raErr) {
      console.error("VendorRA Error:", raErr.message);

    }

    // Respond with success message
    res.json({ message: "Project scope updated and Document Readers ran successfully" });
  });
}

async function getProjects(req, res) {
  const userId = req.user.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized: User not found in request." });
  }
  try {
    const { data: stakeholderData, error: stakeholderError } = await supabase
      .from("stakeholders")
      .select("projectid")
      .eq("userid", userId);

    if (stakeholderError) {
      console.error("Stakeholder fetch error:", stakeholderError.message);
      return res.status(500).json({ error: "Error fetching stakeholder data" });
    }

    if (!stakeholderData || stakeholderData.length === 0) {
      return res.status(200).json({ projects: [] });
    }

    // Extract project IDs
    const projectIds = stakeholderData.map((stakeholder) => stakeholder.projectid);

    // Fetch all project details that match the retrieved project IDs
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("*")
      .in("projectid", projectIds);

    if (projectsError) {
      console.error("Project fetch error:", projectsError.message);
      return res.status(500).json({ error: "Error fetching project data" });
    }

    // Fetch stakeholders, cargo, and scope for each project
    const enrichedProjects = await Promise.all(
      projects.map(async (project) => {
        // Check if there are files for the current project
        const { data: filesData, error: filesError } = await supabase
          .from("files")
          .select("projectid")
          .eq("projectid", project.projectid);

        if (filesError) {
          return res.status(500).json({ error: "Error fetching files data" });
        }

        // Determine the MSRA value
        const MSRA = filesData.length > 0; // Set to true if there are any files

        const [stakeholders, cargo, scope] = await Promise.all([
          supabase.from("stakeholders").select("*").eq("projectid", project.projectid),
          supabase.from("cargo").select("*").eq("projectid", project.projectid),
          supabase.from("scope").select("*").eq("projectid", project.projectid),
        ]);

        // Enrich stakeholders with usernames
        const enrichedStakeholders = await Promise.all(
          stakeholders.data.map(async (stakeholder) => {
            try {
              const { data: userData, error: userError } = await supabase
                .from("users")
                .select("username, email")
                .eq("userid", stakeholder.userid)
                .single();

              if (userError) {
                return { ...stakeholder, name: "Unknown", email: "Unknown" };
              }

              return { ...stakeholder, name: userData.username, email: userData.email };
            } catch (userLookupError) {
              console.error(`User lookup failed for stakeholder ${stakeholder.userid}`);
              return { ...stakeholder, name: "Unknown", email: "Unknown" };
            }
          })
        );

        return {
          ...project,
          projectStatus: project.stage === "Project Completion" ? "Completed" : "In Progress",
          MSRA: MSRA,
          stakeholders: enrichedStakeholders,
          cargo: cargo.data || [],
          scope: scope.data || [],
        };
      })
    );

    res.json(enrichedProjects);
  } catch (unexpectedError) {
    console.error("Unexpected error in getProjects:", unexpectedError.message);
    return res.status(500).json({ error: "Unexpected error while retrieving projects" });
  }
}

async function submitFeedback(req, res) {
  const { projectid, comments, role } = req.body;
  const userid = req.user.id;

  if (!projectid) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const { data, error: userError } = await supabase
    .from("stakeholders")
    .select("*")
    .eq("projectid", projectid)
    .eq('userid', userid);

  if (userError) return res.status(500).json({ error: userError.message });
  if (!data || data.length === 0) {
    return res.status(403).json({ error: "You are not a stakeholder for this project." });
  }

  if (data[0].role !== role) {
    return res.status(403).json({ error: `Only ${role} can submit feedback here but ${data[0].role} provided` });
  }

  const { newdata, error } = await supabase
    .from("stakeholders")
    .update({ comments: comments })  // Update the comments
    .eq("projectid", projectid)      // Match the projectid
    .eq("userid", userid)            // Match the userid
    .select();

  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json({ message: "Submitted Successfully" });

}

async function stakeholderComments(req, res) {
  const { projectid } = req.body;
  if (!projectid) {
    return res.status(400).json({ error: "All fields are required" });
  }

  // Fetch stakeholders' user IDs and comments
  const { data: stakeholders, error: stakeholderError } = await supabase
    .from("stakeholders")
    .select("userid, comments, role")
    .eq("projectid", projectid);

  if (stakeholderError) {
    return res.status(500).json({ error: "Error fetching stakeholders" });
  }

  if (stakeholders.length === 0) {
    return res.json([]); // Return an empty list if no stakeholders are found
  }

  // Extract unique user IDs
  const userIds = stakeholders.map(s => s.userid);

  // Fetch user details for those user IDs
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("userid, username")
    .in("userid", userIds);

  if (userError) {
    return res.status(500).json({ error: "Error fetching user data" });
  }

  // Map user data to a dictionary for quick lookup
  const userMap = Object.fromEntries(users.map(user => [user.userid, user.username])); // Ensure the key is 'userid'

  // Format final response
  const formattedData = stakeholders.map(s => ({
    userid: s.userid,
    role: s.role,
    name: userMap[s.userid] || "Unknown", // Default to "Unknown" if user is not found
    comments: s.comments ?? "",
  }));

  res.json(formattedData);
}

async function getStakeholders(req, res) {
  const { data, error } = await supabase
    .from("users")
    .select("userid, username", "comments");

  if (error) {
    return res.status(500).json({ error: "Error fetching data" })
  }

  res.json(data);
}

async function newProject(req, res) {
  const { projectname, client, emailsubjectheader, stakeholders, cargo } = req.body;

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .insert([{ projectname, client, emailsubjectheader, startdate: new Date().toISOString(), stage: "Project Kickoff" }])
    .select("projectid")
    .single();

  if (projectError) throw projectError;
  const projectid = projectData.projectid;

  const stakeholderEntries = stakeholders.map(s => ({
    projectid,
    userid: s.userId,
    role: s.role
  }));
  await supabase.from("stakeholders").insert(stakeholderEntries);
  await supabase.from("stakeholders").insert({ projectid, userid: 13, role: "Head" })

  const threshold = { weight: 30480, length: 12.03, breadth: 2.35, height: 2.39 };

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
async function getScope(projectid) {
  try {
    if (!projectid) {
      throw new Error("Project ID is required");
    }

    const { data, error } = await supabase
      .from("scope")
      .select("work")
      .eq("projectid", projectid);

    if (error) {
      console.error("Supabase scope query error:", error.message);
      throw new Error("Failed to fetch scope data from database.");
    }
    if (!data || !Array.isArray(data)) {
      throw new Error("Invalid scope data received.");
    }
    return data
      .filter(obj =>
        ["Lifting", "Transportation", "Forklift"].includes(obj.work)
      )
      .map(obj => obj.work);
  } catch (err) {
    console.error("getScope error:", err.message);
    throw new Error("getScope failed: " + err.message);
  }

}

async function insertChecklistEntries(checklist_obj) {
  try {
    if (!Array.isArray(checklist_obj) || checklist_obj.length === 0) {
      throw new Error("Checklist object must be a non-empty array.");
    }

    const { data, error } = await supabase
      .from("checklist")
      .insert(checklist_obj)
      .select();
    if (error) {
      console.error("Error inserting rows:", error.message);
      return { success: false, error: error.message };
    }
    console.log("Inserted rows:", data);
    return { success: true, insertedData: data };
  } catch (err) {
    console.error("insertChecklistEntries failed:", err.message);
    return { success: false, error: err.message };
  }
}

//add to checklist table
//required: pass projectid into req.body
async function generateChecklist(req, res) {
  const { projectid } = req.body
  if (!projectid) {
    return res.status(400).json({ error: "Project ID is required." });
  }
  try {
    const fullChecklist = await getFullChecklist();
    if (!fullChecklist || typeof fullChecklist !== "object") {
      throw new Error("Invalid or empty checklist data received.");
    }
    const scopeArr = await getScope(projectid);
    if (!Array.isArray(scopeArr) || scopeArr.length === 0) {
      throw new Error("No valid scope entries found for this project.");
    }
    const filteredChecklist = {}
    filteredChecklist.OffSiteFixed = fullChecklist["OffSiteFixed"]
    filteredChecklist.OnSiteFixed = fullChecklist["OnSiteFixed"]
    scopeArr.forEach(scope => {
      if (fullChecklist[scope]) {
        filteredChecklist[scope] = fullChecklist[scope];
      } else {
        console.warn(`No checklist entries found for scope: ${scope}`);
      }
    })
    const checklist_obj = []
    for (let key in filteredChecklist) {
      for (let subkey in filteredChecklist[key]) {
        checklist_obj.push({ projectid: projectid, has_comments: false, type: key, completed: false, subtype: subkey, has_attachment: false });
      }
    }

    if (checklist_obj.length === 0) {
      throw new Error("No checklist entries to insert.");
    }

    const insertResult = await insertChecklistEntries(checklist_obj);

    if (!insertResult.success) {
      return res.status(500).json({ error: insertResult.error });
    }
    res.status(200).json({
      message: "Checklist generated and inserted successfully",
      insertedData: insertResult.insertedData
    });
  } catch (err) {
    console.error("generateChecklist error:", err.message);
    return res.status(500).json({ error: `Failed to generate checklist: ${err.message}` });
  }
}

async function updateChecklistCompletion(req, res) {
  try {
    const { taskid } = req.body;

    if (!taskid || typeof taskid !== "number") {
      return res.status(400).json({ error: "taskid is required" });
    }
    const { data: existingData, error: fetchError } = await supabase
      .from("checklist")
      .select("completed")
      .eq("taskid", taskid)
      .single();

    if (fetchError) {
      console.error("Error fetching checklist entry:", fetchError.message);
      return res.status(500).json({ error: "Database error while fetching checklist entry." });
    }
    if (!existingData) {
      return res.status(404).json({ error: "Checklist entry not found." });
    }

    const newCompletedValue = !existingData.completed;

    const { data: updatedData, error: updateError } = await supabase
      .from("checklist")
      .update({ completed: newCompletedValue })
      .eq("taskid", taskid)
      .select();

    if (updateError) {
      console.error("Error updating checklist:", updateError.message);
      return res.status(500).json({ error: "Database error while updating checklist." });
    }
    if (!updatedData || updatedData.length === 0) {
      return res.status(500).json({ error: "Checklist update failed or returned no data." });
    }
    return res.status(200).json({
      success: true, message: `Checklist task ${taskid} marked as ${newCompletedValue ? "completed" : "not completed"}.`,
      updatedData
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function getProjectChecklist(req, res) {
  try {
    const { projectid } = req.query;
    if (!projectid) {
      return res.status(400).json({ error: "Missing 'projectid' in query." });
    }

    const fullChecklist = await getFullChecklist();
    if (!fullChecklist || typeof fullChecklist !== "object") {
      return res.status(500).json({ error: "Invalid or missing checklist template." });
    }

    const { data, error } = await supabase
      .from("checklist")
      .select("taskid, type, subtype, completed, has_comments,has_attachment")
      .eq("projectid", projectid)
    console.log(`data:${JSON.stringify(data)}`)
    if (error) {
      console.error("Supabase error:", error.message);
      return res.status(500).json({ error: "Database error while fetching checklist." });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "No checklist found for the specified project." });
    }
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
      const { taskid, type, subtype, completed, has_comments, has_attachment } = checklistItem;
      if (filteredChecklist[type] && filteredChecklist[type][subtype]) {
        filteredChecklist[type][subtype] = { ...filteredChecklist[type][subtype], taskid, completed, has_comments, has_attachment };
      }
    }
    return res.status(200).json(filteredChecklist);
  } catch (err) {
    console.error("Error fetching checklist:", err);
    return null;
  }
}

//helper
async function getUserName(userid) {
  const { data, error } = await supabase.from("users").select("username").eq("userid", userid);
  return data[0]["username"];
}

async function getTaskComments(req, res) {
  try {
    const { taskid } = req.query;

    if (!taskid || isNaN(parseInt(taskid))) {
      return res.status(400).json({ error: "Missing taskid" });
    }

    const { data: commentData, error: commentError } = await supabase
      .from("checklist_comments")
      .select("commentid,comments,username,userid").
      eq("taskid", taskid).order("timestamp", { ascending: true });

    if (commentError) {
      console.error("Error fetching comments:", commentError.message);
      return res.status(500).json({ error: commentError.message });
    }

    return res.status(200).json(commentData);
  } catch (err) {
    console.error("Unexpected error in getTaskComments:", err.message);
    return res.status(500).json({ error: "Internal server error." });
  }

}

async function addTaskComments(req, res) {
  const { taskid, comments, projectid } = req.body;
  try {
    if (!taskid || typeof taskid !== "number") {
      return res.status(400).json({ error: "Missing 'taskid' in request body." });
    }

    if (typeof comments !== "string") {
      return res.status(400).json({ error: "'comments' must be a string." });
    }
    if (!projectid || typeof projectid !== "string") {
      return res.status(400).json({ error: "'projectid' is required and must be a number." });
    }
    const userId = req?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: user ID missing from request." });
    }
    const username = await getUserName(userId)
    const { data: commentData, error: commentError } = await supabase
      .from("checklist_comments")
      .upsert([{ taskid, comments: comments, projectid: projectid, timestamp: new Date().toISOString(), username: username, userid: req.user.id }]).select();
    if (commentError) {
      console.error("Error updating checklist comments:", commentError.message);
      return res.status(500).json({ error: commentError.message });
    }
    if (!commentData || commentData.length === 0) {
      return res.status(500).json({ error: "Comment was not saved successfully." });
    }
    const { data: checklistUpdate, error: checklistError } = await supabase.from("checklist").update({ has_comments: true }).eq("taskid", taskid).select();

    if (checklistError) {
      console.error("Error updating checklist.has_comments:", commentError.message);
      return res.status(500).json({ error: "Comment saved, but failed to flag checklist entry. " + commentError.message });
    }

    if (!checklistUpdate || checklistUpdate.length === 0) {
      console.warn("Checklist taskid not found while updating has_comments.");
      return res.status(404).json({ error: "Comment saved, but checklist entry not found for taskid: " + taskid });
    }

    return res.status(200).json({ success: true, updatedData: commentData, updatedChecklist: checklistUpdate });
  }
  catch (err) {
    console.error("Unexpected error in addTaskComments:", err.message);
    return res.status(500).json({ error: "Internal server error." });
  }

}

async function updateTaskComments(req, res) {
  const { commentid, comments } = req.body;
  if (!commentid || typeof commentid !== "number") {
    return res.status(400).json({ error: "'commentid' is required and must be a number." });
  }

  if (typeof comments !== "string" || comments.trim() === "") {
    return res.status(400).json({ error: "'comments' must be a non-empty string." });
  }

  const userId = req?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized: user ID missing." });
  }

  const { data: existingComment, error: fetchError } = await supabase.from("checklist_comments").select("userid").eq("commentid", commentid);

  if (fetchError) {
    console.error("Error fetching comment:", fetchError.message);
    return res.status(500).json({ error: "Database error while checking comment ownership." });
  }


  if (!existingComment || existingComment.userid !== userId) {
    return res.status(403).json({ error: "Forbidden: You are not the owner of this comment." });
  }

  try {
    const { data: updatedComment, error: updateError } = await supabase
      .from("checklist_comments")
      .update({ comments })
      .eq("commentid", commentid)
      .select();

    if (updateError) {
      console.error("Error updating comment:", error.message);
      return res.status(500).json({ error: "Failed to update comment: " + error.message });
    }

    if (!updatedComment || updatedComment.length === 0) {
      return res.status(404).json({ error: "Comment not found or no changes made." });
    }
    return res.status(200).json({
      success: true,
      message: "Comment updated successfully.",
      updated: updatedComment
    });
  } catch (err) {
    console.error("Unexpected error:", updateError);
    return res.status(500).json({ error: "Unexpected error occurred." });
  }
}
async function deleteTaskComments(req, res) {
  const { commentid, taskid } = req.query;
  if (!commentid || isNaN(Number(commentid))) {
    return res.status(400).json({ error: "'commentid' is required and must be a number." });
  }
  if (!taskid || isNaN(Number(taskid))) {
    return res.status(400).json({ error: "'taskid' is required and must be a number." });
  }
  const userId = req?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized: user ID missing." });
  }
  const { data: comment, error: fetchError } = await supabase.from("checklist_comments").select("userid").eq("commentid", commentid)
    .single();
  if (fetchError) {
    console.error("Error fetching comment:", fetchError.message);
    return res.status(404).json({ error: "Database error while fetching comment." });
  }
  if (comment.userid !== userId) {
    return res.status(403).json({ error: "Forbidden: You are not the owner of this comment." });
  }

  try {
    const { data: deleted, error: deleteError } = await supabase.from("checklist_comments").delete().eq("commentid", commentid).select("*")

    if (deleteError) {
      console.error("Error deleting comment:", deleteError.message);

      return res.status(500).json({ error: deleteError.message });
    }

    if (!deleted || deleted.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }
    //check if there are any remaining comments for a particular task
    const { data: remainingComments, error: countError } = await supabase.from("checklist_comments").select("commentid").eq("taskid", taskid)
    if (countError) {
      console.error("Error querying checklist:", countError.message);
      return res.status(500).json({ error: "Failed to query checklist" });
    }

    if (!remainingComments || remainingComments.length === 0) {
      const { error: updateError } = await supabase
        .from("checklist")
        .update({ has_comments: false })
        .eq("taskid", taskid)
        .select("*");

      if (updateError) {
        console.error("Error updating has_comments:", updateError.message);
        return res.status(500).json({ error: "Failed to update has_comments" });
      }
    }

    return res.status(200).json({ success: true, deleted: deleted });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}

async function getBlobUrl(req, res) {
  const { taskid } = req.query;
  if (!taskid) {
    return res.status(400).json({ error: "Missing 'taskid' in request query." });
  }
  const { data, error } = await supabase.from("checklist_attachments").select("bloburl").eq("taskid", taskid);
  if (error || !data || data.length === 0) {
    return res.status(200).json(null);
  }
  const url = await generateSasUrl("checklist-attachments", data[0].bloburl)
  return res.status(200).json(url);
}

async function updateBlobUrl(taskid, blobUrl) {
  if (!taskid) {
    throw new Error("Missing taskid");
  }

  if (!blobUrl) {
    throw new Error("Missing blobUrl");
  }

  try {
    const { data: blobData, error: blobError } = await supabase
      .from("checklist_attachments")
      .upsert([{ taskid, bloburl: blobUrl }], { onConflict: 'taskid' })
      .select();

    if (blobError) {
      const isFKError = blobError.message.includes("violates foreign key constraint");
      if (isFKError) {
        console.error("Foreign key constraint violation:", blobError.message);
        return {
          success: false,
          error: "Invalid taskid – does not exist in checklist table.",
        };
      }

      console.error("Error during blob URL upsert:", blobError.message);
      return {
        success: false,
        error: blobError.message,
      };
    }

    const { data: updateData, error: updateError } = await supabase
      .from("checklist")
      .update({ has_attachment: true })
      .eq("taskid", taskid);

    if (updateError) {
      console.error("Error updating checklist record:", updateError.message);
      return {
        success: false,
        error: updateError.message,
        blobData, // partial success info
      };
    }

    // 3. Success!
    return {
      success: true,
      blobData,
      checklistUpdate: updateData,
    };

  } catch (err) {
    console.error("Unexpected exception in updateBlobUrl:", err.message);
    return {
      success: false,
      error: "Unexpected error occurred. Please try again.",
    };
  }
}


async function uploadBlobAzure(req, res) {
  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Form parse error:", err);
      return res.status(400).json({ error: "Invalid form data" });
    }


    try {
      const file = Array.isArray(files.image) ? files.image[0] : files.image;

      if (!file || !file.filepath) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const containerName = process.env.AZURE_CHECKLIST_ATTACHMENT_CONTAINER;
      const blobName = `${Date.now()}-${file.originalFilename}`;
      const blobUrl = await uploadFile(containerName, file, blobName);
      const rawTaskId = fields.taskid;
      const taskid = Array.isArray(rawTaskId) ? parseInt(rawTaskId[0]) : parseInt(rawTaskId);
      await updateBlobUrl(taskid, blobName);
      res.status(200).json({ blobUrl });
    } catch (uploadError) {
      console.error("Upload error:", uploadError.message);
      res.status(500).json({ error: "Upload failed" });
    }
  });
}

module.exports = { getStage, closeProject, categorizeScope, getProjectDetails, transformProjectData, submitFeedback, stakeholderComments, equipment, getProjects, getStakeholders, newProject, changeProjectStage, saveProject, processRequest, getScope, generateChecklist, insertChecklistEntries, updateChecklistCompletion, getProjectChecklist, getTaskComments, addTaskComments, updateTaskComments, deleteTaskComments, getBlobUrl, updateBlobUrl, uploadBlobAzure };