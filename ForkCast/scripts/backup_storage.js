#!/usr/bin/env node
/**
 * Supabase Storage Backup to AWS S3
 *
 * This script backs up all files from Supabase Storage buckets to AWS S3
 * with smart incremental syncing to avoid unnecessary transfers.
 *
 * Required environment variables:
 *   - SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
 *   - AWS_ACCESS_KEY_ID: AWS IAM access key
 *   - AWS_SECRET_ACCESS_KEY: AWS IAM secret key
 *   - AWS_DEFAULT_REGION: AWS region (default: eu-central-1)
 *   - S3_BUCKET: S3 bucket name (default: plate-backups)
 */

const https = require("https");
const http = require("http");
const { URL } = require("url");
const {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
} = require("fs");
const { execSync } = require("child_process");
const { join } = require("path");

// Configuration
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const S3_BUCKET = process.env.S3_BUCKET || "plate-backups";
const AWS_REGION = process.env.AWS_DEFAULT_REGION || "eu-central-1";
const TEMP_DIR = "/tmp/supabase-storage-backup";

// Storage buckets to backup
const BUCKETS = [
  "avatars",
  "review-photos",
  "images",
  "special-offers",
  "main_images",
  "menu_images",
  "logo",
];

// Validation
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Error: Missing required environment variables");
  console.error("Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Statistics
const stats = {
  totalFiles: 0,
  uploadedFiles: 0,
  skippedFiles: 0,
  failedFiles: 0,
  totalSize: 0,
  uploadedSize: 0,
};

/**
 * Make HTTPS request
 */
function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === "https:" ? https : http;

    const req = protocol.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(
              res.headers["content-type"]?.includes("application/json")
                ? JSON.parse(data)
                : data,
            );
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Download file from URL
 */
function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === "https:" ? https : http;

    const file = createWriteStream(filePath);
    protocol
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        unlinkSync(filePath);
        reject(err);
      });
  });
}

/**
 * List all files in a Supabase Storage bucket recursively
 */
async function listBucketFiles(bucketName, prefix = "") {
  const url = `${SUPABASE_URL}/storage/v1/object/list/${bucketName}`;
  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify({
      prefix: prefix,
      limit: 1000,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    }),
  };

  try {
    const items = await httpsRequest(url, options);
    if (!Array.isArray(items)) return [];

    let allFiles = [];

    for (const item of items) {
      if (!item.name) continue;

      // If it's a folder, recursively list its contents
      if (item.id === null || item.name.endsWith("/")) {
        const folderPath = prefix ? `${prefix}/${item.name}` : item.name;
        const subFiles = await listBucketFiles(bucketName, folderPath);
        allFiles = allFiles.concat(subFiles);
      } else {
        // It's a file, add it with full path
        allFiles.push({
          ...item,
          fullPath: prefix ? `${prefix}/${item.name}` : item.name,
        });
      }
    }

    return allFiles;
  } catch (error) {
    console.error(
      `  ⚠️  Failed to list files in ${bucketName}${prefix ? `/${prefix}` : ""}: ${error.message}`,
    );
    return [];
  }
}

/**
 * List all files wrapper with logging
 */
async function listAllBucketFiles(bucketName) {
  console.log(`  Listing files in bucket: ${bucketName}`);
  return await listBucketFiles(bucketName, "");
}

/**
 * Get authenticated download URL for a file
 */
function getAuthenticatedUrl(bucketName, filePath) {
  // Use authenticated endpoint with service key
  return `${SUPABASE_URL}/storage/v1/object/authenticated/${bucketName}/${filePath}`;
}

/**
 * Download file with authentication
 */
function downloadAuthenticatedFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === "https:" ? https : http;

    const options = {
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
    };

    const file = createWriteStream(filePath);
    protocol
      .get(url, options, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Follow redirect
          https
            .get(response.headers.location, (redirectResponse) => {
              if (redirectResponse.statusCode !== 200) {
                reject(
                  new Error(
                    `Failed to download: ${redirectResponse.statusCode}`,
                  ),
                );
                return;
              }
              redirectResponse.pipe(file);
              file.on("finish", () => {
                file.close();
                resolve();
              });
            })
            .on("error", (err) => {
              unlinkSync(filePath);
              reject(err);
            });
        } else if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        } else {
          response.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve();
          });
        }
      })
      .on("error", (err) => {
        unlinkSync(filePath);
        reject(err);
      });
  });
}

/**
 * Check if file exists in S3 with same size (skip if unchanged)
 */
function isFileInS3(s3Path, localSize) {
  try {
    const result = execSync(
      `aws s3 ls "s3://${S3_BUCKET}/${s3Path}" --region ${AWS_REGION}`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    );

    // Parse S3 ls output: "2025-10-21 14:30:00  1234567 storage/avatars/file.jpg"
    const match = result.match(/\s+(\d+)\s+/);
    if (match) {
      const s3Size = parseInt(match[1], 10);
      return s3Size === localSize;
    }
  } catch (error) {
    // File doesn't exist in S3
    return false;
  }

  return false;
}

