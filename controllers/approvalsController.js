const supabase = require("../config/db");
const formidable = require('formidable');
const { uploadFile, downloadFile } = require("../utils/azureFiles");

async function approveFile(req, res) {
    const { projectid } = req.body;
    const userid = req.user.id;

    if (!projectid ) {
        return res.status(400).json({ error: "All fields are required" });
    }

    const { data : userData, error : error2 } = await supabase
    .from("stakeholders")
    .select("role")
    .eq("userid", userid)
    .eq("projectid", projectid); 
    if (error2) return res.status(500).json({ error: error.message });
    const userRole = userData.length > 0 ? userData[0].role : null;

    const { data, error : userError } = await supabase
    .from("approvals")
    .select("*")
    .eq("projectid", projectid)
    .eq("status", "Approved");
    if (userError) return res.status(500).json({ error: error.message });

    const approvedCount = data.length;
    
    if (approvedCount === 0 && userRole !== "HSEOfficer") {
        return res.status(403).json({ error: "Only HSEOfficer can proceed" });
    }
    if (approvedCount === 1 && userRole !== "ProjectManager") {
        return res.status(403).json({ error: "Only Project Manager can proceed" });
    }
    if (approvedCount === 2 && userRole !== "Head") {
        return res.status(403).json({ error: "Only Head of GPIS can proceed" });
    }
    
    const { data: _ , error } = await supabase
        .from("approvals")
        .insert([{ projectid, userid, status : "Approved" }])
        .select();

    if (error) return res.status(500).json({ error: error.message });

    res.status(200).json({ message: "Approved Successfully" });
}

async function rejectFile(req, res) {
    const { projectid, comments } = req.body;
    const userid = req.user.id;

    if (!projectid ) {
        return res.status(400).json({ error: "All fields are required" });
    }

    const { data : userData, error : error2 } = await supabase
    .from("stakeholders")
    .select("role")
    .eq("userid", userid)
    .eq("projectid", projectid); 
    if (error2) return res.status(500).json({ error: error.message });
    const userRole = userData.length > 0 ? userData[0].role : null;

    const { data, error : userError } = await supabase
    .from("approvals")
    .select("*")
    .eq("projectid", projectid)
    .eq("status", "Approved");
    if (userError) return res.status(500).json({ error: error.message });

    const approvedCount = data.length;
    
    if (approvedCount === 0 && userRole !== "HSEOfficer") {
        return res.status(403).json({ error: "Only HSEOfficer can proceed" });
    }
    if (approvedCount === 1 && userRole !== "ProjectManager") {
        return res.status(403).json({ error: "Only Project Manager can proceed" });
    }
    if (approvedCount === 2 && userRole !== "Head") {
        return res.status(403).json({ error: "Only Head of GPIS can proceed" });
    }

    const { data : _ , error } = await supabase
        .from("approvals")
        .insert([{ projectid, userid, status : "Rejected", comments }])
        .select();

    if (error) return res.status(500).json({ error: error.message });

    res.status(200).json({ message: "Rejected Successfully" });
}

function getFileExtension(fileName) {
    const ext = fileName.split('.').pop().toLowerCase(); // Get the extension from the filename
    return ext;
}

