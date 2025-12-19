import {
  uploadFile,
  getFileAsString,
  listFiles,
  deleteFile,
  getS3Client,
  getDefaultBucketName,
} from './sdk';

/**
 * Example usage of the S3 module
 * This function demonstrates how to use the S3 module for common operations
 * Note: This is for demonstration purposes only and should be called from server-side code
 */
export const s3Examples = async () => {
  try {
    console.log('S3 client initialized');
    
    // Example 1: Upload a file
    const fileContent = 'This is a test file content';
    const fileName = `test-file-${Date.now()}.txt`;
    
    console.log(`Uploading file: ${fileName}`);
    const uploadedKey = await uploadFile({
      content: fileContent,
      fileName,
      contentType: 'text/plain',
    });
    console.log(`File uploaded successfully with key: ${uploadedKey}`);
    
    // Example 2: Get the file content
    console.log(`Retrieving file: ${fileName}`);
    const retrievedContent = await getFileAsString(fileName);
    console.log(`File content: ${retrievedContent}`);
    
    // Example 3: List files in the app folder
    console.log('Listing files:');
    const files = await listFiles();
    console.log('Files in the app folder:', files);
    
    // Example 4: Delete the file
    console.log(`Deleting file: ${fileName}`);
    await deleteFile(fileName);
    console.log('File deleted successfully');
    
    // Example 5: List files again to confirm deletion
    console.log('Listing files after deletion:');
    const filesAfterDeletion = await listFiles();
    console.log('Files in the app folder:', filesAfterDeletion);
    
    return {
      success: true,
      message: 'S3 operations completed successfully',
    };
  } catch (error) {
    console.error('Error in S3 examples:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Example of how to use the S3 module with custom client and bucket
 */
export const customClientExample = async () => {
  // You can still use custom client and bucket if needed
  const client = getS3Client();
  const bucketName = getDefaultBucketName();
  
  try {
    // Upload with custom client and bucket
    const fileContent = 'Custom client example';
    const fileName = `custom-client-example-${Date.now()}.txt`;
    
    const uploadedKey = await uploadFile(
      {
        content: fileContent,
        fileName,
        contentType: 'text/plain',
      },
      client,
      bucketName
    );
    
    console.log(`File uploaded with custom client: ${uploadedKey}`);
    
    // Clean up
    await deleteFile(fileName, client, bucketName);
    
    return { success: true };
  } catch (error) {
    console.error('Error in custom client example:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

/**
 * Example of how to use the S3 module in a Next.js server action or API route
 * 
 * @param content - The content to upload
 * @param fileName - The name of the file
 * @returns Object with success status and result
 */
export const uploadFileExample = async (
  content: string,
  fileName: string
): Promise<{ success: boolean; key?: string; error?: string }> => {
  try {
    const key = await uploadFile({
      content,
      fileName,
    });
    
    return { success: true, key };
  } catch (error) {
    console.error('Error uploading file:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};
