
import React, { useState, useId } from 'react';
import { createRoot } from 'react-dom/client';

const API_BASE_URL = 'http://192.168.1.61:5000';

// Interfaces Prediction and ImageFileState are TypeScript-specific and removed for JS.
// Their structure is implied by usage.

const App = () => {
    const [selectedImages, setSelectedImages] = useState([]);
    const [targetLabelsInput, setTargetLabelsInput] = useState('');

    const [newLabelsInput, setNewLabelsInput] = useState('');
    const [updateMessage, setUpdateMessage] = useState(null);

    const [isMatchingImages, setIsMatchingImages] = useState(false);
    const [isUpdatingDB, setIsUpdatingDB] = useState(false);
    const [uiErrorMessage, setUiErrorMessage] = useState(null);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const fileInputId = useId();
    const targetLabelsId = useId();
    const newLabelsId = useId();

    const handleFilesSelected = (files) => {
        setUiErrorMessage(null);
        if (files) {
            const newImageFiles = Array.from(files).map(file => ({
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

    const handleFileInputChange = (event) => {
        handleFilesSelected(event.target.files);
        // Reset file input to allow selecting the same file again if needed
        event.target.value = '';
    };

    const handleTargetLabelsChange = (event) => {
        setTargetLabelsInput(event.target.value);
    };

    const handleNewLabelsChange = (event) => {
        setNewLabelsInput(event.target.value);
    };

    const handleDragEnter = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDraggingOver(true);
    };

    const handleDragLeave = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDraggingOver(false);
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation(); // Necessary to allow drop
    };

    const handleDrop = (event) => {
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

    const handleRemoveImage = (idToRemove) => {
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
        const imagesToProcessThisRun = selectedImages.map((img) => ({
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
                const data = await response.json(); // Assuming data is { predictions: Prediction[] }
                return { id: imageFile.id, success: true, predictions: data.predictions };
            } catch (error) {
                return { id: imageFile.id, success: false, error: error.message || 'Matching failed for this image' };
            }
        });

        const results = await Promise.all(matchingPromises);

        setSelectedImages(prevImages =>
            prevImages.map(currentImage => {
                const result = results.find(r => r.id === currentImage.id);
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

    const handleUpdateLabels = async (event) => {
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
        } catch (error) {
            setUpdateMessage({ type: 'error', text: error.message || 'An unknown error occurred while updating labels.' });
        } finally {
            setIsUpdatingDB(false);
        }
    };

    return (
        React.createElement("div", { className: "container" },
            React.createElement("h1", null, "Target Label Image Matcher"),
            React.createElement("div", { className: "controls-area" },
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: targetLabelsId }, "Target Labels (comma-separated):"),
                    React.createElement("input", {
                        type: "text",
                        id: targetLabelsId,
                        value: targetLabelsInput,
                        onChange: handleTargetLabelsChange,
                        placeholder: "e.g., cat, dog, car",
                        disabled: isMatchingImages,
                        "aria-required": "true"
                    })
                ),
                React.createElement("div", {
                    className: `drop-zone ${isDraggingOver ? 'drag-over' : ''}`,
                    onDragEnter: handleDragEnter,
                    onDragLeave: handleDragLeave,
                    onDragOver: handleDragOver,
                    onDrop: handleDrop,
                    onClick: triggerFileInput,
                    role: "button",
                    tabIndex: 0,
                    "aria-label": "Drag and drop images here or click to select"
                },
                    React.createElement("span", { className: "material-icons-outlined drop-zone-icon", "aria-hidden": "true" }, "upload_file"),
                    React.createElement("p", null, "Drag & drop your images here"),
                    React.createElement("p", { className: "drop-zone-or-text" }, "or"),
                    React.createElement("span", { className: "drop-zone-click-text" }, "Click to select files"),
                    React.createElement("input", {
                        type: "file",
                        id: fileInputId,
                        accept: "image/*",
                        multiple: true,
                        onChange: handleFileInputChange,
                        disabled: isMatchingImages,
                        style: { display: 'none' }
                    })
                ),
                React.createElement("button", {
                    type: "button",
                    onClick: handleMatchImagesToTargets,
                    disabled: isMatchingImages || selectedImages.length === 0 || !targetLabelsInput.trim(),
                    className: "action-button match-button"
                },
                    React.createElement("span", { className: "material-icons-outlined", "aria-hidden": "true" }, "flaky"),
                    isMatchingImages ? 'Matching Images...' : 'Match Images to Target Labels'
                ),
                uiErrorMessage && React.createElement("p", { className: "message error global-message", role: "alert" }, uiErrorMessage)
            ),
            isMatchingImages && selectedImages.some(img => img.isLoading) && (
                React.createElement("div", { className: "loading-indicator global-loading", "aria-live": "polite" },
                    React.createElement("div", { className: "spinner" }),
                    "Processing images..."
                )
            ),
            selectedImages.length > 0 && (
                React.createElement("div", { className: "image-cards-container" },
                    selectedImages.map(imageFile => (
                        React.createElement("div", { key: imageFile.id, className: `image-card status-${imageFile.matchStatus}` },
                            React.createElement("div", { className: `card-status-badge status-${imageFile.matchStatus}` },
                                imageFile.matchStatus.toUpperCase().replace('-', ' ')
                            ),
                            React.createElement("button", {
                                className: "card-remove-button",
                                onClick: () => handleRemoveImage(imageFile.id),
                                "aria-label": `Remove ${imageFile.file.name}`,
                                title: "Remove image"
                            },
                                React.createElement("span", { className: "material-icons-outlined" }, "close")
                            ),
                            React.createElement("img", { src: imageFile.previewUrl, alt: `Preview of ${imageFile.file.name}`, className: "card-image-preview" }),
                            React.createElement("div", { className: "card-info" },
                                imageFile.isLoading && (
                                    React.createElement("div", { className: "card-loader", "aria-live": "polite" },
                                        React.createElement("div", { className: "spinner small-spinner" }), " Matching..."
                                    )
                                ),
                                imageFile.matchError && (
                                    React.createElement("p", { className: "card-error message error small-message", role: "alert" }, "Error: ", imageFile.matchError)
                                ),
                                imageFile.topPrediction && !imageFile.isLoading && (
                                    React.createElement("div", { className: "card-prediction" },
                                        React.createElement("p", null, "Prediction: ", React.createElement("strong", null, imageFile.topPrediction.label)),
                                        React.createElement("p", null, "Score: ", imageFile.topPrediction.score.toFixed(3))
                                    )
                                )
                            )
                        )
                    ))
                )
            ),
            selectedImages.length === 0 && !isMatchingImages && (
                React.createElement("p", { className: "empty-state-message" }, "Upload images to see them here and match them against your target labels.")
            ),
            React.createElement("div", { className: "manage-labels-section" },
                React.createElement("h2", { className: "manage-labels-heading" }, "Manage Database Labels"),
                React.createElement("form", { onSubmit: handleUpdateLabels, className: "manage-labels-form" },
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: newLabelsId }, "New Labels to Add (comma-separated):"),
                        React.createElement("input", {
                            type: "text",
                            id: newLabelsId,
                            value: newLabelsInput,
                            onChange: handleNewLabelsChange,
                            placeholder: "e.g., flower, tree, building",
                            disabled: isUpdatingDB
                        })
                    ),
                    React.createElement("button", { type: "submit", disabled: isUpdatingDB || !newLabelsInput.trim(), className: "action-button" },
                        React.createElement("span", { className: "material-icons-outlined", "aria-hidden": "true" }, "add_circle_outline"),
                        isUpdatingDB ? 'Updating...' : 'Update Database Labels'
                    )
                ),
                updateMessage && (
                    React.createElement("p", { className: `message ${updateMessage.type}`, role: "alert" },
                        updateMessage.text
                    )
                )
            ),
            React.createElement("p", { className: "sr-only", "aria-live": "assertive" }, isMatchingImages || isUpdatingDB ? "Operation in progress." : "Ready.")
        )
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(React.createElement(React.StrictMode, null, React.createElement(App, null)));
} else {
    console.error('Failed to find the root element');
}

// export {}; // Not needed in JS
