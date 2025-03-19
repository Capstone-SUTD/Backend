const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");

// Azure Storage account details
const accountName = "checklistaccount";
const accountKey = "y9i42WJgl9unlfDTWUac79gqlL1yV5duyP9TYeGb9zp1uGseywP5SzL+Iy+tf55Wb851rbsYzRRh+AStDooFuQ==";
const tableName = "ChecklistsTable";

// Create Table Client
const credential = new AzureNamedKeyCredential(accountName, accountKey);
const tableClient = new TableClient(`https://${accountName}.table.core.windows.net`, tableName, credential);

async function insertChecklist() {
    const checklistEntity = {
        partitionKey: "offsite_checklist_fixed",
        rowKey: "fixed_1",
        ChecklistName: "Offsite Safety Checklist (Fixed)",
        Tasks: JSON.stringify({
            "Administrative": [
                "Is the permit to work approved?",
                "Is the toolbox meeting conducted and signed?",
                "Have the operatives been informed about the type of cargo and rigging requirements?",
                "Have all parties concerned been notified regarding the coordination information?",
                "Are all required personnel available for the operations?",
                "Ensure that a site-specific risk assessment is completed and communicated before work starts.",
                "Is an emergency response plan in place, and has the team been briefed?",
                "Is a first aid kit readily available, and are first aiders identified?",
                "Have all workers undergone the necessary competency checks (e.g., lifting supervisor, signalman, rigger)?",
                "Ensure fire extinguishers are accessible, especially near high-risk operations."
            ],
            "Safety Precautions": {
                "Equipment": [
                    "Are all workers equipped with required PPE, and has it been inspected for damage before use?",
                    "Are all equipment functionally checked?",
                    "Are all spare contingency equipment / materials available?",
                    "Is all equipment checked for functionality, with spare materials and fully charged backup batteries available?",
                    "Are all workers aware of the SOPs for each equipment type?"
                ],
                "Route Survey": [
                    "Is the transportation path clear of obstacles, with pedestrian walkways separate from transport routes?",
                    "Is the traffic control engaged to guide the traffic at the lifting zone?",
                    "Ensure proper warning signs and barricades are placed along high-risk routes."
                ]
            }
        })
    };

    await tableClient.createEntity(checklistEntity);
    console.log("Checklist stored successfully!");
}


async function getChecklist() {
    try {
        const checklist = await tableClient.getEntity("offsite_checklist_fixed", "fixed_1");

        console.log(`Checklist Name: ${checklist.ChecklistName}`);

        // Parse JSON from the Tasks field
        const tasksData = JSON.parse(checklist.Tasks);

        // Iterate over main sections
        for (const section in tasksData) {
            console.log(`\n🔹 ${section}`); // Main Header (e.g., Administrative, Safety Precautions)

            if (Array.isArray(tasksData[section])) {
                // Direct list of tasks under main section
                tasksData[section].forEach(task => console.log(`- ${task}`));
            } else {
                // Subsections (e.g., Equipment, Route Survey)
                for (const subsection in tasksData[section]) {
                    console.log(`  ➤ ${subsection}`); // Subsection Header (e.g., Equipment)

                    tasksData[section][subsection].forEach(task => console.log(`    - ${task}`));
                }
            }
        }
    } catch (error) {
        console.error("Error retrieving checklist:", error);
    }
}

getChecklist();


// insertChecklist();
getChecklist();
