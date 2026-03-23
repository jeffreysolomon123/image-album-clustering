# client.py - Utility functions for image clustering
# This module provides helper functions for the FastAPI backend

from engine import run_pipeline, extract_embeddings, cluster_images, get_label, load_images
import os
import shutil
import tempfile
from typing import List, Dict, Any

class ImageClusterClient:
    """Client class for image clustering operations"""
    
    def __init__(self):
        self.temp_dir = None
    
    def create_temp_session(self) -> str:
        """Create a temporary directory for a session"""
        self.temp_dir = tempfile.mkdtemp(prefix="cluster_session_")
        return self.temp_dir
    
    def cleanup_session(self):
        """Clean up temporary directory"""
        if self.temp_dir and os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
            self.temp_dir = None
    
    def analyze_images_in_folder(self, folder_path: str) -> List[Dict[str, Any]]:
        """
        Analyze images in a folder and return cluster results
        Compatible with the original run_pipeline but returns structured data
        """
        try:
            # Load images
            image_paths = load_images(folder_path)
            
            if not image_paths:
                raise ValueError("No valid images found in the folder")
            
            # Extract embeddings
            embeddings = extract_embeddings(image_paths)
            
            # Cluster images
            clusters, cluster_indices = cluster_images(embeddings, image_paths)
            
            # Prepare results with labels
            results = []
            
            for cluster_id, imgs in clusters.items():
                indices = cluster_indices[cluster_id]
                
                # Get label for this cluster
                rep_img = imgs[0]
                label = get_label(rep_img)
                
                results.append({
                    "cluster_id": cluster_id,
                    "cluster_name": label,
                    "images": imgs,
                    "image_count": len(imgs)
                })
            
            return results
            
        except Exception as e:
            raise Exception(f"Analysis failed: {str(e)}")
    
    def get_cluster_summary(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Get a summary of clustering results"""
        total_images = sum(result["image_count"] for result in results)
        cluster_labels = [result["cluster_name"] for result in results]
        
        return {
            "total_clusters": len(results),
            "total_images": total_images,
            "cluster_labels": cluster_labels,
            "average_images_per_cluster": total_images / len(results) if results else 0
        }

# Legacy function for backward compatibility
def run_pipeline_with_progress(folder_path: str, progress_callback=None):
    """
    Legacy function that mimics the original run_pipeline but with progress callbacks
    """
    client = ImageClusterClient()
    
    try:
        if progress_callback:
            progress_callback("Loading images...", 10)
        
        image_paths = load_images(folder_path)
        
        if not image_paths:
            raise ValueError("No valid images found")
        
        if progress_callback:
            progress_callback("Extracting features...", 30)
        
        embeddings = extract_embeddings(image_paths)
        
        if progress_callback:
            progress_callback("Clustering images...", 60)
        
        clusters, cluster_indices = cluster_images(embeddings, image_paths)
        
        if progress_callback:
            progress_callback("Generating labels...", 80)
        
        results = []
        
        for cluster_id, imgs in clusters.items():
            indices = cluster_indices[cluster_id]
            cluster_embs = embeddings[indices]
            
            rep_img = imgs[0]
            label = get_label(rep_img)
            
            results.append({
                "cluster_id": cluster_id,
                "label": label,
                "images": imgs
            })
        
        if progress_callback:
            progress_callback("Analysis complete!", 100)
        
        return results
        
    except Exception as e:
        if progress_callback:
            progress_callback(f"Error: {str(e)}", 0)
        raise e

# Keep the original CLI functionality for testing
if __name__ == "__main__":
    print("CLI ready")
    print("Commands:")
    print("  set <folder>")
    print("  run")
    print("  exit\n")

    current_folder = None
    client = ImageClusterClient()

    while True:
        cmd = input(">> ").strip()

        if cmd.startswith("set "):
            current_folder = cmd[4:]
            print(f"Folder set to: {current_folder}")

        elif cmd == "run":
            if not current_folder:
                print("Set folder first.")
                continue

            try:
                results = client.analyze_images_in_folder(current_folder)

                # Count label occurrences
                label_counts = {}
                for cluster in results:
                    label = cluster["cluster_name"]
                    label_counts[label] = label_counts.get(label, 0) + 1

                # Track numbering
                label_indices = {}

                for cluster in results:
                    base_label = cluster["cluster_name"]

                    if label_counts[base_label] > 1:
                        label_indices[base_label] = label_indices.get(base_label, 0) + 1
                        display_label = f"{base_label} {label_indices[base_label]}"
                    else:
                        display_label = base_label

                    print(f"\n=== Cluster {cluster['cluster_id']} ===")
                    print(f"Label: {display_label}")
                    print(f"Images ({len(cluster['images'])}):")

                    for img in cluster["images"]:
                        print(f"  {img}")

            except Exception as e:
                print(f"Error: {str(e)}")

        elif cmd == "exit":
            break

        else:
            print("Unknown command")