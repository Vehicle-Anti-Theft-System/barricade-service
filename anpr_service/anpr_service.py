"""
ANPR (Automatic Number Plate Recognition) Service

A professional service for detecting vehicles, tracking them across frames,
and extracting license plate information from images and video streams.
"""

import cv2
import numpy as np
import warnings
import logging
from pathlib import Path
from typing import Optional, Dict, List, Tuple, Union
from dataclasses import dataclass

from ultralytics import YOLO
from anpr_service.sort.sort import Sort

from anpr_service.utility import get_vehicle, read_license_plate


# Suppress pin_memory warning for MPS backend (macOS)
warnings.filterwarnings('ignore', message='.*pin_memory.*MPS.*')

# Set up logger
logger = logging.getLogger(__name__)


@dataclass
class ANPRConfig:
    """Configuration for ANPR Service."""
    vehicle_model_path: str = 'yolov8n.pt'
    license_plate_model_path: str = 'license_plate_detector.pt'
    vehicle_classes: List[int] = None
    display_output: bool = True
    save_output: bool = True
    output_resolution: Tuple[int, int] = (1280, 720)
    ocr_gpu: bool = False
    ocr_languages: List[str] = None
    
    def __post_init__(self):
        """Initialize default values."""
        if self.vehicle_classes is None:
            # COCO dataset class IDs: Car=2, Motorcycle=3, Bus=5, Truck=7
            self.vehicle_classes = [2, 3, 5, 7]
        if self.ocr_languages is None:
            self.ocr_languages = ['en']


@dataclass
class DetectionResult:
    """Result of a single detection."""
    vehicle_id: int
    vehicle_bbox: Tuple[float, float, float, float]
    license_plate_text: Optional[str]
    license_plate_bbox: Optional[Tuple[float, float, float, float]]
    confidence: float


