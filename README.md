# Barricade Service

A comprehensive security and access control service system built with Python. Barricade Service provides automated vehicle and license plate recognition capabilities for security applications.

## Overview

Barricade Service is a modular system designed for security and access control applications. It integrates multiple services to provide automated vehicle detection, tracking, and license plate recognition.

## Components

### ANPR Service

The Automatic Number Plate Recognition (ANPR) service is the core component of Barricade Service. It provides:

- Vehicle detection and tracking
- License plate detection and recognition
- Image and video processing
- Live camera feed processing

For detailed documentation, see [anpr_service/README.md](anpr_service/README.md).

## Installation

### Requirements

- Python >= 3.12
- CUDA-capable GPU (optional, for faster processing)

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd barricade-service
```

2. Install dependencies using `uv` (recommended):
```bash
uv sync
```

Or install using pip:
```bash
pip install -e .
```

## Quick Start

### Using the ANPR Service

```python
from anpr_service import ANPRService, ANPRConfig

# Initialize service
service = ANPRService()

# Process an image
processed_frame, results = service.process_image('image.jpg')

# Print results
for result in results:
    if result.license_plate_text:
        print(result.license_plate_text)
```

### Running the Main Application

```bash
python main.py
```

This will process `img4.jpg` and display the detection results.

## Project Structure

```
barricade-service/
├── anpr_service/           # ANPR service module
│   ├── README.md           # ANPR service documentation
│   ├── __init__.py
│   ├── anpr_service.py     # Main ANPR service class
│   ├── utility.py          # Utility functions
│   ├── sort/               # SORT tracking implementation
│   └── examples/           # Usage examples
├── main.py                 # Main application entry point
├── pyproject.toml          # Project configuration
└── README.md               # This file
```

## Dependencies

See `pyproject.toml` for the complete list of dependencies. Key dependencies include:

- **ultralytics**: YOLO model inference
- **easyocr**: Optical Character Recognition
- **opencv-python**: Image and video processing
- **filterpy**: Kalman filtering for tracking
- **numpy**: Numerical operations
- **scipy**: Scientific computing

## Usage

### Basic Image Processing

```python
from anpr_service import ANPRService

service = ANPRService()
processed_frame, results = service.process_image('image.jpg')
```

### Video Processing

```python
from anpr_service import ANPRService

service = ANPRService()
all_results = service.process_video('video.mp4', output_path='output.mp4')
```

### Camera Feed

```python
from anpr_service import ANPRService

service = ANPRService()
service.process_camera(camera_index=0)  # Press 'q' to quit
```

For more detailed usage examples and API documentation, see [anpr_service/README.md](anpr_service/README.md).

## Development

### Running Tests

```bash
python main.py
```

### Project Architecture

Barricade Service follows a modular architecture:

- **Service Modules**: Independent, reusable service components
- **Main Application**: Entry point that orchestrates services
- **Configuration**: Centralized configuration management

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Add your license here]

## Acknowledgments

- [Ultralytics YOLOv8](https://github.com/ultralytics/ultralytics)
- [SORT](https://github.com/abewley/sort)
- [EasyOCR](https://github.com/JaidedAI/EasyOCR)
