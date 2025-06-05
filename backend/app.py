import os
import json
import torch
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
from io import BytesIO
from open_clip.factory import _MODEL_CONFIGS
import open_clip

# Initialize Flask app
app = Flask(__name__)
CORS(app, supports_credentials=True, origins="*")

# Path configuration
CHECKPOINT_DIR = "checkpoints"
MODEL_BIN = os.path.join(CHECKPOINT_DIR, "open_clip_pytorch_model.bin")
CONFIG_JSON = os.path.join(CHECKPOINT_DIR, "open_clip_config.json")
LABELS_JSON = "labels.json"


def load_model():
    """
    Load OpenCLIP model, config, and tokenizer.
    """
    with open(CONFIG_JSON, "r") as f:
        config = json.load(f)
        model_cfg = config["model_cfg"]
        preprocess_cfg = config["preprocess_cfg"]

    model_name = "biomedclip_local"

    # Register the model config
    _MODEL_CONFIGS[model_name] = model_cfg

    tokenizer = open_clip.get_tokenizer(model_name)

    model, _, preprocess = open_clip.create_model_and_transforms(
        model_name=model_name,
        pretrained=MODEL_BIN,
        **{f"image_{k}": v for k, v in preprocess_cfg.items()},
    )

    return model, preprocess, tokenizer


# Load the model on startup
model, preprocess, tokenizer = load_model()


@app.route("/predict", methods=["POST"])
def predict():
    """
    Perform zero-shot image classification.
    """
    if "file" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["file"]

    try:
        # Load label list
        if os.path.exists(LABELS_JSON):
            with open(LABELS_JSON, "r") as f:
                labels = json.load(f)
        else:
            return jsonify({"error": "Labels file not found"}), 500

        if not labels:
            return jsonify({"error": "Labels list is empty"}), 400

        # Load and preprocess image
        image = Image.open(BytesIO(file.read())).convert("RGB")
        image_tensor = preprocess(image).unsqueeze(0)

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model.to(device).eval()
        image_tensor = image_tensor.to(device)

        # Tokenize labels
        template = "this is a photo of "
        context_length = 256
        text_inputs = tokenizer(
            [template + label for label in labels],
            context_length=context_length
        ).to(device)

        # Run inference
        with torch.no_grad():
            image_features, text_features, logit_scale = model(image_tensor, text_inputs)
            logits = (logit_scale * image_features @ text_features.t()).softmax(dim=-1)
            sorted_indices = torch.argsort(logits, dim=-1, descending=True)

        logits_np = logits.cpu().numpy()
        sorted_indices_np = sorted_indices.cpu().numpy()

        results = [
            {
                "label": labels[idx],
                "score": float(logits_np[0][idx]),
                "rank": rank
            }
            for rank, idx in enumerate(sorted_indices_np[0], start=1)
        ]

        return jsonify({"predictions": results})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/update_labels", methods=["POST"])
def update_labels():
    """
    Update the list of target labels.
    """
    try:
        data = request.get_json()
        new_labels = data.get("labels", [])

        if not isinstance(new_labels, list) or not all(isinstance(label, str) for label in new_labels):
            return jsonify({"error": "Invalid label format. Must be a list of strings."}), 400

        if os.path.exists(LABELS_JSON):
            with open(LABELS_JSON, "r") as f:
                existing_labels = json.load(f)
        else:
            existing_labels = []

        # Merge and deduplicate labels
        updated_labels = list(set(existing_labels + new_labels))

        with open(LABELS_JSON, "w") as f:
            json.dump(updated_labels, f, indent=2)

        return jsonify({
            "message": "Labels updated successfully",
            "labels": updated_labels
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
