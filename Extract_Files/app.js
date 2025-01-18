import { saveMetadata } from './scanner.js';
 // Import the saveMetadata function from your scanner module

async function main() {
  try {
    console.log("Starting file scan...");
    await saveMetadata();  // This will scan the directory and save the metadata to data.json
    console.log("File scan completed and metadata saved to data.json.");
  } catch (err) {
    console.error("Error during file scan:", err);
  }
}

// Run the main function
main();
