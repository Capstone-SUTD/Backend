require("dotenv").config();
const fs = require('fs');
const { BlobServiceClient, StorageSharedKeyCredential } = require("@azure/storage-blob");
const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");

const AZURE_STORAGE_ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT;
const AZURE_ACCOUNT_KEY = process.env.AZURE_ACCOUNT_KEY;

const sharedKeyCredential = new StorageSharedKeyCredential(AZURE_STORAGE_ACCOUNT, AZURE_ACCOUNT_KEY);
const blobServiceClient = new BlobServiceClient(
    `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`,
    sharedKeyCredential
);
const tableName = process.env.AZURE_CHECKLIST_ACCOUNT_TABLE_NAME;
const credential = new AzureNamedKeyCredential(AZURE_STORAGE_ACCOUNT, AZURE_ACCOUNT_KEY);
const tableClient = new TableClient(`https://${AZURE_STORAGE_ACCOUNT}.table.core.windows.net`, tableName, credential);

async function insertChecklist() {
    const checklistEntity = {
        partitionKey: "dynamic_checklist",
        rowKey: "checklist_1",
        ChecklistName: "Safety Checklist (Fixed)",
        Tasks: JSON.stringify({
            "OffSiteFixed": {
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
                "Safety precautions": {
                    "Equipment": [
                        "Are all workers equipped with required PPE, and has it been inspected for damage before use?",
                        "Are all equipment functionally checked?",
                        "Are all spare contingency equipment / materials available?",
                        "Is all equipment checked for functionality, with spare materials and fully charged backup batteries available?",
                        "Are all workers aware of the SOPs for each equipment type?"
                    ],
                    "Route survey": [
                        "Is the transportation path clear of obstacles, with pedestrian walkways separate from transport routes?",
                        "Is the traffic control engaged to guide the traffic at the lifting zone?",
                        "Ensure proper warning signs and barricades are placed along high-risk routes."
                    ]
                }
            },
            "OnSiteFixed": {
                "Ground conditions": [
                    "Are ground conditions assessed, including terrain stability, potholes, and required load-bearing measures?",
                    "Are the steel plates below the outrigger?"
                ],
                "Working at Height": [
                    "Are workers informed to not stand on the top 3 rungs of the ladder?",
                    "Are workers wearing body harnesses when working at height >3m?",
                    "Are workers wearing body harnesses, anchored securely when working at height (>3m), and is a fall rescue plan in place?",
                    "Is fall protection equipment inspected and certified within validity?",
                    "Have workers undergone Work-at-Height training (as required by Singapore law)?",
                    "Is there a certified WAH Supervisor on site?"
                ],
                "Weather conditions": {
                    "CAT 1": [
                        "Has everyone immediately stopped work, heading to nearest building shelter or CCA point?",
                        "Is the mobile crane grounded?"
                    ],
                    "Gusty wind": [
                        "Are the mobile cranes fitted with wind speed vanes?",
                        "Is there a system for supervisors to monitor and update real-time weather conditions?",
                        "If the operator reports wind speed exceeding 9m/s, is the load lowered and lifting stopped?"
                    ],
                    "PSI range": {
                        "120 - 200": [
                            "Outdoor activities minimized, reduce long exposure for outdoor staff",
                            "Outdoor staff must wear N95 mask"
                        ],
                        ">201": [
                            "Suitable respirators and PPE should be worn for outdoor staff",
                            "Wear hand gloves, safety helmet/boots/clear glass lens spectacles, reflective vest/long sleeves & ear plugs"
                        ]
                    }
                }
            },
            "Lifting": {
                "Setting up of lifting zone": [
                    "Are the loose materials/debris cleared from the lifting zone?",
                    "Are the barricade and signage put up?",
                    "Is there a 5m exclusion zone around the lifting operation?",
                    "Are crane operators licensed and competent?",
                    "Are communication systems (e.g., radios, signalmen) in place to coordinate lifting operations?"
                ],
                "Lifting operation": [
                    "Has the traffic control been engaged to guide the traffic at the lifting zone?",
                    "Is the lifting plan done?",
                    "Is the permit for working at height filled in and approved?",
                    "Is Lifting Gear and Lifting accessories tested within valid test dates before usage?",
                    "Are the Safe Working loads of the ropes and chains sufficient?",
                    "Are there sufficient taglines to control the load?",
                    "Does the crane operator and lifting team know the load weight?",
                    "Does each sling and shackle have a safe working load limit greater than or equal to that of the load?",
                    "Is lifting gear correctly rigged to the load and crane hook?",
                    "Are the hoisting ropes vertical?",
                    "Is the lifted load clear with no one near the load?",
                    "Is the crane load chart complied to?",
                    "Are the bypass switches set to the off position?",
                    "For cranes with non-key operated bypass switches or keys that cannot be removed from the switches, are the switches enclosed within a secure housing that can be locked?"
                ]
            },
            "Forklift": {
                "Mobilization": [
                    "Is the daily checklist done?",
                    "Are all forklift safety systems (brakes, steering, horn, alarms, lights, seat belts) in functional condition before operation?",
                    "Are the tires in good condition (no punctures or excessive wear)?",
                    "Is the battery charge/fuel levels sufficient for operation?",
                    "Are there leaks or malfunctions in the hydraulic systems?",
                    "Are the operators licensed and trained for forklift use?",
                    "Are pedestrian walkways and crossing points marked?"
                ],
                "Loading/unloading": [
                    "Is weight on both forks distributed equally by setting forks evenly?",
                    "Is the load secured?",
                    "Is the operator aware of road gradients, blind spots, etc?",
                    "Is the forklift boom attached, and pipe secured on both ends?",
                    "Is the load secured with a sling or shrink wrap?",
                    "Are the pallets checked and in good condition before use?",
                    "Are speed limits enforced within the worksite?",
                    "Are operators required to always wear seatbelts?"
                ],
                "Fueling": [
                    "Is the forklift engine turned off before starting the fueling operation?",
                    "Is the parking brake engaged?"
                ]
            },
            "Transportation": {
                "Driving on public roads": [
                    "Is the seat belt on?",
                    "Is the driver well-rested?",
                    "Is there any recent alcohol intake?",
                    "Has the driver taken any medicine which causes drowsiness?",
                    "Are drivers aware of vehicle blind spots?",
                    "Is the driver abiding to the speed limits and Singapore’s Road Traffic Act?",
                    "Have drivers reviewed the maintenance records before operation?",
                    "Are drivers trained on what to do in case of an accident or vehicle breakdown?",
                    "Are emergency contact numbers available in the vehicle?",
                    "Are drivers trained to adjust driving behavior in heavy rain, strong winds, or low visibility conditions?",
                    "Is the vehicle equipped with anti-skid systems for wet conditions?"
                ],
                "Unloading of cargo": [
                    "Before unleashing straps/stanchions, are the loads stable on the trailer?",
                    "Are unauthorized personnel kept at a safe distance from the unloading area?",
                    "Is a clear unloading zone marked and barricaded?",
                    "Are taglines or guiding ropes used to prevent swinging loads?",
                    "Is the ground condition checked before unloading to prevent instability?"
                ]
            }
        })
    };

    await tableClient.createEntity(checklistEntity);
    console.log("Checklist stored successfully!");
}



