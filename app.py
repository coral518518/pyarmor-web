from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse
import os
import shutil
import subprocess
import uuid
import zipfile

app = FastAPI()

BASE_DIR = "temp"
os.makedirs(BASE_DIR, exist_ok=True)


@app.post("/obfuscate")
async def obfuscate(file: UploadFile = File(...)):

    uid = str(uuid.uuid4())
    workdir = f"{BASE_DIR}/{uid}"

    os.makedirs(workdir, exist_ok=True)

    input_path = f"{workdir}/{file.filename}"

    with open(input_path, "wb") as f:
        f.write(await file.read())

    # PyArmor 混淆
    subprocess.run(f"pyarmor gen {input_path}", shell=True, cwd=workdir)

    dist_dir = f"{workdir}/dist"

    zip_path = f"{workdir}/result.zip"

    with zipfile.ZipFile(zip_path, "w") as zipf:
        for root, dirs, files in os.walk(dist_dir):
            for file2 in files:
                full = os.path.join(root, file2)
                zipf.write(full, os.path.relpath(full, dist_dir))

    return FileResponse(zip_path, media_type="application/zip", filename="result.zip")
