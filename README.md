# Barricade Service

An Automatic Number Plate Recognition (ANPR) system built with Python that detects vehicles, tracks them across frames, and extracts license plate information from images and video streams.

## Features

- 🚗 **Vehicle Detection**: Detects cars, motorcycles, and buses using YOLOv8
- 📋 **License Plate Detection**: Identifies license plates using a custom YOLO model
- 🔄 **Vehicle Tracking**: Tracks vehicles across video frames using SORT (Simple Online and Realtime Tracking)
- 🔤 **OCR Recognition**: Extracts license plate text using EasyOCR
- 📝 **Format Validation**: Validates and formats license plate text according to standard formats (9 or 10 characters)
- 🎥 **Video Processing**: Supports both image and video input sources

## Requirements

- Python >= 3.12
- CUDA-capable GPU (optional, for faster processing)

## Installation

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

## Project Structure

```
barricade-service/
├── anpr-service/
│   ├── ANPR.py              # Main ANPR processing logic
│   ├── utility.py           # Utility functions for OCR and vehicle matching
│   ├── license_plate_detector.pt  # YOLO model for license plate detection
│   ├── yolov8n.pt           # YOLO model for vehicle detection
│   └── sort/                # SORT tracking implementation
├── main.py                  # Entry point
├── pyproject.toml           # Project configuration and dependencies
└── README.md
```

## Usage

### Basic Usage

Run the ANPR service on an image or video:

```bash
python anpr-service/ANPR.py
```

The script will:
1. Load the input file (currently set to `img4.jpg`)
2. Detect vehicles in the frame
3. Track vehicles across frames
4. Detect and extract license plate information
5. Display results and save output image

### Configuration

To process a different file, modify the `flName` variable in `ANPR.py`:

```python
flName = 'your_image.jpg'  # or 'your_video.mp4'
```

For live camera feed, uncomment:
```python
cap = cv2.VideoCapture(0)  # Use webcam
```

## How It Works

1. **Vehicle Detection**: Uses YOLOv8 to detect vehicles (cars, motorcycles, buses) in each frame
2. **Vehicle Tracking**: SORT algorithm tracks vehicles across frames and assigns unique IDs
3. **License Plate Detection**: Custom YOLO model detects license plates in the frame
4. **Plate-Vehicle Matching**: Associates detected license plates with tracked vehicles
5. **OCR Processing**: EasyOCR extracts text from cropped license plate images
6. **Text Formatting**: Validates and formats license plate text according to standard formats

## Dependencies

- **easyocr** (>=1.7.2): Optical Character Recognition
- **filterpy** (>=1.4.5): Kalman filtering for tracking
- **numpy** (>=2.4.2): Numerical operations
- **opencv-python** (>=4.13.0.92): Image and video processing
- **pandas** (>=3.0.0): Data manipulation
- **scikit-image** (>=0.26.0): Image processing utilities
- **ultralytics** (>=8.4.14): YOLO model inference

## Model Files

The following model files are required:
- `yolov8n.pt`: Pre-trained YOLOv8 nano model for vehicle detection
- `license_plate_detector.pt`: Custom trained YOLO model for license plate detection

Ensure these files are present in the `anpr-service/` directory before running the application.

## License Plate Format

The system supports license plates with:
- **9 characters**: Format `XX##X####` (2 letters, 2 numbers, 1 letter, 4 numbers)
- **10 characters**: Format `XX##XX####` (2 letters, 2 numbers, 2 letters, 4 numbers)

The system includes character correction mappings to handle common OCR errors (e.g., 'O' → '0', 'I' → '1').

## Output

The processed frame is saved as `{input_filename}-Output.jpg` with:
- Vehicle bounding boxes (blue)
- License plate bounding boxes (red)
- Detected license plate text overlaid on the frame

## Development

### Running Tests

```bash
python main.py
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Add your license here]

## Acknowledgments

- [Ultralytics YOLOv8](https://github.com/ultralytics/ultralytics) for object detection
- [SORT](https://github.com/abewley/sort) for multi-object tracking
- [EasyOCR](https://github.com/JaidedAI/EasyOCR) for optical character recognition
