"""
Example: Using capture_and_process_frame for single frame processing

This example shows how to use the capture_and_process_frame method
to process camera frames one at a time on demand.
"""

from anpr_service import ANPRService, ANPRConfig


def example_single_frame_processing():
    """Example: Process camera frames one at a time."""
    # Initialize service
    config = ANPRConfig(
        display_output=False,  # Don't display, we'll handle it ourselves
        save_output=False
    )
    service = ANPRService(config)
    
    try:
        # Process frames on demand
        for i in range(10):  # Process 10 frames
            processed_frame, results, success = service.capture_and_process_frame()
            
            if not success:
                print(f"Failed to capture frame {i}")
                break
            
            # Process results
            print(f"\nFrame {i}:")
            valid_plates = [
                r for r in results 
                if r.license_plate_text and r.license_plate_text != "Couldn't Decode"
            ]
            
            if valid_plates:
                for result in valid_plates:
                    print(f"  Vehicle {result.vehicle_id}: {result.license_plate_text} "
                          f"(confidence: {result.confidence:.2f})")
            else:
                print("  No license plates detected")
    
    finally:
        # Always release camera when done
        service.release_camera()


def example_with_external_camera():
    """Example: Using an external camera object."""
    import cv2
    from anpr_service import ANPRService
    
    # Open camera yourself
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open camera")
        return
    
    service = ANPRService()
    
    try:
        # Process frames using external camera
        for i in range(10):
            processed_frame, results, success = service.capture_and_process_frame(camera=cap)
            
            if not success:
                break
            
            # Display frame
            if processed_frame is not None:
                cv2.imshow("ANPR Frame", processed_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
            
            # Print results
            for result in results:
                if result.license_plate_text and result.license_plate_text != "Couldn't Decode":
                    print(f"Frame {i}: {result.license_plate_text}")
    
    finally:
        cap.release()
        cv2.destroyAllWindows()
        service.release_camera()


def example_continuous_processing():
    """Example: Continuous processing until interrupted."""
    from anpr_service import ANPRService
    import cv2
    
    service = ANPRService()
    
    try:
        print("Processing camera frames. Press Ctrl+C to stop.")
        frame_count = 0
        
        while True:
            processed_frame, results, success = service.capture_and_process_frame()
            
            if not success:
                print("Failed to capture frame")
                break
            
            frame_count += 1
            
            # Display frame if available
            if processed_frame is not None:
                resized = cv2.resize(processed_frame, (1280, 720))
                cv2.imshow("ANPR Live", resized)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
            
            # Print detected plates every 10 frames
            if frame_count % 10 == 0:
                valid_plates = [
                    r for r in results 
                    if r.license_plate_text and r.license_plate_text != "Couldn't Decode"
                ]
                if valid_plates:
                    print(f"\nFrame {frame_count}:")
                    for result in valid_plates:
                        print(f"  {result.license_plate_text}")
    
    except KeyboardInterrupt:
        print("\nStopped by user")
    finally:
        service.release_camera()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    # Run the single frame processing example
    example_single_frame_processing()
    
    # Uncomment to try other examples:
    # example_with_external_camera()
    # example_continuous_processing()
