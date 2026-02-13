"""
Main entry point for Barricade Service

Processes img4.jpg using the ANPR service.
"""

import logging
import sys
from pathlib import Path
from anpr_service.anpr_service import ANPRService, ANPRConfig

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Set up logger
logger = logging.getLogger(__name__)


def main():
    """Process img4.jpg image."""
    # Image path
    image_path = Path('anpr_service/img.jpg')
    
    # Check if image exists
    if not image_path.exists():
        logger.error(f"Image not found: {image_path}")
        return
    
    # Create configuration
    config = ANPRConfig(
        save_output=True,
        display_output=False
    )
    
    # Initialize service
    try:
        logger.info("Initializing ANPR service")
        service = ANPRService(config)
        logger.info("ANPR service initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing service: {e}", exc_info=True)
        return
    
    # Process image
    try:
        logger.info(f"Processing image: {image_path}")
        processed_frame, results = service.process_image(image_path)
        
        # Log results
        logger.info("Detection Results:")
        
        valid_plates = [
            r for r in results 
            if r.license_plate_text and r.license_plate_text != "Couldn't Decode"
        ]
        
        if valid_plates:
            logger.info(f"Found {len(valid_plates)} valid license plate(s)")
            for i, result in enumerate(valid_plates, 1):
                logger.info(f"Detection {i}:")
                logger.info(f"  Vehicle ID: {result.vehicle_id}")
                logger.info(f"  License Plate: {result.license_plate_text}")
                logger.info(f"  Confidence: {result.confidence:.2f}")
        else:
            logger.warning("No license plates detected.")
        
        logger.info("=" * 50)
        logger.info("Processing complete!")
        
    except Exception as e:
        logger.error(f"Error processing image: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
