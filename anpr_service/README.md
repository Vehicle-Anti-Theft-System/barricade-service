# ANPR Service

An Automatic Number Plate Recognition (ANPR) service module for detecting vehicles, tracking them across frames, and extracting license plate information from images and video streams.

## Overview

The ANPR Service is a professional, modular Python service that provides:
- Vehicle detection using YOLOv8
- Multi-object tracking using SORT algorithm
- License plate detection using custom YOLO models
- OCR text extraction using EasyOCR
- License plate text formatting and validation

## Features

- 🚗 **Vehicle Detection**: Detects cars, motorcycles, buses, and trucks using YOLOv8
- 📋 **License Plate Detection**: Identifies license plates using a custom YOLO model
- 🔄 **Vehicle Tracking**: Tracks vehicles across video frames using SORT (Simple Online and Realtime Tracking)
- 🔤 **OCR Recognition**: Extracts license plate text using EasyOCR
- 📝 **Format Validation**: Validates and formats license plate text according to standard formats (9 or 10 characters)
- 🎥 **Multiple Input Sources**: Supports images, videos, and live camera feeds
- 🎯 **Single Frame Processing**: Process individual camera frames on demand

## Installation

The ANPR service is part of the barricade-service project. Install dependencies:

```bash
# Using uv (recommended)
uv sync

# Or using pip
pip install -e .
```

## Quick Start

### Basic Usage

```python
from anpr_service import ANPRService, ANPRConfig

# Initialize service with default configuration
service = ANPRService()

# Process an image
processed_frame, results = service.process_image('image.jpg')

# Print detected license plates
for result in results:
    if result.license_plate_text and result.license_plate_text != "Couldn't Decode":
        print(f"Vehicle {result.vehicle_id}: {result.license_plate_text}")
```

### Process Video

```python
from anpr_service import ANPRService, ANPRConfig

config = ANPRConfig(
    save_output=True,
    display_output=True
)

service = ANPRService(config)
all_results = service.process_video('video.mp4', output_path='output.mp4')

# all_results is a list of lists - one per frame
for frame_num, frame_results in enumerate(all_results):
    for result in frame_results:
        if result.license_plate_text:
            print(f"Frame {frame_num}: {result.license_plate_text}")
```

### Process Live Camera

```python
from anpr_service import ANPRService

service = ANPRService()
service.process_camera(camera_index=0)  # Press 'q' to quit
```

### Process Single Camera Frame

```python
from anpr_service import ANPRService

service = ANPRService()

try:
    # Process frames one at a time
    while True:
        processed_frame, results, success = service.capture_and_process_frame()
        
        if not success:
            break
        
        # Process results
        for result in results:
            if result.license_plate_text and result.license_plate_text != "Couldn't Decode":
                print(f"Vehicle {result.vehicle_id}: {result.license_plate_text}")

finally:
    # Always release camera when done
    service.release_camera()
```

## API Reference

### ANPRService

Main service class for ANPR operations.

#### Methods

- `process_image(image_path, output_path=None)` - Process a single image file
- `process_video(video_path, output_path=None, max_frames=None)` - Process a video file
- `process_camera(camera_index=0)` - Process live camera feed
- `capture_and_process_frame(camera_index=0, camera=None)` - Capture and process a single camera frame
- `process_frame(frame, draw_detections=True)` - Process a single frame (numpy array)
- `detect_vehicles(frame)` - Detect vehicles in a frame
- `detect_license_plates(frame)` - Detect license plates in a frame
- `track_vehicles(detections)` - Track vehicles across frames
- `release_camera()` - Release camera resources
- `reset_tracker()` - Reset the SORT tracker

### ANPRConfig

Configuration dataclass for service settings.

#### Parameters

- `vehicle_model_path` (str): Path to vehicle detection model (default: `'yolov8n.pt'`)
- `license_plate_model_path` (str): Path to license plate detection model (default: `'license_plate_detector.pt'`)
- `vehicle_classes` (List[int]): List of COCO class IDs to detect (default: `[2, 3, 5, 7]`)
- `display_output` (bool): Whether to display video output (default: `True`)
- `save_output` (bool): Whether to save output files (default: `True`)
- `output_resolution` (Tuple[int, int]): Output video resolution (default: `(1280, 720)`)
- `ocr_gpu` (bool): Use GPU for OCR processing (default: `False`)
- `ocr_languages` (List[str]): OCR languages (default: `['en']`)

### DetectionResult

Dataclass for storing detection results.

#### Attributes

