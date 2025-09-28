import {
    Input,
    ALL_FORMATS,
    BlobSource,
    UrlSource,
    Output,
    BufferTarget,
    Mp4OutputFormat,
    Conversion,
    QUALITY_VERY_LOW,
} from 'mediabunny';

// DOM Elements
const selectMediaButton = document.querySelector('#select-file') as HTMLButtonElement;
const loadUrlButton = document.querySelector('#load-url') as HTMLButtonElement;
const fileNameElement = document.querySelector('#file-name') as HTMLParagraphElement;
const horizontalRule = document.querySelector('hr') as HTMLHRElement;
const progressBarContainer = document.querySelector('#progress-bar-container') as HTMLDivElement;
const progressBar = document.querySelector('#progress-bar') as HTMLDivElement;
const speedometer = document.querySelector('#speedometer') as HTMLParagraphElement;
const videoElement = document.querySelector('video') as HTMLVideoElement;
const compressionFacts = document.querySelector('#compression-facts') as HTMLParagraphElement;
const errorElement = document.querySelector('#error-element') as HTMLDivElement;
const errorMessage = document.querySelector('#error-message') as HTMLParagraphElement;

// New elements for enhanced features
const fileInfoSection = document.querySelector('#file-info-section') as HTMLDivElement;
const originalSizeElement = document.querySelector('#original-size') as HTMLSpanElement;
const fileDurationElement = document.querySelector('#file-duration') as HTMLSpanElement;
const fileResolutionElement = document.querySelector('#file-resolution') as HTMLSpanElement;
const progressContainer = document.querySelector('#progress-container') as HTMLDivElement;
const progressPercentage = document.querySelector('#progress-percentage') as HTMLSpanElement;
const etaElement = document.querySelector('#eta') as HTMLSpanElement;
const successInfo = document.querySelector('#success-info') as HTMLDivElement;
const originalFileSizeElement = document.querySelector('#original-file-size') as HTMLDivElement;
const compressedFileSizeElement = document.querySelector('#compressed-file-size') as HTMLDivElement;
const spaceSavedElement = document.querySelector('#space-saved') as HTMLSpanElement;
const downloadBtn = document.querySelector('#download-btn') as HTMLButtonElement;
const dropZone = document.querySelector('#drop-zone') as HTMLDivElement;

// Quality presets
const qualityPresets = document.querySelectorAll('.preset-btn') as NodeListOf<HTMLButtonElement>;
let currentPreset = 'medium';

// Global variables
let currentConversion: Conversion | null = null;
let currentIntervalId = -1;
let currentVideoBlob: Blob | null = null;
let originalFileSize = 0;

// Quality preset configurations
const presetConfigs = {
    low: { targetSize: 3, videoBitrateFactor: 0.7, audioBitrate: 32 },
    medium: { targetSize: 7.2, videoBitrateFactor: 0.9, audioBitrate: 64 },
    high: { targetSize: 8, videoBitrateFactor: 1.0, audioBitrate: 128 }
};

// Utility functions
const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Initialize preset buttons
qualityPresets.forEach(btn => {
    btn.addEventListener('click', () => {
        qualityPresets.forEach(b => b.classList.remove('active', 'ring-2', 'ring-blue-500'));
        btn.classList.add('active', 'ring-2', 'ring-blue-500');
        currentPreset = btn.dataset.preset!;
    });
});

// Set default preset
document.querySelector('[data-preset="medium"]')?.classList.add('ring-2', 'ring-blue-500');

