import fs from 'fs';
import path from 'path';
import os from 'os';
import mammoth from 'mammoth';
import sizeOf from 'image-size';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import dotenv from 'dotenv';
import pkg from 'officeparser';
const { pptxToText } = pkg;
import ffprobe from 'ffprobe';
import ffprobeStatic from 'ffprobe-static';
import fetch from 'node-fetch';

dotenv.config();
const apiKey = "AIzaSyCVaAh036ZZjQT6FvpaSxfP2mmk63t0zEU";
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

const allowedExtensions = ['.txt', '.pdf', '.docx', '.ppt', '.mp3', '.wav', '.mp4', '.mkv', '.avi', '.jpg', '.jpeg', '.png', '.gif'];

const mimeTypes = {
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".docx": "text/plain",
    ".ppt": "text/plain",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".bmp": "image/bmp",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg"
};

function getMimeType(path) {
    const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
    return mimeTypes[ext] || "application/octet-stream";
}


async function docxToText(path) {
    try {
        const buffer = await fs.promises.readFile(path);
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    } catch (error) {
        console.error(`Error converting docx to text: ${path}, error: ${error}`);
        return null;
    }
}

async function pptxToTextAsync(path) {
    try {
        const result = await pptxToText(path);
        return result;
    } catch (error) {
        console.error(`Error converting pptx to text: ${path}, error: ${error}`);
        return null;
    }
}

async function extractVideoMetadata(path) {
    try {
        const probeResult = await ffprobe(path, { path: ffprobeStatic.path });
        const format = probeResult.format;
        if (format) {
            return path; // Return path if metadata was extracted.
        } else {
            return null;
        }
    } catch (error) {
        console.error(`Failed to extract metadata from video file: ${path}, error: ${error}`);
        return null;
    }
}

async function extractAudioMetadata(path) {
    try {
        const probeResult = await ffprobe(path, { path: ffprobeStatic.path });
        const format = probeResult.format;
        if (format) {
            return `Audio Metadata:
             - Filename: ${format.filename}
            - Format: ${format.format_long_name}
            - Duration: ${format.duration} seconds
          `;
        } else {
            return null;
        }
    } catch (error) {
        console.error(`Failed to extract metadata from audio file: ${path}, error: ${error}`);
        return null;
    }
}

async function uploadToGemini(path) {
    let fileContent = null;
    const mimeType = getMimeType(path);
    try {
        if (path.endsWith('.docx')) {
            fileContent = await docxToText(path);
        } else if (path.endsWith('.ppt')) {
            fileContent = await pptxToTextAsync(path);
        }
         else if (path.endsWith(".mp4") || path.endsWith(".mov") || path.endsWith(".avi") || path.endsWith(".mkv")) {
            fileContent = await extractVideoMetadata(path);
        }
         else if (path.endsWith(".mp3") || path.endsWith(".wav") || path.endsWith(".aac") || path.endsWith(".ogg")) {
            fileContent = await extractAudioMetadata(path);
        }
          else if (path.endsWith(".gif")){
            fileContent = null;
         }
        if (fileContent) {
           if (fileContent.match(/^[A-Za-z]:\\/)) {
                const uploadResult = await fileManager.uploadFile(fileContent, {
                    mimeType,
                    displayName: path,
                });
                const file = uploadResult.file;
                console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
                return file;
            } else {
                const buffer = Buffer.from(fileContent, 'utf-8');
                const uploadResult = await fileManager.uploadFile(buffer, {
                    mimeType,
                    displayName: path,
                });
                const file = uploadResult.file;
                console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
                return file;
            }
        } else {
              if(!path.endsWith(".gif"))
            {
                const uploadResult = await fileManager.uploadFile(path, {
                    mimeType,
                    displayName: path,
                 });
               const file = uploadResult.file;
                console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
                return file;
            }
             else {
              console.log(`Skipping upload to Gemini for gif file: ${path}`);
             return null;
           }
        }
    }
    catch (error) {
        console.error(`Failed to upload ${path}. Error: ${error}`);
        return null;
    }
}

async function waitForFilesActive(files) {
    if (!files || files.length === 0) return;

    console.log("Waiting for file processing...");
    for (const file of files) {
        if (!file) continue;
        let currentFile = await fileManager.getFile(file.name);
        while (currentFile.state === "PROCESSING") {
            process.stdout.write(".");
            await new Promise((resolve) => setTimeout(resolve, 10_000));
            currentFile = await fileManager.getFile(file.name);
        }
        if (currentFile.state !== "ACTIVE") {
            throw Error(`File ${currentFile.name} failed to process`);
        }
    }
    console.log("...all files ready\n");
}

const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
});

const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
};

async function summarizeFile(file) {
    if (!file) return "Error Uploading File";
    const chatSession = model.startChat({
        generationConfig,
        history: [
            {
                role: "user",
                parts: [
                    {
                        fileData: {
                            mimeType: file.mimeType,
                            fileUri: file.uri,
                        },
                    },
                     {
                         text: (file.mimeType.startsWith('audio') || file.mimeType.startsWith('video')) ? `The following is metadata for this ${file.mimeType.split('/')[0]}: ` : "summarize this document ",
                    }
                ],
            },
        ],
    });

    try {
         const result = await chatSession.sendMessage((file.mimeType.startsWith('audio') || file.mimeType.startsWith('video')) ? "Describe the above metadata in five lines" : "summarize this document ");
        return result.response.text();
    } catch (error) {
        console.error(`Failed to summarize ${file.displayName}: ${error}`);
        return `Error Summarizing ${file.displayName}`;
    }
}

function isAllowedFileType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    return allowedExtensions.includes(ext);
}

