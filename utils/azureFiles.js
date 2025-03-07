require("dotenv").config();
const fs = require('fs'); 
const { BlobServiceClient, StorageSharedKeyCredential } = require("@azure/storage-blob");

const AZURE_STORAGE_ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT;
const AZURE_ACCOUNT_KEY = process.env.AZURE_ACCOUNT_KEY;

const sharedKeyCredential = new StorageSharedKeyCredential(AZURE_STORAGE_ACCOUNT, AZURE_ACCOUNT_KEY);
const blobServiceClient = new BlobServiceClient(
    `https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`,
    sharedKeyCredential
);

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
            filename : blobName
        };
    } catch (error) {
        throw new Error("Failed to download file");
    }
}

module.exports = { uploadFile, downloadFile };
