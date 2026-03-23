# engine.py

import os
import torch
import clip
import numpy as np
from PIL import Image
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import normalize
from labels import RAW_LABELS

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

print("Loading CLIP...")
clip_model, preprocess = clip.load("ViT-B/32", device=DEVICE)
clip_model.eval()

print("Loading precomputed label embeddings...")
text_features = np.load("label_embeddings.npy")
text_features = torch.tensor(text_features).to(DEVICE)

def load_images(folder):
    return [
        os.path.join(folder, f)
        for f in os.listdir(folder)
        if f.lower().endswith((".png", ".jpg", ".jpeg"))
    ]


def extract_embeddings(image_paths):
    embeddings = []

    with torch.no_grad():
        for path in image_paths:
            try:
                image = preprocess(Image.open(path).convert("RGB")).unsqueeze(0).to(DEVICE)
                emb = clip_model.encode_image(image)
                embeddings.append(emb.cpu().numpy()[0])
            except:
                print(f"Skipping {path}")

    embeddings = np.array(embeddings)
    return normalize(embeddings)


def cluster_images(embeddings, image_paths):
    clustering = DBSCAN(eps=0.3, min_samples=2, metric="cosine")
    labels = clustering.fit_predict(embeddings)

    clusters = {}
    cluster_indices = {}

    for idx, (path, label) in enumerate(zip(image_paths, labels)):
        if label == -1:
            continue
        clusters.setdefault(label, []).append(path)
        cluster_indices.setdefault(label, []).append(idx)

    return clusters, cluster_indices


def get_label(image_path):
    image = preprocess(Image.open(image_path).convert("RGB")).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        image_features = clip_model.encode_image(image)
        image_features /= image_features.norm(dim=-1, keepdim=True)

        similarity = image_features @ text_features.T

    best_idx = similarity.argmax().item()

    return RAW_LABELS[best_idx]


def get_label_with_confidence(image_path):
    """Get label and confidence score for an image"""
    try:
        image = preprocess(Image.open(image_path).convert("RGB")).unsqueeze(0).to(DEVICE)

        with torch.no_grad():
            image_features = clip_model.encode_image(image)
            image_features /= image_features.norm(dim=-1, keepdim=True)

            similarity = image_features @ text_features.T
            
            # Apply softmax to get probability distribution
            similarity_scores = torch.softmax(similarity, dim=-1)
            
            best_idx = similarity.argmax().item()
            confidence = similarity_scores[best_idx].item()

        return RAW_LABELS[best_idx], confidence
    except Exception as e:
        print(f"Error in get_label_with_confidence for {image_path}: {e}")
        print(f"Image features shape: {image_features.shape if 'image_features' in locals() else 'N/A'}")
        print(f"Text features shape: {text_features.shape}")
        print(f"Similarity shape: {similarity.shape if 'similarity' in locals() else 'N/A'}")
        # Fallback to basic label without confidence
        return get_label(image_path), 0.5


def calculate_cluster_confidence(image_paths, cluster_label):
    """Calculate average confidence for a cluster"""
    confidences = []
    for img_path in image_paths:
        _, confidence = get_label_with_confidence(img_path)
        confidences.append(confidence)
    
    return sum(confidences) / len(confidences) if confidences else 0.0


def run_pipeline(folder):
    image_paths = load_images(folder)
    embeddings = extract_embeddings(image_paths)
    clusters, cluster_indices = cluster_images(embeddings, image_paths)

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

    return results