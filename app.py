"""
Flask REST API for Lung Cancer Detection System.

Endpoints:
    GET  /api/health          - Health check
    POST /api/predict         - Upload image and get prediction
    GET  /api/history         - List prediction history
    GET  /api/history/<id>    - Get single prediction record
    DELETE /api/history/<id>  - Delete prediction record
"""

import json
import os
import sqlite3
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

# Add model directory to path for inference imports
MODEL_DIR = Path(__file__).resolve().parent.parent / "model"
sys.path.insert(0, str(MODEL_DIR))

from inference import predict  # noqa: E402

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = Path(__file__).resolve().parent / "uploads"
DB_PATH = Path(__file__).resolve().parent / "predictions.db"
MODEL_PATH = MODEL_DIR / "lung_cancer_model.keras"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "bmp", "tiff", "webp"}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB

app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Initialize SQLite database for prediction history."""
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS predictions (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                prediction TEXT NOT NULL,
                confidence REAL NOT NULL,
                probabilities TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def save_prediction(
    filename: str,
    original_filename: str,
    result: dict,
) -> str:
    """Persist prediction result to database."""
    record_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO predictions
                (id, filename, original_filename, prediction, confidence, probabilities, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record_id,
                filename,
                original_filename,
                result["prediction"],
                result["confidence"],
                json.dumps(result["probabilities"]),
                created_at,
            ),
        )
        conn.commit()
    return record_id


def row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "filename": row["filename"],
        "original_filename": row["original_filename"],
        "prediction": row["prediction"],
        "confidence": row["confidence"],
        "probabilities": json.loads(row["probabilities"]),
        "created_at": row["created_at"],
        "image_url": f"/api/uploads/{row['filename']}",
    }


@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint."""
    model_exists = MODEL_PATH.exists()
    return jsonify(
        {
            "status": "healthy",
            "model_loaded": model_exists,
            "model_path": str(MODEL_PATH),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )


@app.route("/api/predict", methods=["POST"])
def predict_image():
    """
    Upload a CT scan or X-ray image and receive a prediction.

    Form data:
        file: image file (required)
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided. Use 'file' field in form data."}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected."}), 400

    if not allowed_file(file.filename):
        return jsonify(
            {
                "error": f"Invalid file type. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            }
        ), 400

    if not MODEL_PATH.exists():
        return jsonify(
            {
                "error": "Model not trained yet. Run 'python train.py' in the model/ directory.",
                "model_path": str(MODEL_PATH),
            }
        ), 503

    original_filename = secure_filename(file.filename)
    ext = original_filename.rsplit(".", 1)[1].lower()
    stored_filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = UPLOAD_FOLDER / stored_filename
    file.save(str(filepath))

    try:
        result = predict(str(filepath), model_path=MODEL_PATH)
        record_id = save_prediction(stored_filename, original_filename, result)

        return jsonify(
            {
                "id": record_id,
                "filename": stored_filename,
                "original_filename": original_filename,
                "prediction": result["prediction"],
                "confidence": result["confidence"],
                "probabilities": result["probabilities"],
                "image_url": f"/api/uploads/{stored_filename}",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    except Exception as exc:
        if filepath.exists():
            filepath.unlink()
        return jsonify({"error": str(exc)}), 500


@app.route("/api/history", methods=["GET"])
def get_history():
    """Return all prediction records, newest first."""
    limit = request.args.get("limit", 50, type=int)
    limit = min(max(limit, 1), 200)

    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM predictions ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()

    return jsonify({"count": len(rows), "predictions": [row_to_dict(r) for r in rows]})


@app.route("/api/history/<record_id>", methods=["GET"])
def get_prediction(record_id: str):
    """Get a single prediction record by ID."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM predictions WHERE id = ?", (record_id,)
        ).fetchone()

    if row is None:
        return jsonify({"error": "Prediction not found."}), 404

    return jsonify(row_to_dict(row))


@app.route("/api/history/<record_id>", methods=["DELETE"])
def delete_prediction(record_id: str):
    """Delete a prediction record and its uploaded image."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM predictions WHERE id = ?", (record_id,)
        ).fetchone()
        if row is None:
            return jsonify({"error": "Prediction not found."}), 404

        filepath = UPLOAD_FOLDER / row["filename"]
        if filepath.exists():
            filepath.unlink()

        conn.execute("DELETE FROM predictions WHERE id = ?", (record_id,))
        conn.commit()

    return jsonify({"message": "Prediction deleted.", "id": record_id})


@app.route("/api/uploads/<filename>", methods=["GET"])
def serve_upload(filename: str):
    """Serve uploaded images."""
    return send_from_directory(str(UPLOAD_FOLDER), filename)


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    print(f"Starting Lung Cancer Detection API on port {port}")
    print(f"Model path: {MODEL_PATH} (exists: {MODEL_PATH.exists()})")
    app.run(host="0.0.0.0", port=port, debug=debug)
