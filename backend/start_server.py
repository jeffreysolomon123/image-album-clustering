#!/usr/bin/env python3
"""
Startup script for the Image Clustering API Server
"""

import uvicorn
import os
import sys

def main():
    # Check if we're in a virtual environment
    if sys.prefix == sys.base_prefix:
        print("Warning: Not running in a virtual environment!")
        print("Please activate the virtual environment first:")
        print("  .\\venv\\Scripts\\Activate.ps1")
        return
    
    print("Starting Image Clustering API Server...")
    print("Loading CLIP model (this may take a moment)...")
    
    # Start the server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,  # Disable reload for production
        log_level="info"
    )

if __name__ == "__main__":
    main()