/**
 * Upload file to S3
 */
function uploadToS3(localPath, s3Path) {
  try {
    execSync(
      `aws s3 cp "${localPath}" "s3://${S3_BUCKET}/${s3Path}" --region ${AWS_REGION} --storage-class STANDARD_IA`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    );
    return true;
  } catch (error) {
    console.error(`    ❌ Upload failed: ${error.message}`);
    return false;
  }
}

/**
 * Format file size
 */
function formatSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Backup a single bucket
 */
async function backupBucket(bucketName) {
  console.log(`\n[Bucket: ${bucketName}]`);

  // List all files
  const files = await listAllBucketFiles(bucketName);

  if (files.length === 0) {
    console.log("  📭 No files found");
    return;
  }

  console.log(`  📦 Found ${files.length} files`);

  // Create temp directory for this bucket
  const bucketTempDir = join(TEMP_DIR, bucketName);
  if (!existsSync(bucketTempDir)) {
    mkdirSync(bucketTempDir, { recursive: true });
  }

  let bucketUploaded = 0;
  let bucketSkipped = 0;
  let bucketFailed = 0;

  // Process each file
  for (const file of files) {
    stats.totalFiles++;

    // Use fullPath if available, otherwise fallback to name
    const filePath = file.fullPath || file.name;
    const fileSize = file.metadata?.size || 0;
    // Safe local filename (replace path separators and special chars)
    const safeFileName = filePath.replace(/[\/\\:]/g, "_");
    const localPath = join(bucketTempDir, safeFileName);
    const s3Path = `storage/${bucketName}/${filePath}`;

    // Check if file already exists in S3 with same size (skip if unchanged)
    if (isFileInS3(s3Path, fileSize)) {
      console.log(
        `  ⏭️  Skipped: ${filePath} (${formatSize(fileSize)}) - already in S3`,
      );
      stats.skippedFiles++;
      bucketSkipped++;
      continue;
    }

    try {
      // Download from Supabase with authentication
      const downloadUrl = getAuthenticatedUrl(bucketName, filePath);

      // Retry logic for downloads (fix for 504 errors)
      let retries = 3;
      while (retries > 0) {
        try {
          await downloadAuthenticatedFile(downloadUrl, localPath);
          break; // Success
        } catch (err) {
          retries--;
          if (retries === 0) throw err;
          console.log(`  ⚠️  Retry ${3 - retries}/3 for ${filePath}...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      // Verify download
      const localSize = statSync(localPath).size;
      stats.totalSize += localSize;

      // Upload to S3
      const uploaded = uploadToS3(localPath, s3Path);

      if (uploaded) {
        console.log(`  ✅ Uploaded: ${filePath} (${formatSize(localSize)})`);
        stats.uploadedFiles++;
        stats.uploadedSize += localSize;
        bucketUploaded++;
      } else {
        stats.failedFiles++;
        bucketFailed++;
      }

      // Cleanup local file
      unlinkSync(localPath);
    } catch (error) {
      console.error(`  ❌ Failed: ${filePath} - ${error.message}`);
      stats.failedFiles++;
      bucketFailed++;
    }
  }

  console.log(
    `  📊 Bucket summary: ${bucketUploaded} uploaded, ${bucketSkipped} skipped, ${bucketFailed} failed`,
  );
}

/**
 * Main backup process
 */
async function main() {
  const startTime = Date.now();

  console.log("======================================");
  console.log("Supabase Storage Backup to S3");
  console.log("======================================");
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Project: ${SUPABASE_URL}`);
  console.log(`S3 Bucket: s3://${S3_BUCKET}/storage/`);
  console.log(`Buckets: ${BUCKETS.length}`);
  console.log("======================================\n");

  // Create temp directory
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
  }

  // Backup each bucket
  for (const bucket of BUCKETS) {
    try {
      await backupBucket(bucket);
    } catch (error) {
      console.error(`\n❌ Bucket ${bucket} failed: ${error.message}`);
    }
  }

  // Cleanup temp directory
  try {
    execSync(`rm -rf "${TEMP_DIR}"`, { stdio: "ignore" });
  } catch (error) {
    // Ignore cleanup errors
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Final summary
  console.log("\n======================================");
  console.log("Backup Complete!");
  console.log("======================================");
  console.log(`Total files: ${stats.totalFiles}`);
  console.log(
    `✅ Uploaded: ${stats.uploadedFiles} (${formatSize(stats.uploadedSize)})`,
  );
  console.log(`⏭️  Skipped: ${stats.skippedFiles} (already in S3)`);
  console.log(`❌ Failed: ${stats.failedFiles}`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log("======================================");

  if (stats.failedFiles > 0) {
    console.error("\n⚠️  Some files failed to backup. Check logs above.");
    // Soft fail: Don't exit with 1, just warn
    // process.exit(1);
  }
}

// Run backup
main().catch((error) => {
  console.error("\n❌ Backup failed:", error.message);
  process.exit(1);
});