async function getFullChecklist() {
    try {
        const entity = await tableClient.getEntity("dynamic_checklist", "checklist_1");

        // Parse the JSON string stored in the Tasks field
        const checklist = JSON.parse(entity.Tasks);

        return checklist;
    } catch (error) {
        console.error("Error retrieving checklist:", error);
    }
}


async function uploadFile(containerName, file, blobName) {
    try {
        const fileBuffer = fs.readFileSync(file.filepath);

        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        await blockBlobClient.uploadData(fileBuffer);
        return blockBlobClient.url;

    } catch (error) {
        throw new Error("Failed to upload file");
    }
}

async function downloadFile(blobUrl) {
    try {
        const parsedUrl = new URL(blobUrl);
        const pathParts = parsedUrl.pathname.split("/").filter(Boolean);

        if (pathParts.length < 2) {
            throw new Error("Invalid Blob URL");
        }

        const containerName = pathParts[0];
        const blobName = pathParts.slice(1).join("/");

        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blobClient = containerClient.getBlobClient(blobName);

        const blobExists = await blobClient.exists();
        if (!blobExists) {
            throw new Error("Blob does not exist");
        }

        const downloadResponse = await blobClient.download();

        return {
            stream: downloadResponse.readableStreamBody,
            contentType: downloadResponse.contentType || "application/octet-stream",
            filename: blobName
        };
    } catch (error) {
        throw new Error("Failed to download file");
    }
}

module.exports = { uploadFile, downloadFile, getFullChecklist };
