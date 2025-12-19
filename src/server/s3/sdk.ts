import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  S3ClientConfig,
  ListObjectsV2CommandOutput,
  GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { appConfig } from '../../app.config';

const AWS_BUCKET_NAME = "app-template-1252343"
// Constants
const APP_FOLDER_PREFIX = appConfig.appName.replace(/\s/g, '_') + '/'

// S3 Configuration
export interface S3Config {
  region: string;
  bucketName: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

// Default configuration - uses environment variables
const defaultConfig: S3Config = {
  region: process.env.AWS_REGION || 'us-east-1',
  bucketName: AWS_BUCKET_NAME,
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
    : undefined,
};

// Types
export interface S3File {
  key: string;
  size: number;
  lastModified: Date;
  url?: string;
  isFolder?: boolean;
  fileCount?: number;
}

export interface S3UploadParams {
  content: string | Buffer;
  fileName: string;
  contentType?: string;
}

// Create S3 client with configuration
export const createS3Client = (config: S3Config = defaultConfig): S3Client => {
  const clientConfig: S3ClientConfig = {
    region: config.region,
  };

  if (config.credentials) {
    clientConfig.credentials = {
      accessKeyId: config.credentials.accessKeyId,
      secretAccessKey: config.credentials.secretAccessKey,
    };
  }

  return new S3Client(clientConfig);
};

// Get the default S3 client
export const getS3Client = (): S3Client => {
  return createS3Client();
};

// Get the default bucket name
export const getDefaultBucketName = (): string => {
  return defaultConfig.bucketName;
};

// Upload a file to S3
export const uploadFile = async (
  params: S3UploadParams,
  client: S3Client = getS3Client(),
  bucketName: string = getDefaultBucketName()
): Promise<string> => {
  // Ensure the fileName doesn't already have the APP_FOLDER_PREFIX
  const fileName = params.fileName.startsWith(APP_FOLDER_PREFIX)
    ? params.fileName
    : `${APP_FOLDER_PREFIX}${params.fileName}`;

  // console.log('Uploading file with key:', fileName);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: params.content,
    ContentType: params.contentType || 'application/octet-stream',
  });

  await client.send(command);
  // Return the key without the APP_FOLDER_PREFIX for consistency
  return fileName.replace(APP_FOLDER_PREFIX, '');
};

// Get a file from S3
export const getFile = async (
  fileName: string,
  client: S3Client = getS3Client(),
  bucketName: string = getDefaultBucketName()
): Promise<GetObjectCommandOutput> => {
  // Ensure the fileName has the APP_FOLDER_PREFIX
  const key = fileName.startsWith(APP_FOLDER_PREFIX)
    ? fileName
    : `${APP_FOLDER_PREFIX}${fileName}`;

  // console.log('Getting file with key:', key);

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return client.send(command);
};

// Get a file as a string
export const getFileAsString = async (
  fileName: string,
  client: S3Client = getS3Client(),
  bucketName: string = getDefaultBucketName()
): Promise<string> => {
  const response = await getFile(fileName, client, bucketName);

  if (!response.Body) {
    throw new Error('File body is empty');
  }

  const streamReader = response.Body.transformToString();
  return streamReader;
};

