from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import os
import asyncio
import json
import uuid
import shutil
from typing import List, Dict
import tempfile
from pathlib import Path

from engine import run_pipeline, extract_embeddings, cluster_images, get_label, get_label_with_confidence, calculate_cluster_confidence, load_images

app = FastAPI(title="Image Clustering API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active connections by session ID
active_connections: Dict[str, List[WebSocket]] = {}

# Store SSE event queues by session ID
sse_events: Dict[str, List[Dict]] = {}

# Store temporary upload directories
upload_sessions = {}

@app.get("/events/{session_id}")
async def sse_endpoint(session_id: str):
    """Server-Sent Events endpoint for real-time progress updates"""
    
    async def event_generator():
        # Store this session's events
        if session_id not in upload_sessions:
            yield "data: {\"type\": \"error\", \"message\": \"Invalid session\"}\n\n"
            return
        
        # Initialize event queue for this session
        if session_id not in sse_events:
            sse_events[session_id] = []
        
        print(f"SSE client connected for session: {session_id}")
        
        # Send initial connection message
        yield f"data: {json.dumps({'type': 'connected', 'message': 'Progress updates enabled'})}\n\n"
        
        # Send any queued events
        while session_id in sse_events and sse_events[session_id]:
            event = sse_events[session_id].pop(0)
            yield f"data: {json.dumps(event)}\n\n"
        
        # Keep connection alive and check for new events
        try:
            while session_id in upload_sessions:
                if session_id in sse_events and sse_events[session_id]:
                    event = sse_events[session_id].pop(0)
                    yield f"data: {json.dumps(event)}\n\n"
                else:
                    # Send heartbeat
                    yield f"data: {json.dumps({'type': 'heartbeat', 'timestamp': asyncio.get_event_loop().time()})}\n\n"
                    await asyncio.sleep(2)
        except Exception as e:
            print(f"SSE error for session {session_id}: {e}")
        finally:
            print(f"SSE client disconnected for session: {session_id}")
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

async def send_progress_update(session_id: str, step: str, message: str, progress: int = None):
    """Send progress update to all connected clients for a specific session"""
    print(f"Sending progress update to session {session_id}: {step} - {message} ({progress}%)")
    update = {
        "type": "progress",
        "step": step,
        "message": message,
        "progress": progress
    }
    
    # Send via WebSocket (if any connections)
    if session_id in active_connections:
        print(f"Found {len(active_connections[session_id])} WebSocket connections for session {session_id}")
        # Send to all connections for this session
        disconnected_connections = []
        for i, connection in enumerate(active_connections[session_id]):
            try:
                await connection.send_text(json.dumps(update))
                print(f"Sent progress update to WebSocket connection {i+1}")
            except Exception as e:
                print(f"Failed to send to WebSocket connection {i+1}: {e}")
                # Mark disconnected connections for removal
                disconnected_connections.append(connection)
        
        # Remove disconnected connections
        for conn in disconnected_connections:
            active_connections[session_id].remove(conn)
        
        # Clean up if no connections left
        if not active_connections[session_id]:
            del active_connections[session_id]
    else:
        print(f"No WebSocket connections found for session {session_id}")
    
    # Send via SSE (add to event queue)
    if session_id not in sse_events:
        sse_events[session_id] = []
    sse_events[session_id].append(update)
    print(f"Added progress update to SSE queue for session {session_id}")

@app.post("/upload")
async def upload_images(files: List[UploadFile] = File(...)):
    """Upload images and return session ID"""
    session_id = str(uuid.uuid4())
    
    # Create temporary directory for this session
    temp_dir = tempfile.mkdtemp(prefix=f"upload_{session_id}_")
    upload_sessions[session_id] = temp_dir
    
    # Save uploaded files
    saved_files = []
    for file in files:
        if file.content_type.startswith('image/'):
            file_path = os.path.join(temp_dir, file.filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            saved_files.append(file.filename)
    
    return {
        "session_id": session_id,
        "message": f"Uploaded {len(saved_files)} images",
        "files_count": len(saved_files)
    }

@app.post("/analyze/{session_id}")
async def analyze_images(session_id: str):
    """Analyze uploaded images and return clusters"""
    if session_id not in upload_sessions:
        return {"error": "Invalid session ID"}
    
    temp_dir = upload_sessions[session_id]
    
    try:
        # Send initial progress
        await send_progress_update(session_id, "upload", "Uploading to FastAPI...", 0)
        await asyncio.sleep(0.5)
        
        # Load images
        await send_progress_update(session_id, "extract", "Extracting visual features...", 20)
        image_paths = load_images(temp_dir)
        
        if not image_paths:
            return {"error": "No valid images found"}
        
        await asyncio.sleep(0.5)
        
        # Extract embeddings
        await send_progress_update(session_id, "extract", "Analyzing image characteristics...", 40)
        embeddings = extract_embeddings(image_paths)
        
        await asyncio.sleep(0.5)
        
        # Cluster images
        await send_progress_update(session_id, "cluster", "Grouping similar images using AI algorithms...", 60)
        clusters, cluster_indices = cluster_images(embeddings, image_paths)
        
        await asyncio.sleep(0.5)
        
        # Generate labels and prepare results
        await send_progress_update(session_id, "generate", "Creating intelligent descriptions for each cluster...", 80)
        results = []
        
        # Track label occurrences for numbering
        label_counts = {}
        
        for cluster_id, imgs in clusters.items():
            indices = cluster_indices[cluster_id]
            cluster_embs = embeddings[indices]
            
            rep_img = imgs[0]
            label = get_label(rep_img)
            
            # Count label occurrences
            label_counts[label] = label_counts.get(label, 0) + 1
        
        # Reset counts for numbering
        label_indices = {}
        
        for cluster_id, imgs in clusters.items():
            indices = cluster_indices[cluster_id]
            cluster_embs = embeddings[indices]
            
            rep_img = imgs[0]
            label = get_label(rep_img)
            
            # Add numbering if label appears multiple times
            display_label = label
            if label_counts[label] > 1:
                label_indices[label] = label_indices.get(label, 0) + 1
                display_label = f"{label}-{label_indices[label]}"
            
            # Convert image paths to base64 for frontend
            image_data = []
            for img_path in imgs:
                with open(img_path, "rb") as f:
                    import base64
                    img_data = base64.b64encode(f.read()).decode('utf-8')
                    
                    # Get confidence score for this image
                    try:
                        _, confidence = get_label_with_confidence(img_path)
                        confidence_percent = round(confidence * 100, 1)
                    except Exception as e:
                        print(f"Error calculating confidence for {img_path}: {e}")
                        confidence_percent = 50.0  # Default confidence
                    
                    image_data.append({
                        "id": os.path.basename(img_path),
                        "data": img_data,
                        "caption": f"Processed as {label.lower()} based on visual analysis.",
                        "confidence": confidence_percent
                    })       
            results.append({
                "cluster_id": f"c{cluster_id}",
                "cluster_name": display_label,
                "images": image_data
            })
        
        await asyncio.sleep(0.5)
        
        # Finalize
        await send_progress_update(session_id, "finalize", "Organizing and preparing final results...", 100)
        
        # Cleanup
        shutil.rmtree(temp_dir)
        del upload_sessions[session_id]
        
        return {
            "success": True,
            "clusters": results,
            "total_clusters": len(results)
        }
        
    except Exception as e:
        # Cleanup on error
        if session_id in upload_sessions:
            shutil.rmtree(upload_sessions[session_id])
            del upload_sessions[session_id]
        
        return {"error": str(e)}

@app.get("/")
async def root():
    return {"message": "Image Clustering API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "model_loaded": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