async function uploadNew (req, res) {
    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields, files) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const { projectid, filetype } = fields;
        const file = files.file[0];

        const userid = req.user.id;
        if (!projectid || !file || !filetype ) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const fileTypeString = Array.isArray(filetype) ? filetype[0] : filetype;
        const projectIdInt = parseInt(projectid[0], 10); 

        var container = ""
        var filename = ""
        const randomNum = Math.floor(Math.random() * 1000000); 
        const extension = getFileExtension(file.originalFilename);

        if (fileTypeString === "MS") {
            container = "generated-ms";
            filename = `MS_${randomNum}`;
        } 

        if (fileTypeString === "RA") {
            container = "generated-ra";
            filename = `RA_${randomNum}`;
        } 

        // Add extension to the filename
        const filenameWithExtension = `${filename}.${extension}`;
        const bloburl = await uploadFile(container, file, filenameWithExtension);

        const { data : fileInfo, error : fileError } = await supabase
        .from("files")
        .select("*")
        .eq("projectid", projectIdInt)
        .eq("filetype", fileTypeString);
        if (fileError) return res.status(500).json({ error: error.message });
        const version = fileInfo.length + 1;

        const { data : _ , error } = await supabase
        .from("files")
        .insert([{ projectid : projectIdInt, filetype : fileTypeString, bloburl, version, uploadedby : userid }])
        .select();
        if (error) return res.status(500).json({ error: error.message });

        res.status(200).json({"message":"Upload successful", "blobUrl" : bloburl});
    })
}

async function download (req, res) {
    const { projectid, filetype, version } = req.body;

    if (!projectid || !filetype || !version) {
        return res.status(400).json({ error: "All fields are required" });
    }

    const { data : files, error : fileError } = await supabase
    .from("files")
    .select("bloburl")
    .eq("projectid", projectid)
    .eq("filetype", filetype)
    .eq("version", version);

    if (fileError) return res.status(500).json({ error: error.message });
    
    const fileUrl = files.length > 0 ? files[0].bloburl : null;
    if (!fileUrl) return res.status(500).json({ error: "No such file found" });

    const { stream, contentType, filename } = await downloadFile(fileUrl);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);  

    return stream.pipe(res);
}

async function getRejectionDetails(projectid, rejectedData) {
    const filteredRejections = rejectedData;
    const userIds = filteredRejections.map(record => record.userid);
    let rejectionDetails = [];

    if (userIds.length !== 0) {
        const { data: stakeholderData, error: stakeholderError } = await supabase
        .from("stakeholders")
        .select("userid, role")
        .eq("projectid", projectid)
        .in("userid", userIds);

        if (stakeholderError) return { error: stakeholderError.message };

        rejectionDetails = filteredRejections.map(record => {
            const role = stakeholderData?.find(s => s.userid === record.userid)?.role || "Unknown";
            return { role, comments: record.comments };
        });
    }

    const { data: msFiles, error: msError } = await supabase
    .from("files")
    .select("*")
    .eq("projectid", projectid)
    .eq("filetype", "MS");

    const { data: raFiles, error: raError } = await supabase
    .from("files")
    .select("*")
    .eq("projectid", projectid)
    .eq("filetype", "RA");

    if (msError) return { error: msError.message };
    if (raError) return { error: raError.message };

    return { 
    count: filteredRejections.length, 
    rejectionDetails, 
    MSVersions: msFiles?.length || 0, 
    RAVersions: raFiles?.length || 0 
    };
}

async function showApprovalandRejections(req, res) {
    const { projectid } = req.body;

    if (!projectid) {
        return res.status(400).json({ error: "All fields are required" });
    }

    const { data: approvedData, error: approvalError } = await supabase
        .from("approvals")
        .select("*")
        .eq("projectid", projectid)
        .eq("status", "Approved");

    if (approvalError) return res.status(500).json({ error: approvalError.message });

    const ApprovedCount = approvedData.length;

    const { data: rejectedData, error: rejectionError } = await supabase
        .from("approvals")
        .select("userid, comments")
        .eq("projectid", projectid)
        .eq("status", "Rejected");

    if (rejectionError) return res.status(500).json({ error: rejectionError.message });

    const Details = await getRejectionDetails(projectid, rejectedData);


    res.status(200).json({
        Approvals: ApprovedCount,
        Rejections: Details.count,
        RejectionDetails: Details.rejectionDetails,
        MSVersions: Details.MSVersions,
        RAVersions: Details.RAVersions
    });
}

module.exports = {approveFile, rejectFile, showApprovalandRejections, uploadNew, download}