class ANPRService:
    """
    Automatic Number Plate Recognition Service.
    
    This service provides functionality to:
    - Detect vehicles in images/videos
    - Track vehicles across frames
    - Detect and extract license plate information
    """
    
    def __init__(self, config: Optional[ANPRConfig] = None, base_path: Optional[Path] = None):
        """
        Initialize the ANPR Service.
        
        Args:
            config: Configuration object. If None, uses default configuration.
            base_path: Base path for model files. If None, uses current directory.
        
        Raises:
            FileNotFoundError: If model files are not found.
            RuntimeError: If models fail to load.
        """
        self.config = config or ANPRConfig()
        self.base_path = Path(base_path) if base_path else Path(__file__).parent
        
        logger.info("Initializing ANPR Service")
        logger.debug(f"Base path: {self.base_path}")
        logger.debug(f"Vehicle model: {self.config.vehicle_model_path}")
        logger.debug(f"License plate model: {self.config.license_plate_model_path}")
        
        # Initialize models
        self._load_models()
        
        # Initialize OCR reader (lazy loading)
        self._ocr_reader = None
        
        # Initialize SORT tracker
        self.mot_tracker = Sort()
        logger.debug("SORT tracker initialized")
        
        # Camera object (initialized on first use)
        self._camera = None
        
    def _load_models(self) -> None:
        """Load YOLO models for vehicle and license plate detection."""
        try:
            vehicle_model_path = self.base_path / self.config.vehicle_model_path
            if not vehicle_model_path.exists():
                logger.error(f"Vehicle detection model not found: {vehicle_model_path}")
                raise FileNotFoundError(
                    f"Vehicle detection model not found: {vehicle_model_path}"
                )
            
            license_model_path = self.base_path / self.config.license_plate_model_path
            if not license_model_path.exists():
                logger.error(f"License plate detection model not found: {license_model_path}")
                raise FileNotFoundError(
                    f"License plate detection model not found: {license_model_path}"
                )
            
            logger.info(f"Loading vehicle detection model: {vehicle_model_path}")
            self.vehicle_model = YOLO(str(vehicle_model_path))
            logger.info(f"Loading license plate detection model: {license_model_path}")
            self.license_plate_model = YOLO(str(license_model_path))
            logger.info("Models loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load models: {e}", exc_info=True)
            raise RuntimeError(f"Failed to load models: {e}") from e
    
    @property
    def ocr_reader(self):
        """Lazy load OCR reader."""
        if self._ocr_reader is None:
            import easyocr
            logger.info(f"Initializing OCR reader (GPU: {self.config.ocr_gpu}, Languages: {self.config.ocr_languages})")
            self._ocr_reader = easyocr.Reader(
                self.config.ocr_languages,
                gpu=self.config.ocr_gpu,
                verbose=False
            )
            logger.info("OCR reader initialized successfully")
        return self._ocr_reader
    
    def detect_vehicles(self, frame: np.ndarray) -> List[Tuple[float, float, float, float, float]]:
        """
        Detect vehicles in a frame.
        
        Args:
            frame: Input frame as numpy array.
        
        Returns:
            List of detections in format [x1, y1, x2, y2, confidence]
        """
        detections = self.vehicle_model(frame)[0]
        vehicle_detections = []
        
        for detection in detections.boxes.data.tolist():
            x1, y1, x2, y2, score, class_id = detection
            if int(class_id) in self.config.vehicle_classes:
                vehicle_detections.append([x1, y1, x2, y2, score])
        
        return vehicle_detections
    
    def track_vehicles(self, detections: List) -> np.ndarray:
        """
        Track vehicles across frames using SORT algorithm.
        
        Args:
            detections: List of vehicle detections.
        
        Returns:
            Array of tracked vehicles with IDs.
        """
        if not detections:
            return np.empty((0, 5))
        return self.mot_tracker.update(np.asarray(detections))
    
    def detect_license_plates(self, frame: np.ndarray) -> List[Tuple[float, float, float, float, float, int]]:
        """
        Detect license plates in a frame.
        
        Args:
            frame: Input frame as numpy array.
        
        Returns:
            List of license plate detections in format [x1, y1, x2, y2, score, class_id]
        """
        detections = self.license_plate_model(frame)[0]
        return detections.boxes.data.tolist()
    
    def process_frame(
        self, 
        frame: np.ndarray,
        draw_detections: bool = True
    ) -> Tuple[np.ndarray, List[DetectionResult]]:
        """
        Process a single frame for vehicle and license plate detection.
        
        Args:
            frame: Input frame as numpy array.
            draw_detections: Whether to draw bounding boxes on the frame.
        
        Returns:
            Tuple of (processed_frame, list_of_detection_results)
        """
        results = []
        processed_frame = frame.copy()
        
        # Step 1: Detect vehicles
        vehicle_detections = self.detect_vehicles(frame)
        logger.debug(f"Detected {len(vehicle_detections)} vehicles")
        
        # Step 2: Track vehicles
        tracked_vehicles = self.track_vehicles(vehicle_detections)
        logger.debug(f"Tracking {len(tracked_vehicles)} vehicles")
        
        # Draw vehicle bounding boxes
        if draw_detections:
            for vehicle in tracked_vehicles:
                x1, y1, x2, y2, vehicle_id = vehicle
                cv2.rectangle(
                    processed_frame,
                    (int(x1), int(y1)),
                    (int(x2), int(y2)),
                    (255, 0, 0),  # Blue for vehicles
                    2
                )
                cv2.putText(
                    processed_frame,
                    f"Vehicle {int(vehicle_id)}",
                    (int(x1), int(y1) - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (255, 0, 0),
                    2
                )
        
        # Step 3: Detect license plates
        license_plates = self.detect_license_plates(frame)
        logger.debug(f"Detected {len(license_plates)} license plates")
        
        # Step 4: Match license plates to vehicles and extract text
        for license_plate in license_plates:
            x1, y1, x2, y2, score, class_id = license_plate
            
            # Draw license plate bounding box
            if draw_detections:
                cv2.rectangle(
                    processed_frame,
                    (int(x1), int(y1)),
                    (int(x2), int(y2)),
                    (0, 0, 255),  # Red for license plates
                    2
                )
            
            # Match license plate to vehicle
            xcar1, ycar1, xcar2, ycar2, car_id = get_vehicle(
                license_plate, 
                tracked_vehicles.tolist() if len(tracked_vehicles) > 0 else []
            )
            
            license_plate_text = None
            
            # Extract license plate text if matched to a vehicle
            if car_id != -1:
                # Crop license plate region
                license_plate_crop = frame[int(y1):int(y2), int(x1):int(x2), :]
                
                if license_plate_crop.size > 0:
                    # Read license plate text
                    license_plate_text = read_license_plate(
                        license_plate_crop,
                        self.ocr_reader
                    )
                    
                    if license_plate_text and license_plate_text != "Couldn't Decode":
                        logger.debug(f"Extracted license plate text: {license_plate_text} for vehicle {car_id}")
                    
                    # Draw text on frame
                    if draw_detections and license_plate_text:
                        cv2.putText(
                            processed_frame,
                            license_plate_text,
                            (int(x1), int(y1) - 10),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.9,
                            (0, 0, 255),
                            2
                        )
            
            # Store result
            result = DetectionResult(
                vehicle_id=int(car_id) if car_id != -1 else -1,
                vehicle_bbox=(xcar1, ycar1, xcar2, ycar2) if car_id != -1 else (0, 0, 0, 0),
                license_plate_text=license_plate_text,
                license_plate_bbox=(x1, y1, x2, y2),
                confidence=float(score)
            )
            results.append(result)
        
        return processed_frame, results
    
    def process_image(
        self,
        image_path: Union[str, Path],
        output_path: Optional[Union[str, Path]] = None
    ) -> Tuple[np.ndarray, List[DetectionResult]]:
        """
        Process a single image file.
        
        Args:
            image_path: Path to input image.
            output_path: Optional path to save output image. If None, auto-generates name.
        
        Returns:
            Tuple of (processed_frame, list_of_detection_results)
        
        Raises:
            FileNotFoundError: If image file doesn't exist.
            ValueError: If image cannot be read.
        """
        image_path = Path(image_path)
        if not image_path.exists():
            logger.error(f"Image not found: {image_path}")
            raise FileNotFoundError(f"Image not found: {image_path}")
        
        logger.info(f"Processing image: {image_path}")
        frame = cv2.imread(str(image_path))
        if frame is None:
            logger.error(f"Could not read image: {image_path}")
            raise ValueError(f"Could not read image: {image_path}")
        
        processed_frame, results = self.process_frame(frame)
        logger.debug(f"Processed frame, detected {len(results)} license plates")
        
        # Save output if requested
        if self.config.save_output:
            if output_path is None:
                output_path = image_path.parent / f"{image_path.stem}-Output.jpg"
            else:
                output_path = Path(output_path)
            cv2.imwrite(str(output_path), processed_frame)
            logger.info(f"Output saved to: {output_path}")
        
        return processed_frame, results
    
    def process_video(
        self,
        video_path: Union[str, Path],
        output_path: Optional[Union[str, Path]] = None,
        max_frames: Optional[int] = None
    ) -> List[List[DetectionResult]]:
        """
        Process a video file.
        
        Args:
            video_path: Path to input video.
            output_path: Optional path to save output video. If None, auto-generates name.
            max_frames: Maximum number of frames to process. If None, processes all frames.
        
        Returns:
            List of detection results for each frame.
        
        Raises:
            FileNotFoundError: If video file doesn't exist.
            RuntimeError: If video cannot be opened.
        """
        video_path = Path(video_path)
        if not video_path.exists():
            logger.error(f"Video not found: {video_path}")
            raise FileNotFoundError(f"Video not found: {video_path}")
        
        logger.info(f"Processing video: {video_path}")
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            logger.error(f"Could not open video: {video_path}")
            raise RuntimeError(f"Could not open video: {video_path}")
        
        # Get video properties
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        logger.info(f"Video properties: {width}x{height} @ {fps} FPS")
        
        # Setup video writer if saving output
        writer = None
        if self.config.save_output and output_path:
            output_path = Path(output_path)
            if output_path.suffix == '':
                output_path = output_path.with_suffix('.mp4')
            
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer = cv2.VideoWriter(
                str(output_path),
                fourcc,
                fps,
                self.config.output_resolution
            )
        
        all_results = []
        frame_count = 0
        
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                if max_frames and frame_count >= max_frames:
                    logger.info(f"Reached max_frames limit: {max_frames}")
                    break
                
                # Process frame
                processed_frame, results = self.process_frame(frame)
                all_results.append(results)
                
                if frame_count % 100 == 0:
                    logger.debug(f"Processed {frame_count} frames")
                
                # Resize for display/saving
                resized_frame = cv2.resize(
                    processed_frame,
                    self.config.output_resolution
                )
                
                # Save frame if writer is available
                if writer:
                    writer.write(resized_frame)
                
                # Display frame if requested
                if self.config.display_output:
                    cv2.imshow("ANPR System", resized_frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break
                
                frame_count += 1
                
        finally:
            cap.release()
            if writer:
                writer.release()
            if self.config.display_output:
                cv2.destroyAllWindows()
        
        if self.config.save_output and output_path:
            logger.info(f"Output video saved to: {output_path}")
        
        logger.info(f"Video processing complete: {len(all_results)} frames processed")
        return all_results
    
    def process_camera(
        self,
        camera_index: int = 0
    ) -> None:
        """
        Process live camera feed.
        
        Args:
            camera_index: Camera device index (default: 0).
        
        Raises:
            RuntimeError: If camera cannot be opened.
        """
        logger.info(f"Opening camera: {camera_index}")
        cap = cv2.VideoCapture(camera_index)
        if not cap.isOpened():
            logger.error(f"Could not open camera: {camera_index}")
            raise RuntimeError(f"Could not open camera: {camera_index}")
        
        logger.info("Camera feed started. Press 'q' to quit.")
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    logger.warning("Failed to read frame from camera")
                    break
                
                # Process frame
                processed_frame, results = self.process_frame(frame)
                
                # Resize for display
                resized_frame = cv2.resize(
                    processed_frame,
                    self.config.output_resolution
                )
                
                # Display frame
                cv2.imshow("ANPR System", resized_frame)
                
                # Log detected plates
                for result in results:
                    if result.license_plate_text and result.license_plate_text != "Couldn't Decode":
                        logger.info(f"Vehicle {result.vehicle_id}: License plate detected - {result.license_plate_text}")
                
                # Press 'q' to exit
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    logger.info("Camera feed stopped by user")
                    break
                    
        finally:
            cap.release()
            cv2.destroyAllWindows()
            logger.info("Camera resources released")
    
    def capture_and_process_frame(
        self,
        camera_index: int = 0,
        camera: Optional[Union[cv2.VideoCapture, None]] = None
    ) -> Tuple[Optional[np.ndarray], List[DetectionResult], bool]:
        """
        Capture a single frame from camera, process it, and return results.
        
        This method is designed for live camera processing where you want to
        process frames one at a time on demand.
        
        Args:
            camera_index: Camera device index (default: 0). Only used if camera is None.
            camera: Optional existing VideoCapture object. If provided, uses this instead
                   of creating a new one. If None, manages camera internally.
        
        Returns:
            Tuple of (processed_frame, results, success):
            - processed_frame: Processed frame with detections drawn (None if capture failed)
            - results: List of DetectionResult objects
            - success: Boolean indicating if frame was captured successfully
        
        Raises:
            RuntimeError: If camera cannot be opened.
        
        Example:
            >>> service = ANPRService()
            >>> while True:
            ...     frame, results, success = service.capture_and_process_frame()
            ...     if not success:
            ...         break
            ...     # Process results
            ...     for result in results:
            ...         if result.license_plate_text:
            ...             print(result.license_plate_text)
        """
        # Use provided camera or manage internally
        if camera is not None:
            cap = camera
        else:
            # Initialize camera if not already done
            if self._camera is None:
                logger.debug(f"Initializing camera: {camera_index}")
                self._camera = cv2.VideoCapture(camera_index)
                if not self._camera.isOpened():
                    logger.error(f"Could not open camera: {camera_index}")
                    raise RuntimeError(f"Could not open camera: {camera_index}")
                logger.debug("Camera initialized successfully")
            cap = self._camera
        
        # Capture frame
        ret, frame = cap.read()
        if not ret or frame is None:
            logger.warning("Failed to capture frame from camera")
            return None, [], False
        
        # Process frame
        processed_frame, results = self.process_frame(frame)
        logger.debug(f"Processed camera frame, detected {len(results)} license plates")
        
        return processed_frame, results, True
    
    def release_camera(self) -> None:
        """
        Release the internally managed camera resource.
        
        Call this when you're done processing camera frames to free resources.
        """
        if self._camera is not None:
            logger.info("Releasing camera resources")
            self._camera.release()
            self._camera = None
            logger.debug("Camera resources released")
    
    def reset_tracker(self) -> None:
        """Reset the SORT tracker (useful when processing new video sequences)."""
        logger.info("Resetting SORT tracker")
        self.mot_tracker = Sort()
