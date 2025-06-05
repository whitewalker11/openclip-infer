
import React, { useState, ChangeEvent, FormEvent, useId, DragEvent } from 'react';
import { createRoot } from 'react-dom/client';

const API_BASE_URL = 'http://localhost:5000';

interface Prediction {
    label: string;
    score: number;
    rank: number;
}

interface ImageFileState {
    id: string;
    file: File;
    previewUrl: string;
    isLoading: boolean;
    apiPredictions: Prediction[] | null;
    topPrediction: Prediction | null;
    matchStatus: 'pending' | 'match' | 'no-match' | 'error' | 'no-prediction';
    matchError: string | null;
}

const App: React.FC = () => {
    const [selectedImages, setSelectedImages] = useState<ImageFileState[]>([]);
    const [targetLabelsInput, setTargetLabelsInput] = useState<string>('');
    
    const [newLabelsInput, setNewLabelsInput] = useState<string>('');
    const [updateMessage, setUpdateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    
    const [isMatchingImages, setIsMatchingImages] = useState<boolean>(false);
    const [isUpdatingDB, setIsUpdatingDB] = useState<boolean>(false);
    const [uiErrorMessage, setUiErrorMessage] = useState<string | null>(null);
    const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

    const fileInputId = useId();
    const targetLabelsId = useId();
    const newLabelsId = useId();

    const handleFilesSelected = (files: FileList | null) => {
        setUiErrorMessage(null);
        if (files) {
            const newImageFiles: ImageFileState[] = Array.from(files).map(file => ({
                id: crypto.randomUUID(),
                file,
                previewUrl: URL.createObjectURL(file),
                isLoading: false,
                apiPredictions: null,
                topPrediction: null,
                matchStatus: 'pending',
                matchError: null,
            }));
            setSelectedImages(prevImages => [...prevImages, ...newImageFiles]); // Append new files
        }
    };
    
    const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        handleFilesSelected(event.target.files);
        // Reset file input to allow selecting the same file again if needed
        event.target.value = ''; 
    };

    const handleTargetLabelsChange = (event: ChangeEvent<HTMLInputElement>) => {
        setTargetLabelsInput(event.target.value);
    };

    const handleNewLabelsChange = (event: ChangeEvent<HTMLInputElement>) => {
        setNewLabelsInput(event.target.value);
    };

    const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDraggingOver(true);
    };

    const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDraggingOver(false);
    };

    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation(); // Necessary to allow drop
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDraggingOver(false);
        const files = event.dataTransfer.files;
        if (files && files.length > 0) {
            handleFilesSelected(files);
        }
    };
    
    const triggerFileInput = () => {
        document.getElementById(fileInputId)?.click();
    };

    const handleRemoveImage = (idToRemove: string) => {
        setSelectedImages(prevImages => prevImages.filter(img => img.id !== idToRemove));
    };


    const handleMatchImagesToTargets = async () => {
        if (!targetLabelsInput.trim()) {
            setUiErrorMessage('Please enter target labels.');
            return;
        }
        if (selectedImages.length === 0) {
            setUiErrorMessage('Please select or drop images to match.');
            return;
        }

        setIsMatchingImages(true);
        setUiErrorMessage(null);

        const parsedTargetLabels = targetLabelsInput.split(',').map(label => label.trim().toLowerCase()).filter(label => label);

        // Prepare all selected images for the current matching run by resetting their state.
        const imagesToProcessThisRun = selectedImages.map((img): ImageFileState => ({ 
            ...img, 
            isLoading: true, 
            matchError: null, 
            matchStatus: 'pending',
            apiPredictions: null,
            topPrediction: null,
        }));

        // Update the state for UI to reflect loading status on all images.
        setSelectedImages(imagesToProcessThisRun);

        // Use the `imagesToProcessThisRun` array which has the correctly reset states.
        const matchingPromises = imagesToProcessThisRun.map(async (imageFile) => {
            const formData = new FormData();
            formData.append('file', imageFile.file);
            try {
                const response = await fetch(`${API_BASE_URL}/predict`, {
                    method: 'POST',
                    body: formData,
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }
                const data: { predictions: Prediction[] } = await response.json();
                return { id: imageFile.id, success: true, predictions: data.predictions };
            } catch (error: any) {
                return { id: imageFile.id, success: false, error: error.message || 'Matching failed for this image' };
            }
        });

        const results = await Promise.all(matchingPromises);

        setSelectedImages(prevImages => 
            prevImages.map(currentImage => {
                const result = results.find(r => r.id === currentImage.id);
                // If no result, it means this image wasn't processed in this batch (e.g. removed during processing), keep its state or handle appropriately.
                // For simplicity, if it's somehow not in results (shouldn't happen with current logic), keep its existing state.
                if (!result) return currentImage; 

                if (result.success) {
                    const apiPreds = result.predictions;
                    if (!apiPreds || apiPreds.length === 0) {
                        return { ...currentImage, isLoading: false, matchStatus: 'no-prediction', matchError: 'No predictions returned.' };
                    }
                    const topPred = apiPreds[0];
                    const isMatch = parsedTargetLabels.some(tl => tl === topPred.label.toLowerCase());
                    return { 
                        ...currentImage, 
                        isLoading: false, 
                        apiPredictions: apiPreds, 
                        topPrediction: topPred, 
                        matchStatus: isMatch ? 'match' : 'no-match' 
                    };
                } else {
                    return { ...currentImage, isLoading: false, matchStatus: 'error', matchError: result.error };
                }
            })
        );
        setIsMatchingImages(false);
    };

    const handleUpdateLabels = async (event: FormEvent) => {
        event.preventDefault();
        if (!newLabelsInput.trim()) {
            setUpdateMessage({ type: 'error', text: 'Please enter labels to add.' });
            return;
        }

        setIsUpdatingDB(true);
        setUpdateMessage(null);
        setUiErrorMessage(null);

        const labelsToAdd = newLabelsInput.split(',').map(label => label.trim()).filter(label => label);

        try {
            const response = await fetch(`${API_BASE_URL}/update_labels`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ labels: labelsToAdd }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }
            
            setUpdateMessage({ type: 'success', text: data.message || 'Labels updated successfully!' });
            setNewLabelsInput(''); 
        } catch (error: any) {
            setUpdateMessage({ type: 'error', text: error.message || 'An unknown error occurred while updating labels.' });
        } finally {
            setIsUpdatingDB(false);
        }
    };

    return (
        <div className="container">
            <h1>Target Label Image Matcher</h1>

            <div className="controls-area">
                <div className="form-group">
                    <label htmlFor={targetLabelsId}>Target Labels (comma-separated):</label>
                    <input 
                        type="text" 
                        id={targetLabelsId}
                        value={targetLabelsInput} 
                        onChange={handleTargetLabelsChange} 
                        placeholder="e.g., cat, dog, car"
                        disabled={isMatchingImages}
                        aria-required="true"
                    />
                </div>

                <div 
                    className={`drop-zone ${isDraggingOver ? 'drag-over' : ''}`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={triggerFileInput}
                    role="button"
                    tabIndex={0}
                    aria-label="Drag and drop images here or click to select"
                >
                    <span className="material-icons-outlined drop-zone-icon" aria-hidden="true">upload_file</span>
                    <p>Drag &amp; drop your images here</p>
                    <p className="drop-zone-or-text">or</p>
                    <span className="drop-zone-click-text">Click to select files</span>
                    <input 
                        type="file" 
                        id={fileInputId} 
                        accept="image/*" 
                        multiple
                        onChange={handleFileInputChange} 
                        disabled={isMatchingImages}
                        style={{ display: 'none' }} 
                    />
                </div>
                
                <button 
                    type="button" 
                    onClick={handleMatchImagesToTargets} 
                    disabled={isMatchingImages || selectedImages.length === 0 || !targetLabelsInput.trim()}
                    className="action-button match-button"
                >
                    <span className="material-icons-outlined" aria-hidden="true">flaky</span>
                    {isMatchingImages ? 'Matching Images...' : 'Match Images to Target Labels'}
                </button>

                {uiErrorMessage && <p className="message error global-message" role="alert">{uiErrorMessage}</p>}
            </div>
            
            {isMatchingImages && selectedImages.some(img => img.isLoading) && (
                <div className="loading-indicator global-loading" aria-live="polite">
                    <div className="spinner"></div>
                    Processing images...
                </div>
            )}

            {selectedImages.length > 0 && (
                <div className="image-cards-container">
                    {selectedImages.map(imageFile => (
                        <div key={imageFile.id} className={`image-card status-${imageFile.matchStatus}`}>
                            <div className={`card-status-badge status-${imageFile.matchStatus}`}>
                                {imageFile.matchStatus.toUpperCase().replace('-', ' ')}
                            </div>
                            <button 
                                className="card-remove-button" 
                                onClick={() => handleRemoveImage(imageFile.id)}
                                aria-label={`Remove ${imageFile.file.name}`}
                                title="Remove image"
                            >
                                <span className="material-icons-outlined">close</span>
                            </button>
                            <img src={imageFile.previewUrl} alt={`Preview of ${imageFile.file.name}`} className="card-image-preview" />
                            <div className="card-info">
                                {/* Filename removed from here */}
                                {imageFile.isLoading && (
                                    <div className="card-loader" aria-live="polite">
                                        <div className="spinner small-spinner"></div> Matching...
                                    </div>
                                )}
                                {imageFile.matchError && (
                                    <p className="card-error message error small-message" role="alert">Error: {imageFile.matchError}</p>
                                )}
                                {imageFile.topPrediction && !imageFile.isLoading && (
                                    <div className="card-prediction">
                                        <p>Prediction: <strong>{imageFile.topPrediction.label}</strong></p>
                                        <p>Score: {imageFile.topPrediction.score.toFixed(3)}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
             {selectedImages.length === 0 && !isMatchingImages && (
                <p className="empty-state-message">Upload images to see them here and match them against your target labels.</p>
            )}


            <div className="manage-labels-section">
                <h2 className="manage-labels-heading">Manage Database Labels</h2>
                <form onSubmit={handleUpdateLabels} className="manage-labels-form">
                    <div className="form-group">
                        <label htmlFor={newLabelsId}>New Labels to Add (comma-separated):</label>
                        <input 
                            type="text" 
                            id={newLabelsId}
                            value={newLabelsInput} 
                            onChange={handleNewLabelsChange} 
                            placeholder="e.g., flower, tree, building"
                            disabled={isUpdatingDB}
                        />
                    </div>
                    <button type="submit" disabled={isUpdatingDB || !newLabelsInput.trim()} className="action-button">
                        <span className="material-icons-outlined" aria-hidden="true">add_circle_outline</span>
                        {isUpdatingDB ? 'Updating...' : 'Update Database Labels'}
                    </button>
                </form>
                {updateMessage && (
                    <p className={`message ${updateMessage.type}`} role="alert">
                        {updateMessage.text}
                    </p>
                )}
            </div>
            <p className="sr-only" aria-live="assertive">{isMatchingImages || isUpdatingDB ? "Operation in progress." : "Ready."}</p>
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<React.StrictMode><App /></React.StrictMode>);
} else {
    console.error('Failed to find the root element');
}

export {};
