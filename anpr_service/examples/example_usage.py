"""
Example usage of the ANPR Service

This file demonstrates how to use the ANPR service programmatically.
"""

from pathlib import Path
from anpr_service import ANPRService, ANPRConfig


def example_image_processing():
    """Example: Process a single image."""
    # Create configuration
    config = ANPRConfig(
        vehicle_model_path='yolov8n.pt',
        license_plate_model_path='license_plate_detector.pt',
        save_output=True,
        display_output=False
    )
    
    # Initialize service
    service = ANPRService(config)
    
    # Process image
    image_path = Path('anpr-service/img4.jpg')
    if image_path.exists():
        processed_frame, results = service.process_image(image_path)
        
        # Print results
        print("Detection Results:")
        for result in results:
            if result.license_plate_text and result.license_plate_text != "Couldn't Decode":
                print(f"Vehicle {result.vehicle_id}: {result.license_plate_text}")
    else:
        print(f"Image not found: {image_path}")


def example_video_processing():
    """Example: Process a video file."""
    config = ANPRConfig(
        save_output=True,
        display_output=True
    )
    
    service = ANPRService(config)
    
    video_path = Path('path/to/video.mp4')
    if video_path.exists():
        all_results = service.process_video(video_path, max_frames=100)
        print(f"Processed {len(all_results)} frames")
    else:
        print(f"Video not found: {video_path}")


def example_camera_feed():
    """Example: Process live camera feed."""
    config = ANPRConfig(
        display_output=True,
        save_output=False
    )
    
    service = ANPRService(config)
    
    # Process camera feed (press 'q' to quit)
    service.process_camera(camera_index=0)


def example_custom_config():
    """Example: Using custom configuration."""
    config = ANPRConfig(
        vehicle_model_path='custom_vehicle_model.pt',
        license_plate_model_path='custom_license_model.pt',
        vehicle_classes=[2, 3, 5, 7],  # Car, Motorcycle, Bus, Truck
        output_resolution=(1920, 1080),
        ocr_gpu=True,
        ocr_languages=['en', 'es']  # English and Spanish
    )
    
    service = ANPRService(config)
    # Use service as needed...


if __name__ == "__main__":
    # Run example
    example_image_processing()
