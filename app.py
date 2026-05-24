from fastapi import (
    FastAPI,
    Request,
    HTTPException,
    Query,
    UploadFile,
    File,
    BackgroundTasks,
)
from fastapi.responses import FileResponse, PlainTextResponse
import os
import shutil
import subprocess
import uuid
import zipfile

app = FastAPI(title="PyArmor Web Obfuscation Service")

BASE_DIR = "/tmp/pyarmor" if os.path.exists("/tmp") else "temp"
os.makedirs(BASE_DIR, exist_ok=True)


def cleanup_dir(path: str):
    """Safely removes the directory after response completion."""
    shutil.rmtree(path, ignore_errors=True)


@app.post("/obfuscate")
async def obfuscate(
    request: Request,
    background_tasks: BackgroundTasks,
    format: str = Query("text", pattern="^(text|zip)$"),
    platform: str = Query(
        None, description="Target platforms, e.g. windows.x86_64,linux.x86_64"
    ),
):
    uid = str(uuid.uuid4())
    workdir = os.path.join(BASE_DIR, uid)
    os.makedirs(workdir, exist_ok=True)

    filename = "main.py"

    # 1. Parse Input: Handle multipart file upload or raw body
    content_type = request.headers.get("content-type", "")

    if "multipart/form-data" in content_type:
        form = await request.form()
        uploaded_file = form.get("file")
        if not isinstance(uploaded_file, UploadFile):
            raise HTTPException(
                status_code=400, detail="No file found in multipart form-data"
            )
        filename = uploaded_file.filename or "main.py"
        input_path = os.path.join(workdir, filename)
        with open(input_path, "wb") as f:
            f.write(await uploaded_file.read())
    else:
        body = await request.body()
        if not body:
            raise HTTPException(
                status_code=400, detail="Empty request body. Please POST Python code."
            )

        if "application/json" in content_type:
            try:
                import json

                data = json.loads(body)
                code = data.get("code", "")
                filename = data.get("filename", "main.py")
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid JSON format")
        else:
            # Assume text/plain
            code = body.decode("utf-8", errors="ignore")

        if not code:
            raise HTTPException(
                status_code=400,
                detail="No Python code content found in the request body",
            )

        input_path = os.path.join(workdir, filename)
        with open(input_path, "w", encoding="utf-8") as f:
            f.write(code)

    # 2. Build and run the PyArmor command securely
    cmd = ["pyarmor", "gen"]
    if platform:
        cmd.extend(["--platform", platform])
    cmd.append(filename)

    result = subprocess.run(cmd, capture_output=True, text=True, cwd=workdir)

    if result.returncode != 0:
        error_msg = result.stderr or result.stdout or "Unknown PyArmor error"
        cleanup_dir(workdir)
        raise HTTPException(status_code=500, detail=f"PyArmor Error:\n{error_msg}")

    dist_dir = os.path.join(workdir, "dist")
    dist_file = os.path.join(dist_dir, filename)

    if not os.path.exists(dist_file):
        cleanup_dir(workdir)
        raise HTTPException(
            status_code=500, detail="Obfuscated file was not generated correctly."
        )

    # ZIP output format containing both the obfuscated script and the runtime package
    zip_path = os.path.join(workdir, "result.zip")
    with zipfile.ZipFile(zip_path, "w") as zipf:
        for root, dirs, files in os.walk(dist_dir):
            for f2 in files:
                full_path = os.path.join(root, f2)
                zipf.write(full_path, os.path.relpath(full_path, dist_dir))

    # Trigger background task cleanup after the stream finishes
    background_tasks.add_task(cleanup_dir, workdir)
    return FileResponse(zip_path, media_type="application/zip", filename="result.zip")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