// List files in the app folder
export const listFiles = async (
  prefix?: string,
  client: S3Client = getS3Client(),
  bucketName: string = getDefaultBucketName()
): Promise<S3File[]> => {
  const fullPrefix = prefix
    ? `${APP_FOLDER_PREFIX}${prefix}`
    : APP_FOLDER_PREFIX;

  // First, get all objects to count files in folders and calculate total sizes
  const allObjectsCommand = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: fullPrefix,
  });

  const allObjectsResponse = await client.send(allObjectsCommand);

  // Create maps to track folder stats
  const folderCounts: Record<string, number> = {};
  const folderSizes: Record<string, number> = {};

  if (allObjectsResponse.Contents) {
    for (const item of allObjectsResponse.Contents) {
      if (!item.Key) continue;

      // Skip the current directory marker
      if (item.Key === fullPrefix) continue;

      // Get the relative path from the current prefix
      const relativePath = item.Key.replace(fullPrefix, '');

      // Skip empty paths
      if (!relativePath) continue;

      // Count files in folders and sum up sizes
      const parts = relativePath.split('/');

      // If we're at the root and this is a file (no trailing slash)
      if (parts.length === 1 && !item.Key.endsWith('/')) {
        // This is a file at the current level, not in a subfolder
        continue;
      }

      // If this is a folder at the current level
      if (parts.length === 1 && item.Key.endsWith('/')) {
        // This is a folder at the current level
        const folderName = parts[0];
        // Initialize counts if needed, but don't increment
        if (!folderCounts[folderName]) {
          folderCounts[folderName] = 0;
          folderSizes[folderName] = 0;
        }
        continue;
      }

      // This is a file in a subfolder
      if (parts.length > 1 && parts[0]) {
        const folderName = parts[0];

        // Only count actual files, not subfolder markers
        if (!relativePath.endsWith('/')) {
          folderCounts[folderName] = (folderCounts[folderName] || 0) + 1;
          folderSizes[folderName] = (folderSizes[folderName] || 0) + (item.Size || 0);
        }
      }
    }
  }

  // Now get the actual listing with delimiter for proper folder structure
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: fullPrefix,
    Delimiter: '/' // This helps identify folders properly
  });

  const response: ListObjectsV2CommandOutput = await client.send(command);

  const result: S3File[] = [];

  // Process common prefixes (folders)
  if (response.CommonPrefixes) {
    for (const prefix of response.CommonPrefixes) {
      if (prefix.Prefix) {
        const folderKey = prefix.Prefix.replace(APP_FOLDER_PREFIX, '');
        // Extract folder name from the path
        const folderName = folderKey.split('/').filter(p => p).pop() || folderKey;

        // Get the simple folder name (without path)
        const simpleFolderName = folderName.endsWith('/')
          ? folderName.slice(0, -1)
          : folderName;

        result.push({
          key: folderKey,
          size: folderSizes[simpleFolderName] || 0,
          lastModified: new Date(),
          isFolder: true,
          fileCount: folderCounts[simpleFolderName] || 0
        });
      }
    }
  }

  // Process contents (files)
  if (response.Contents) {
    for (const item of response.Contents) {
      // Skip the directory marker itself
      if (item.Key === fullPrefix) continue;

      // Check if this is a folder marker (ends with /)
      const isFolder = item.Key?.endsWith('/') || false;

      // If it's a folder marker and we already added it via CommonPrefixes, skip it
      if (isFolder && result.some(f => f.isFolder && f.key === item.Key?.replace(APP_FOLDER_PREFIX, ''))) {
        continue;
      }

      if (item.Key) {
        const key = item.Key.replace(APP_FOLDER_PREFIX, '');

        // For folder markers that weren't in CommonPrefixes
        if (isFolder) {
          const folderName = key.split('/').filter(p => p).pop() || key;
          // Remove trailing slash for lookup
          const simpleFolderName = folderName.endsWith('/')
            ? folderName.slice(0, -1)
            : folderName;

          result.push({
            key,
            size: folderSizes[simpleFolderName] || 0,
            lastModified: item.LastModified || new Date(),
            isFolder: true,
            fileCount: folderCounts[simpleFolderName] || 0
          });
        } else {
          // Regular files
          result.push({
            key,
            size: item.Size || 0,
            lastModified: item.LastModified || new Date(),
            isFolder: false
          });
        }
      }
    }
  }

  return result;
};

// Generate a pre-signed URL for temporary access
export const getSignedFileUrl = async (
  fileName: string,
  expiresIn = 3600, // Default 1 hour
  client: S3Client = getS3Client(),
  bucketName: string = getDefaultBucketName()
): Promise<string> => {
  const key = `${APP_FOLDER_PREFIX}${fileName}`;

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
};

// Delete a file from S3
export const deleteFile = async (
  fileName: string,
  client: S3Client = getS3Client(),
  bucketName: string = getDefaultBucketName()
): Promise<void> => {
  // Ensure the fileName has the APP_FOLDER_PREFIX
  const key = fileName.startsWith(APP_FOLDER_PREFIX)
    ? fileName
    : `${APP_FOLDER_PREFIX}${fileName}`;

  //   console.log('Deleting file with key:', key);

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await client.send(command);
};

// List files with signed URLs
export const listFilesWithUrls = async (
  prefix?: string,
  expiresIn = 3600,
  client: S3Client = getS3Client(),
  bucketName: string = getDefaultBucketName()
): Promise<S3File[]> => {
  const files = await listFiles(prefix, client, bucketName);

  // Generate signed URLs for each file
  const filesWithUrls = await Promise.all(
    files.map(async (file) => {
      const url = await getSignedFileUrl(
        file.key,
        expiresIn,
        client,
        bucketName
      );
      return { ...file, url };
    })
  );

  return filesWithUrls;
};