- `vehicle_id` (int): Tracked vehicle ID (-1 if not matched)
- `vehicle_bbox` (Tuple[float, float, float, float]): Vehicle bounding box coordinates
- `license_plate_text` (Optional[str]): Extracted license plate text
- `license_plate_bbox` (Optional[Tuple[float, float, float, float]]): License plate bounding box
- `confidence` (float): Detection confidence score

## Configuration Examples

### Custom Model Paths

```python
config = ANPRConfig(
    vehicle_model_path='custom_vehicle_model.pt',
    license_plate_model_path='custom_license_model.pt'
)
service = ANPRService(config)
```

### GPU Acceleration

```python
config = ANPRConfig(
    ocr_gpu=True  # Use GPU for OCR (if available)
)
service = ANPRService(config)
```

### Custom Vehicle Classes

```python
config = ANPRConfig(
    vehicle_classes=[2, 3, 5, 7]  # Car, Motorcycle, Bus, Truck
)
service = ANPRService(config)
```

### Multiple Languages

```python
config = ANPRConfig(
    ocr_languages=['en', 'es']  # English and Spanish
)
service = ANPRService(config)
```

## How It Works

1. **Vehicle Detection**: Uses YOLOv8 to detect vehicles (cars, motorcycles, buses) in each frame
2. **Vehicle Tracking**: SORT algorithm tracks vehicles across frames and assigns unique IDs
3. **License Plate Detection**: Custom YOLO model detects license plates in the frame
4. **Plate-Vehicle Matching**: Associates detected license plates with tracked vehicles
5. **OCR Processing**: EasyOCR extracts text from cropped license plate images
6. **Text Formatting**: Validates and formats license plate text according to standard formats

## License Plate Format

The system supports license plates with:
- **9 characters**: Format `XX##X####` (2 letters, 2 numbers, 1 letter, 4 numbers)
- **10 characters**: Format `XX##XX####` (2 letters, 2 numbers, 2 letters, 4 numbers)

The system includes character correction mappings to handle common OCR errors (e.g., 'O' → '0', 'I' → '1').

## Model Files

The following model files are required in the `anpr_service/` directory:
- `yolov8n.pt`: Pre-trained YOLOv8 nano model for vehicle detection
- `license_plate_detector.pt`: Custom trained YOLO model for license plate detection

## Dependencies

- **easyocr** (>=1.7.2): Optical Character Recognition
- **filterpy** (>=1.4.5): Kalman filtering for tracking
- **numpy** (>=2.4.2): Numerical operations
- **opencv-python** (>=4.13.0.92): Image and video processing
- **pandas** (>=3.0.0): Data manipulation
- **scikit-image** (>=0.26.0): Image processing utilities
- **scipy** (>=1.11.0): Scientific computing (for SORT algorithm)
- **ultralytics** (>=8.4.14): YOLO model inference

## Project Structure

```
anpr_service/
├── __init__.py              # Package initialization
├── anpr_service.py          # Main ANPR service class
├── ANPR.py                  # Legacy script (deprecated)
├── utility.py               # Utility functions for OCR and vehicle matching
├── license_plate_detector.pt  # YOLO model for license plate detection
├── yolov8n.pt               # YOLO model for vehicle detection
├── sort/                     # SORT tracking implementation
│   └── sort.py              # SORT algorithm implementation
└── examples/                 # Example usage scripts
    ├── example_usage.py
    └── camera_frame_example.py
```

## Examples

See the `examples/` directory for complete usage examples:
- `example_usage.py`: Basic usage examples
- `camera_frame_example.py`: Camera frame processing examples

## Error Handling

The service includes comprehensive error handling:
- FileNotFoundError: When model files or input files are not found
- RuntimeError: When models fail to load or camera cannot be opened
- ValueError: When images cannot be read

Always wrap service calls in try-except blocks for production use.

## Performance Tips

1. **GPU Acceleration**: Enable `ocr_gpu=True` if you have a CUDA-capable GPU
2. **Frame Skipping**: For videos, use `max_frames` parameter to limit processing
3. **Resolution**: Lower `output_resolution` for faster processing
4. **Camera Management**: Use `capture_and_process_frame()` for on-demand processing instead of continuous streaming

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

Part of the barricade-service project.

## Acknowledgments

- [Ultralytics YOLOv8](https://github.com/ultralytics/ultralytics) for object detection
- [SORT](https://github.com/abewley/sort) for multi-object tracking
- [EasyOCR](https://github.com/JaidedAI/EasyOCR) for optical character recognition
