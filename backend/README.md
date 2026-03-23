# Image Clustering Backend

FastAPI backend for image clustering using CLIP and machine learning algorithms.

## Features

- **Image Upload**: Multi-file upload support
- **Real-time Progress**: WebSocket connection for live progress updates
- **AI-powered Clustering**: Uses CLIP model for image feature extraction
- **Automatic Labeling**: Generates intelligent labels for image clusters
- **RESTful API**: Clean API endpoints for frontend integration

## Setup

1. **Create and activate virtual environment**:
   ```bash
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the server**:
   ```bash
   python start_server.py
   # or directly
   python main.py
   ```

The server will start on `http://localhost:8000`

## API Endpoints

### Health Check
- `GET /health` - Check if server is running and model is loaded

### Upload Images
- `POST /upload` - Upload multiple image files
- Returns session ID for tracking

### Analyze Images
- `POST /analyze/{session_id}` - Start image analysis
- Returns clustered results with labels

### WebSocket
- `WS /ws/{session_id}` - Real-time progress updates

## Model Information

- **CLIP Model**: ViT-B/32 (338M parameters)
- **Clustering**: DBSCAN algorithm with cosine similarity
- **Labels**: 20 predefined categories for image classification

## Progress Steps

1. **Upload**: Transfer images to server
2. **Extract**: Analyze visual features using CLIP
3. **Cluster**: Group similar images using AI algorithms
4. **Generate**: Create intelligent descriptions
5. **Finalize**: Organize and prepare results

## Testing

Use the built-in CLI for testing:
```bash
python client.py
```

## Architecture

```
backend/
├── main.py              # FastAPI application
├── engine.py            # Core ML processing
├── client.py            # Utility functions
├── labels.py            # Classification labels
├── requirements.txt     # Dependencies
└── start_server.py      # Startup script
```
