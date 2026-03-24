'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Layers, ChevronRight, Info, Loader2, 
  Folder, ArrowLeft, Image as ImageIcon, CheckCircle2, Circle, Activity,
  X, ChevronLeft, ChevronDown, Trash2
} from 'lucide-react';

interface ImageItem {
  id: string;
  url: string;
  caption: string;
  confidence?: number;
}

interface Cluster {
  cluster_id: string;
  cluster_name: string;
  images: ImageItem[];
}

interface ProcessStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed';
  progress?: number;
}

const API_BASE_URL = 'http://localhost:8000';

export default function FolderBasedImageCluster() {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [clusters, setClusters] = useState<Cluster[] | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [processSteps, setProcessSteps] = useState<ProcessStep[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sseConnection, setSseConnection] = useState<EventSource | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageSlider, setShowImageSlider] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    // Cleanup SSE connection on unmount
    return () => {
      if (sseConnection) {
        sseConnection.close();
      }
    };
  }, [sseConnection]);

  const connectSSE = (sessionId: string) => {
    console.log(`Connecting to SSE for session: ${sessionId}`);
    
    // Use Server-Sent Events
    const eventUrl = `${API_BASE_URL}/events/${sessionId}`;
    console.log(`SSE URL: ${eventUrl}`);
    
    const eventSource = new EventSource(eventUrl);
    
    eventSource.onopen = () => {
      console.log('SSE connection opened successfully');
      setLogs(prev => [...prev, 'SSE connected - real-time updates enabled']);
    };
    
    eventSource.onmessage = (event) => {
      console.log('SSE message received:', event.data);
      try {
        const data = JSON.parse(event.data);
        console.log('Parsed SSE data:', data);
        
        // Handle different message types
        if (data.type === 'progress') {
          updateProcessStep(data.step, data.message, data.progress);
        } else if (data.type === 'connected') {
          console.log('SSE connection confirmed:', data.message);
        } else if (data.type === 'heartbeat') {
          // Just a heartbeat, ignore
        } else if (data.type === 'error') {
          console.error('SSE error:', data.message);
          if (data.message === 'Invalid session') {
            // Session is done, close connection gracefully
            console.log('Analysis completed - closing SSE connection');
            eventSource.close();
            setSseConnection(null);
          } else {
            setLogs(prev => [...prev, `SSE error: ${data.message}`]);
          }
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      setLogs(prev => [...prev, 'SSE connection failed - progress updates unavailable']);
      
      // Close the connection to prevent reconnection loops
      eventSource.close();
      setSseConnection(null);
    };
    
    setSseConnection(eventSource);
    return eventSource;
  };

  const updateProcessStep = (stepId: string, message: string, progress?: number) => {
    setProcessSteps(prev => prev.map(step => {
      if (step.id === stepId) {
        const isCompleted = progress === 100 || (progress && progress >= 100);
        return {
          ...step,
          status: isCompleted ? 'completed' : 'processing',
          progress: progress || step.progress,
          description: message
        };
      }
      return step;
    }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(selectedFiles);
      setClusters(null);
      setSelectedFolderId(null);
      setLogs([]);
      setProcessSteps([]);
      setCurrentImageIndex(0);
      setShowImageSlider(selectedFiles.length > 0);
    }
  };

  const removeImage = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    
    if (currentImageIndex >= newFiles.length && newFiles.length > 0) {
      setCurrentImageIndex(newFiles.length - 1);
    }
    
    if (newFiles.length === 0) {
      setShowImageSlider(false);
    }
  };

  const nextImage = () => {
    if (currentImageIndex < files.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  const prevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  const confirmImageSelection = () => {
    setShowImageSlider(false);
    // Automatically start analysis after confirming image selection
    setTimeout(() => {
      startAnalysis();
    }, 500);
  };

  const startAnalysis = async () => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    setClusters(null);
    setLogs(['Initiating pipeline...']);

    const steps: ProcessStep[] = [
      {
        id: 'upload',
        title: 'Upload to FastAPI',
        description: 'Transferring images to processing server',
        status: 'pending'
      },
      {
        id: 'extract',
        title: 'Extract Visual Features',
        description: 'Analyzing image characteristics and patterns',
        status: 'pending'
      },
      {
        id: 'cluster',
        title: 'Cluster Nodes',
        description: 'Grouping similar images using AI algorithms',
        status: 'pending'
      },
      {
        id: 'generate',
        title: 'Generate Captions',
        description: 'Creating intelligent descriptions for each cluster',
        status: 'pending'
      },
      {
        id: 'finalize',
        title: 'Finalize Albums',
        description: 'Organizing and preparing final results',
        status: 'pending'
      }
    ];

    setProcessSteps(steps);

    try {
      // Step 1: Upload images
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const uploadResponse = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const uploadData = await uploadResponse.json();
      const newSessionId = uploadData.session_id;
      setSessionId(newSessionId);
      
      setLogs(prev => [...prev, `Uploaded ${uploadData.files_count} images`]);

      // Connect SSE for real-time progress
      setTimeout(() => {
        connectSSE(newSessionId);
      }, 100);

      // Step 2: Start analysis
      const analyzeResponse = await fetch(`${API_BASE_URL}/analyze/${newSessionId}`, {
        method: 'POST',
      });

      if (!analyzeResponse.ok) {
        throw new Error('Analysis failed');
      }

      const analysisData = await analyzeResponse.json();

      if (analysisData.error) {
        throw new Error(analysisData.error);
      }

      // Convert base64 images to URLs and update clusters
      try {
        const processedClusters: Cluster[] = analysisData.clusters.map((cluster: any) => ({
          cluster_id: cluster.cluster_id,
          cluster_name: cluster.cluster_name,
          images: cluster.images.map((img: any) => ({
            id: img.id,
            url: `data:image/jpeg;base64,${img.data}`,
            caption: img.caption,
            confidence: img.confidence || undefined
          }))
        }));

        setClusters(processedClusters);
        setLogs(prev => [...prev, "Pipeline finished."]);
      } catch (clusterError) {
        console.error('Error processing clusters:', clusterError);
        console.error('Analysis data:', analysisData);
        throw new Error(`Failed to process cluster results: ${clusterError instanceof Error ? clusterError.message : 'Unknown error'}`);
      }

      // Mark all steps as completed
      setProcessSteps(prev => prev.map(step => ({
        ...step,
        status: 'completed' as const,
        progress: 100
      })));

      // Close SSE connection
      if (sseConnection) {
        sseConnection.close();
      }

    } catch (error) {
      console.error('Analysis error:', error);
      setLogs(prev => [...prev, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  const currentFolder = clusters?.find(c => c.cluster_id === selectedFolderId);

  return (
    <div className="flex h-screen bg-white text-slate-900 antialiased font-sans">
      
      {/* Sidebar: Status & Terminal */}
      <aside className="w-72 border-r border-slate-200 flex flex-col bg-slate-50/50">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Layers className="w-5 h-5 text-black" />
            <span className="font-bold tracking-tight text-sm">AI Project</span>
          </div>

          <div className="space-y-4">
            {/* Only show process status when not processing */}
            {!isProcessing && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Process Status</p>
                
                {processSteps.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
                    <Activity className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                    <p className="text-xs text-slate-400">No active process</p>
                    <p className="text-[10px] text-slate-300 mt-1">Upload images to begin analysis</p>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
                    {processSteps.map((step, index) => (
                      <div key={step.id} className="space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            {step.status === 'completed' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : step.status === 'processing' ? (
                              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate">{step.title}</p>
                            <p className="text-[10px] text-slate-400">{step.description}</p>
                          </div>
                        </div>
                        
                        {step.status === 'processing' && step.progress !== undefined && (
                          <div className="ml-7">
                            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${step.progress}%` }}
                              />
                            </div>
                            <p className="text-[9px] text-slate-400 mt-1">{step.progress}%</p>
                          </div>
                        )}
                        
                        {step.status === 'completed' && (
                          <div className="ml-7">
                            <div className="h-1 bg-emerald-500 rounded-full" />
                          </div>
                        )}
                        
                        {index < processSteps.length - 1 && (
                          <div className="ml-2 w-px h-4 bg-slate-100" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {files.length > 0 && (
              <button 
                onClick={startAnalysis}
                disabled={isProcessing}
                className="w-full py-2 bg-black text-white rounded text-xs font-bold hover:bg-slate-800 transition-all disabled:opacity-20 flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
                Run Process
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-5xl mx-auto p-12">
          
          {/* Analysis Loading - Centered */}
          {isProcessing && (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="max-w-md w-full text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-full mb-6">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-3">AI Analysis in Progress</h2>
                <p className="text-slate-600 mb-8">Our intelligent system is analyzing your images and creating meaningful clusters</p>
                
                {/* Progress Steps */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg">
                  {processSteps.map((step, index) => (
                    <div key={step.id} className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {step.status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : step.status === 'processing' ? (
                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300" />
                          )}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-medium text-slate-700">{step.title}</p>
                          <p className="text-xs text-slate-400">{step.description}</p>
                        </div>
                      </div>
                      
                      {step.status === 'processing' && step.progress !== undefined && (
                        <div className="ml-8">
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 ease-out"
                              style={{ width: `${step.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {step.status === 'completed' && (
                        <div className="ml-8">
                          <div className="h-2 bg-emerald-500 rounded-full" />
                        </div>
                      )}
                      
                      {index < processSteps.length - 1 && (
                        <div className="ml-2 w-px h-4 bg-slate-100" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Initial State: Upload */}
          {!clusters && !showImageSlider && !isProcessing && (
            <div className="mt-20">
              <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl mb-6">
                  <Upload className="w-8 h-8 text-blue-600" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-3">Image Clustering Studio</h1>
                <p className="text-slate-600 max-w-md mx-auto">Transform your image collection into intelligently organized albums using AI-powered visual analysis</p>
              </div>
              
              <div className="max-w-xl mx-auto">
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 bg-gradient-to-br from-slate-50 to-blue-50/30 hover:border-blue-400 transition-colors">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
                      <ImageIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Upload Your Images</h3>
                    <p className="text-sm text-slate-600 mb-6">Drag and drop or click to select multiple images</p>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
                    >
                      Choose Files
                    </button>
                    <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                    <p className="mt-4 text-xs text-slate-500">Supports JPG, PNG, and other common image formats</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Image Slider */}
          {showImageSlider && !clusters && !isProcessing && (
            <div className="mt-8">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Review Your Images</h3>
                      <p className="text-blue-100 text-sm">Remove unwanted images before analysis</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                        {currentImageIndex + 1} / {files.length}
                      </span>
                      <button
                        onClick={() => setShowImageSlider(false)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="relative bg-slate-100 rounded-xl overflow-hidden mb-6" style={{ height: '400px' }}>
                    {files[currentImageIndex] && (
                      <img
                        src={URL.createObjectURL(files[currentImageIndex])}
                        alt={`Image ${currentImageIndex + 1}`}
                        className="w-full h-full object-contain"
                      />
                    )}
                    
                    {/* Navigation Arrows */}
                    {files.length > 1 && (
                      <>
                        <button
                          onClick={prevImage}
                          disabled={currentImageIndex === 0}
                          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/90 backdrop-blur rounded-full shadow-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          onClick={nextImage}
                          disabled={currentImageIndex === files.length - 1}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/90 backdrop-blur rounded-full shadow-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </>
                    )}
                    
                    {/* Remove Button */}
                    <button
                      onClick={() => removeImage(currentImageIndex)}
                      className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Thumbnail Strip */}
                  <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {files.map((file, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`flex-shrink-0 relative rounded-lg overflow-hidden border-2 transition-all ${
                          index === currentImageIndex 
                            ? 'border-blue-500 ring-2 ring-blue-200' 
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-16 h-16 object-cover"
                        />
                        {index === currentImageIndex && (
                          <div className="absolute inset-0 bg-blue-500/20" />
                        )}
                      </button>
                    ))}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-600">
                      <span className="font-medium">{files.length}</span> images selected
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                      >
                        Add More
                      </button>
                      <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                      <button
                        onClick={confirmImageSelection}
                        disabled={files.length === 0}
                        className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Continue to Analysis
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Root Album View */}
          {clusters && !selectedFolderId && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-400">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold">Albums</h2>
                <p className="text-xs text-slate-400 font-medium">Select a cluster to view individual assets.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                {clusters.map((cluster) => (
                  <button 
                    key={cluster.cluster_id}
                    onClick={() => setSelectedFolderId(cluster.cluster_id)}
                    className="group flex flex-col items-center p-6 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-all"
                  >
                    <div className="relative mb-4">
                      <Folder className="w-12 h-12 text-slate-200 group-hover:text-slate-300 fill-slate-50 transition-colors" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-slate-500 mt-1">{cluster.images.length}</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-700 text-center truncate w-full">
                      {cluster.cluster_name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Deep Album View */}
          {clusters && selectedFolderId && currentFolder && (
            <div className="space-y-8 animate-in fade-in slide-in-from-left-2 duration-400">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setSelectedFolderId(null)}
                    className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 text-slate-600" />
                  </button>
                  <div>
                    <h2 className="text-lg font-bold">{currentFolder.cluster_name}</h2>
                    <p className="text-xs text-slate-400 font-medium">Root / {currentFolder.cluster_name}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {currentFolder.images.map((img) => (
                  <div key={img.id} className="space-y-3 group">
                    <div className="aspect-square bg-slate-50 rounded border border-slate-100 overflow-hidden relative shadow-sm group-hover:shadow transition-shadow">
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur px-1.5 py-0.5 rounded text-[8px] font-bold border border-slate-200">
                        {img.id}
                      </div>
                      {img.confidence && (
                        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-full border border-slate-200">
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${
                              img.confidence >= 80 ? 'bg-emerald-500' : 
                              img.confidence >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`} />
                            <span className="text-[8px] font-bold text-slate-700">
                              {img.confidence}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-2 items-start">
                        <Info className="w-3 h-3 text-slate-300 shrink-0 mt-1" />
                        <p className="text-[11px] leading-relaxed text-slate-500 italic">
                          {img.caption}
                        </p>
                      </div>
                      {img.confidence && (
                        <div className="flex items-center gap-2 pl-5">
                          <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${
                                img.confidence >= 80 ? 'bg-emerald-500' : 
                                img.confidence >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${img.confidence}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-medium ${
                            img.confidence >= 80 ? 'text-emerald-600' : 
                            img.confidence >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {img.confidence >= 80 ? 'High' : 
                             img.confidence >= 60 ? 'Medium' : 'Low'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}