# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import logging

from google.cloud import exceptions as api_exceptions
from google.cloud import storage  # type: ignore[attr-defined]

logger = logging.getLogger(__name__)


class StorageManager:
    """Manages GCS storage operations required for sample data seeding."""

    def __init__(
        self,
        project_id: str | None = None,
        client: storage.Client | None = None,
    ):
        """Initializes the StorageManager.

        Args:
            project_id: The GCP project ID to bind this client to.
            client: A pre-configured GCS client. If None, a default client
              will be initialized.
        """
        self._client = client or storage.Client(project=project_id)

    def bucket_exists(self, bucket_name: str) -> bool:
        """Checks if a GCS bucket exists and is accessible."""
        try:
            self._client.get_bucket(bucket_name)
            return True
        except api_exceptions.NotFound:
            return False
        except Exception as e:
            logger.error("Error checking bucket %s existence: %s", bucket_name, e)
            raise

    def create_bucket(self, bucket_name: str, location: str = "US") -> bool:
        """Creates a new GCS bucket in the specified location."""
        logger.info("Creating bucket %s in location %s...", bucket_name, location)
        try:
            bucket = self._client.bucket(bucket_name)
            bucket.storage_class = "STANDARD"
            self._client.create_bucket(bucket, location=location)
            logger.info("Bucket %s created successfully.", bucket_name)
            return True
        except Exception as e:
            logger.error("Failed to create bucket %s: %s", bucket_name, e)
            return False

    def copy_objects(
        self,
        *,
        source_bucket_name: str,
        source_prefix: str,
        dest_bucket_name: str,
        dest_prefix: str,
    ) -> bool:
        """Copies objects from a source GCS folder prefix to a destination bucket/prefix."""
        logger.info(
            "Copying objects from gs://%s/%s to gs://%s/%s...",
            source_bucket_name,
            source_prefix,
            dest_bucket_name,
            dest_prefix,
        )
        try:
            source_bucket = self._client.bucket(source_bucket_name)
            dest_bucket = self._client.bucket(dest_bucket_name)

            blobs = self._client.list_blobs(source_bucket, prefix=source_prefix)
            success = True

            for blob in blobs:
                # Calculate target blob name
                relative_path = blob.name[len(source_prefix) :].lstrip("/")
                dest_blob_name = f"{dest_prefix}/{relative_path}" if dest_prefix else relative_path

                logger.debug("Copying %s to %s...", blob.name, dest_blob_name)
                try:
                    source_bucket.copy_blob(blob, dest_bucket, new_name=dest_blob_name)
                except Exception as err:
                    logger.error("Failed to copy blob %s: %s", blob.name, err)
                    success = False

            return success
        except Exception as e:
            logger.error(
                "Failed copying from gs://%s/%s: %s",
                source_bucket_name,
                source_prefix,
                e,
            )
            return False

    def delete_bucket(self, bucket_name: str, force: bool = True) -> bool:
        """Deletes a GCS bucket. If force is True, deletes all objects within first."""
        logger.info("Deleting bucket %s...", bucket_name)
        try:
            bucket = self._client.bucket(bucket_name)
            if force:
                blobs = self._client.list_blobs(bucket)
                for blob in blobs:
                    try:
                        blob.delete()
                    except api_exceptions.NotFound:
                        logger.debug("Blob %s already deleted.", blob.name)
                    except Exception as err:
                        logger.error(
                            "Failed to delete blob %s during cleanup: %s",
                            blob.name,
                            err,
                        )
            bucket.delete()
            logger.info("Bucket %s deleted successfully.", bucket_name)
            return True
        except api_exceptions.NotFound:
            logger.info("Bucket %s does not exist or is already deleted.", bucket_name)
            return True
        except Exception as e:
            logger.error("Failed to delete bucket %s: %s", bucket_name, e)
            return False