async function getTextContent(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return fileContent;
  } catch (error) {
    console.error(`Error reading file content: ${filePath}`, error);
      return null;
  }
}

async function getSpacyKeywords(text) {
    try {
        const response = await fetch('http://localhost:5000/extract_keywords', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
        if (!response.ok) {
            throw new Error(`spaCy API error: ${response.statusText}`);
        }
        const data = await response.json();
         return data.keywords || [];
    } catch (error) {
         console.error(`Error fetching spaCy keywords: ${error}`);
          return `Error processing with spaCy: ${error.message}`;
    }
}


async function scanDirectory(dirPath, fileStream, existingMetadata = []) {
    const excludedDirs = ['AppData', 'node_modules', '.cache', '.vscode', '.docker'];
    
    // Ignore excluded directories
    if (excludedDirs.some(excluded => dirPath.includes(excluded))) {
        console.log(`Skipping excluded directory: ${dirPath}`);
        return;
    }

    let files;
    try {
        files = fs.readdirSync(dirPath);
    } catch (err) {
        if (err.code === 'EPERM' || err.code === 'EACCES') {
            console.warn(`Skipping directory due to permission issues: ${dirPath}`);
            return;
        }
        throw err;
    }

    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        let stats;
        try {
            stats = fs.statSync(fullPath);
        } catch (err) {
            if (err.code === 'EPERM' || err.code === 'EACCES') {
                console.warn(`Skipping file due to permission issues: ${fullPath}`);
                continue;
            }
            throw err;
        }

        if (stats.isDirectory()) {
            await scanDirectory(fullPath, fileStream, existingMetadata);
        } else if (isAllowedFileType(file)) {
            const fileMetadata = {
                path: fullPath,
                name: file,
                type: path.extname(file),
                size: stats.size,
                dateCreated: stats.birthtime.toISOString(),
                dateModified: stats.mtime.toISOString(),
                summary: '',
                keywords: [],
                uploadedToGemini: false
            };

            const existingFileMetadata = existingMetadata.find(item => item.path === fullPath);
            let jsonString;
            if (existingFileMetadata && existingFileMetadata.summary !== "Error Uploading File" && !existingFileMetadata.summary?.startsWith("Error Summarizing")) {
                console.log(`Skipping previously processed file: ${fullPath}`);
                continue;
            }

            if (existingFileMetadata && (existingFileMetadata.summary === "Error Uploading File" || existingFileMetadata.summary?.startsWith("Error Summarizing"))) {
                Object.assign(fileMetadata, existingFileMetadata);
                console.log(`Re-processing file with previous errors: ${fullPath}`);
            } else {
                console.log(`Processing new file: ${fullPath}`);
            }

            let geminiSummary = null;
            try {
                const geminiFile = await uploadToGemini(fullPath);
                if (geminiFile) {
                    await waitForFilesActive([geminiFile]);
                    geminiSummary = await summarizeFile(geminiFile);
                    fileMetadata.uploadedToGemini = true;
                } else {
                    geminiSummary = 'Error Uploading File';
                }
            } catch (error) {
                console.error(`Error processing file ${fullPath}: ${error}`);
                geminiSummary = null;
            }
            fileMetadata.summary = geminiSummary;

            // Generate keywords using spaCy
            try {
                const textForKeywords = geminiSummary || (await getTextContent(fullPath));
                if (textForKeywords) {
                    const keywords = await getSpacyKeywords(textForKeywords);
                    fileMetadata.keywords = keywords;
                }
            } catch (error) {
                console.error(`Error generating keywords for ${fullPath}: ${error}`);
            }
            
            // Handle image files (.jpg, .jpeg, .png, .gif)
            if (['.jpg', '.jpeg', '.png', '.gif'].includes(path.extname(file).toLowerCase())) {
                try {
                    const dimensions = sizeOf(fullPath);
                    fileMetadata.dimensions = {
                        width: dimensions.width,
                        height: dimensions.height
                    };
                } catch (err) {
                    console.error(`Error reading image file: ${fullPath}`, err);
                    fileMetadata.dimensions = '[Image Parsing Failed]';
                }
            }
            jsonString = JSON.stringify(fileMetadata, null, 2) + ',\n';
            fileStream.write(jsonString);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}

async function saveMetadata() {
    const homeDir = os.homedir();
    const filePath = 'data.json';
    let existingMetadata = [];

    try {
       const fileContent = await fs.promises.readFile(filePath, 'utf-8');
        const sanitizedContent = fileContent.trim().replace(/,\s*\]$/, ']');
        if (sanitizedContent){
           try {
                 existingMetadata = JSON.parse(sanitizedContent);
                  console.log(`Loaded ${existingMetadata.length} entries from ${filePath}`);
           } catch(error){
               console.error(`Error parsing content of ${filePath}, starting with empty metadata`, error)
                existingMetadata = [];
             }
         } else {
          existingMetadata = [];
          console.log(`${filePath} is empty. Starting with empty metadata.`);
        }

    } catch (err) {
         console.log(`No existing ${filePath} found, starting with an empty metadata.`);
    }
    const fileStream = fs.createWriteStream(filePath, { flags: 'a' });
     fileStream.write(existingMetadata.length === 0 ? '[\n' : ',\n');
    try{
       await scanDirectory(homeDir, fileStream, existingMetadata);
        fileStream.write(']\n');
       await fileStream.close();
       console.log('Metadata saved to data.json');
   } catch(err){
       console.error(`Error processing files in ${homeDir}: `, err)
       fileStream.write(']\n');
      await fileStream.close();
   }
}


export { saveMetadata };