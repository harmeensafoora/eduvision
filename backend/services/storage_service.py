"""
Storage service — local filesystem or Azure Blob Storage.
Local mode: saves to backend/uploads/{user_id}/{filename}
             serves via /static/uploads/...
Azure mode: uploads to blob container, returns 1-hour SAS URL.
"""

import shutil
import uuid
from pathlib import Path
from typing import IO

from backend.config import settings


class StorageService:
    def __init__(self):
        self._use_local = settings.USE_LOCAL_STORAGE
        self._base = settings.LOCAL_UPLOAD_DIR
        if not self._use_local:
            try:
                from azure.storage.blob import (
                    BlobServiceClient,
                    generate_blob_sas,
                    BlobSasPermissions,
                )

                self._blob_client = BlobServiceClient.from_connection_string(
                    settings.AZURE_STORAGE_CONNECTION_STRING
                )
                self._container = settings.AZURE_STORAGE_CONTAINER
                self._generate_blob_sas = generate_blob_sas
                self._BlobSasPermissions = BlobSasPermissions
            except Exception as exc:
                print(
                    f"[storage] Azure init failed ({exc}), falling back to local storage"
                )
                self._use_local = True

    def save(self, file_obj: IO[bytes], filename: str, user_id: str) -> str:
        """Save file and return a URL/path that can be stored in the DB."""
        safe_name = f"{uuid.uuid4().hex}_{Path(filename).name}"
        if self._use_local:
            return self._save_local(file_obj, safe_name, user_id)
        return self._save_azure(file_obj, safe_name, user_id)

    def _save_local(self, file_obj: IO[bytes], filename: str, user_id: str) -> str:
        dest_dir = self._base / user_id
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / filename
        with open(dest, "wb") as out:
            shutil.copyfileobj(file_obj, out)
        return f"/static/uploads/{user_id}/{filename}"

    def _save_azure(self, file_obj: IO[bytes], filename: str, user_id: str) -> str:
        blob_name = f"{user_id}/{filename}"
        container_client = self._blob_client.get_container_client(self._container)
        container_client.upload_blob(blob_name, file_obj, overwrite=True)
        # Return blob path only (SAS URL generated on-demand)
        return blob_name

    def get_read_url(self, blob_path: str) -> str:
        """Generate a read URL for a stored blob. For local: return static URL.
        For Azure: generate fresh SAS URL (on-demand)."""
        if self._use_local:
            # Local: return static URL directly
            return f"/static/uploads/{blob_path}"
        return self._generate_fresh_sas_url(blob_path)

    def _generate_fresh_sas_url(self, blob_path: str) -> str:
        """Generate a fresh SAS URL for Azure blob access."""
        from datetime import datetime, timedelta, timezone

        account_name = self._blob_client.account_name
        account_key = self._blob_client.credential.account_key
        sas = self._generate_blob_sas(
            account_name=account_name,
            container_name=self._container,
            blob_name=blob_path,
            account_key=account_key,
            permission=self._BlobSasPermissions(read=True),
            expiry=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        return f"https://{account_name}.blob.core.windows.net/{self._container}/{blob_path}?{sas}"

    def local_path(self, url: str) -> Path:
        """Convert a /static/uploads/... URL back to an absolute filesystem path."""
        rel = url.removeprefix("/static/uploads/")
        return self._base / rel


storage_service = StorageService()