const compressFile = async (resource: File | string) => {
    clearInterval(currentIntervalId);
    await currentConversion?.cancel();

    // Reset UI state
    fileNameElement.textContent = resource instanceof File ? resource.name : resource;
    fileInfoSection.style.display = 'block';
    horizontalRule.style.display = 'block';
    progressContainer.style.display = 'none';
    videoElement.style.display = 'none';
    videoElement.src = '';
    errorElement.style.display = 'none';
    successInfo.style.display = 'none';
    errorMessage.textContent = '';

    try {
        // Create input source
        const source = resource instanceof File
            ? new BlobSource(resource)
            : new UrlSource(resource);
        const input = new Input({
            source,
            formats: ALL_FORMATS,
        });

        // Get file information
        originalFileSize = await source.getSize();
        const fileSizeInMB = originalFileSize / (1024 * 1024);

        const videoTrack = await input.getPrimaryVideoTrack();
        const videoDuration = await videoTrack?.computeDuration();
        const videoStats = await videoTrack?.computePacketStats();

        // Update file info display
        originalSizeElement.textContent = `📊 Size: ${formatFileSize(originalFileSize)}`;
        fileDurationElement.textContent = videoDuration ? `⏱️ Duration: ${formatDuration(videoDuration)}` : '⏱️ Duration: -';

        // Try to get video resolution
        try {
            // VideoTrack might not have direct resolution access, so we'll handle it gracefully
            fileResolutionElement.textContent = '📐 Resolution: Processing...';
            const width = videoStats?.width || 0;
            const height = videoStats?.height || 0;
            if (width && height) {
                fileResolutionElement.textContent = `📐 Resolution: ${width}x${height}`
            } else {
                fileResolutionElement.textContent = '📐 Resolution: Unknown';
            }
        } catch (e) {
            fileResolutionElement.textContent = '📐 Resolution: Unknown';
        }

        // Show supported file type validation
        const fileName = resource instanceof File ? resource.name : resource;
        const supportedExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.wmv', '.flv', '.m4v'];
        const isSupported = supportedExtensions.some(ext => fileName.toLowerCase().endsWith(ext));

        if (!isSupported) {
            throw new Error(`Unsupported file format. Please use: ${supportedExtensions.join(', ')}`);
        }

        // Define output
        const output = new Output({
            target: new BufferTarget(),
            format: new Mp4OutputFormat(),
        });

        const duration = await input.computeDuration();
        const config = presetConfigs[currentPreset as keyof typeof presetConfigs];

        // Calculate bitrates based on preset
        const maxSizeInBits = config.targetSize * 1024 * 1024 * 8;
        const targetSizeInBits = maxSizeInBits * 0.9; // 90% safety margin
        const audioBitrate = config.audioBitrate * 1000;
        const totalAudioBits = audioBitrate * duration;
        const availableVideoBits = targetSizeInBits - totalAudioBits;
        const videoBitrate = Math.max(100000, Math.round((availableVideoBits / duration) * config.videoBitrateFactor));

        console.log(`Duration: ${duration}s`);
        console.log(`Preset: ${currentPreset}`);
        console.log(`Target size: ${config.targetSize.toFixed(1)}MB`);
        console.log(`Audio bitrate: ${config.audioBitrate}kbps`);
        console.log(`Video bitrate: ${(videoBitrate / 1000).toFixed(0)}kbps`);

        // Show progress
        progressContainer.style.display = 'block';

        // Initialize conversion
        currentConversion = await Conversion.init({
            input,
            output,
            video: {
                width: 1280,
                bitrate: videoBitrate,
                frameRate: 24
            },
            audio: {
                bitrate: audioBitrate,
            },
        });

        // Track progress
        let progress = 0;
        const startTime = performance.now();

        currentConversion.onProgress = newProgress => {
            progress = newProgress;
        };

        const updateProgress = () => {
            const progressPercent = Math.round(progress * 100);
            progressBar.style.width = `${progressPercent}%`;
            progressPercentage.textContent = `${progressPercent}%`;

            const now = performance.now();
            const elapsedSeconds = (now - startTime) / 1000;

            if (progress > 0) {
                const factor = duration / (elapsedSeconds / progress);
                speedometer.textContent = `Speed: ~${factor.toPrecision(3)}x realtime`;

                const remainingSeconds = (elapsedSeconds / progress) * (1 - progress);
                etaElement.textContent = `ETA: ${Math.max(0, Math.round(remainingSeconds))}s`;
            } else {
                speedometer.textContent = 'Speed: -';
                etaElement.textContent = 'ETA: -';
            }
        };

        currentIntervalId = window.setInterval(updateProgress, 1000 / 30);

        // Execute conversion
        await currentConversion.execute();

        clearInterval(currentIntervalId);
        updateProgress();

        // Create result blob
        currentVideoBlob = new Blob([output.target.buffer!], { type: output.format.mimeType });

        // Display result
        progressContainer.style.display = 'none';
        videoElement.style.display = 'block';
        videoElement.src = URL.createObjectURL(currentVideoBlob);
        successInfo.style.display = 'block';

        // Update comparison stats
        const compressedSize = currentVideoBlob.size;
        const compressionRatio = (compressedSize / originalFileSize) * 100;
        const spaceSaved = originalFileSize - compressedSize;

        originalFileSizeElement.textContent = formatFileSize(originalFileSize);
        compressedFileSizeElement.textContent = formatFileSize(compressedSize);
        compressionFacts.textContent = `${compressionRatio.toFixed(1)}% of original size`;
        spaceSavedElement.textContent = formatFileSize(spaceSaved);

        void videoElement.play();

    } catch (error) {
        console.error(error);
        await currentConversion?.cancel();
        clearInterval(currentIntervalId);

        errorMessage.textContent = String(error);
        errorElement.style.display = 'block';
        progressContainer.style.display = 'none';
        successInfo.style.display = 'none';
        videoElement.style.display = 'none';
    }
};

// Download functionality
downloadBtn.addEventListener('click', () => {
    if (!currentVideoBlob) return;

    const url = URL.createObjectURL(currentVideoBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compressed_video_${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Enhanced drag and drop
let dragCounter = 0;

dropZone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dropZone.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
        dropZone.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
    }
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    dropZone.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');

    const files = e.dataTransfer?.files;
    const file = files && files.length > 0 ? files[0] : undefined;
    if (file) {
        void compressFile(file);
    }
});

/** === FILE SELECTION LOGIC === */

selectMediaButton.addEventListener('click', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'video/*,video/x-matroska,audio/*,audio/aac';
    fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file) {
            return;
        }

        void compressFile(file);
    });

    fileInput.click();
});

loadUrlButton.addEventListener('click', () => {
    const url = prompt(
        'Please enter a URL of a media file. Note that it must be HTTPS and support cross-origin requests, so have the'
        + ' right CORS headers set.',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    );
    if (!url) {
        return;
    }

    void compressFile(url);
});