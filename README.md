
# Dynamic Medical Image Classifier for Targeted Labeling

A full-stack image classification application using a custom OpenCLIP model backend (Flask + PyTorch) and a React frontend served by Nginx. Supports dynamic label updates and image prediction via REST API.

---


https://github.com/user-attachments/assets/2fa4c9a0-4cda-426e-922d-015cd95ee2d6

## 🚀 Features

- Custom OpenCLIP model for zero-shot image classification
- Flask backend serving prediction and label update APIs
- React frontend for user interaction (upload images, view predictions)
- Dynamic label management (`labels.json`)
- Dockerized services for easy deployment
- `docker-compose` setup to run frontend and backend together

---





## 🗂️ Project Structure

```
openclip-infer/
├── backend/
│   ├── app.py               # Flask backend API server
│   ├── Dockerfile           # Backend Dockerfile
│   ├── requirements.txt     # Backend Python dependencies
│   ├── checkpoints/         # Model weights and config files
│   │   ├── open_clip_pytorch_model.bin
│   │   └── open_clip_config.json
│   └── labels.json          # Dynamic label file (updated at runtime)
├── frontend/
│   ├── index.html           # React frontend entrypoint
│   ├── index.js             # React app JavaScript
│   ├── index.css            # Frontend styles
│   └── Dockerfile           # Frontend Dockerfile (Nginx)
└── docker-compose.yml       # Compose file for multi-container deployment
```

---

## ⚙️ Setup and Run

### Prerequisites

- Docker & Docker Compose installed
- GPU (optional) for faster model inference

### Build and run containers

From the project root:

```bash
docker-compose up --build
```

- Backend API available at: `http://localhost:5000`
- Frontend UI available at: `http://localhost`

---

## 🔧 Backend API Endpoints

### POST `/predict`

- **Description:** Predict labels for the uploaded image
- **Form Data:** `file` - image file (jpg, png, etc.)
- **Response:** JSON array of predicted labels with confidence scores

### POST `/update_labels`

- **Description:** Update the list of classification labels
- **JSON Body:** `{ "labels": ["label1", "label2", ...] }`
- **Response:** Confirmation message with updated label list

---

## 📁 Labels Management

- Labels are stored dynamically in `backend/labels.json`
- You can update labels by calling `/update_labels` API
- New labels will be merged uniquely with existing ones

---

## ⚡ Development Tips

- Backend code hot reload can be enabled by adding `FLASK_ENV=development`
- Frontend React app can be developed outside Docker and served separately if preferred
- Make sure your `checkpoints/` directory has valid OpenCLIP weights and config files

---

## 🤝 Contribution

Feel free to open issues or submit pull requests for bug fixes and improvements!

---

## 📄 License

Specify your license here (e.g., MIT)
