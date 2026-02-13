import cv2
import warnings
from ultralytics import YOLO
from sort.sort import *
from utility import get_vehicle, read_license_plate

# Suppress pin_memory warning for MPS backend (macOS)
warnings.filterwarnings('ignore', message='.*pin_memory.*MPS.*')

# Load models
coco_model = YOLO('yolov8n.pt')
license_plate_detector = YOLO('license_plate_detector.pt')

# Define vehicle class IDs for COCO dataset
vehicles = [2, 5, 7]  # Car, Motorcycle, Bus, Truck

# Initialize SORT tracker
mot_tracker = Sort()

# Open video capture
flName = 'img4.jpg'

cap = cv2.VideoCapture(flName)
# cap = cv2.VideoCapture(0)


ret = True

while ret:
    ret, frame = cap.read()

    if not ret:
        break  # Exit loop if no frame is read

    # Vehicle Detection
    detections = coco_model(frame)[0]
    detections_ = []
    for detection in detections.boxes.data.tolist():
        x1, y1, x2, y2, score, class_id = detection
        cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (255, 0, 0), 2)
        if int(class_id) in vehicles:
            detections_.append([x1, y1, x2, y2, score])

    # Tracking
    track_ids = mot_tracker.update(np.asarray(detections_))

    # License Plate Detection
    license_plates = license_plate_detector(frame)[0]
    for license_plate in license_plates.boxes.data.tolist():
        x1, y1, x2, y2, score, class_id = license_plate
        cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), 2)

        # Assign license plate to vehicle
        xcar1, ycar1, xcar2, ycar2, car_id = get_vehicle(license_plate, track_ids)

        # Crop and process license plate
        if car_id != -1:
            license_plate_crop = frame[int(y1):int(y2), int(x1): int(x2), :]
            # cv2.imwrite(f"{flName}-Output.jpg", license_plate_crop)
            # gray = cv2.cvtColor(license_plate_crop, cv2.COLOR_BGR2GRAY)
            # blur = cv2.GaussianBlur(gray, (5, 5), 0)
            # thresh = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            #                                cv2.THRESH_BINARY, 11, 2)

            license_plate_text = read_license_plate(license_plate_crop)
            print(f"Detected Plate: {license_plate_text}")

            # Display detected text on the frame
            cv2.putText(frame, license_plate_text, (int(x1), int(y1) - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255),2)

    # Show the video feed
    # cv2.imshow("ANPR System", frame)
    frame_resized = cv2.resize(frame, (1280, 720))
    # Show the resized frame

    # cv2.imshow("System", license_plate_crop)
    cv2.imshow("ANPR System", frame_resized)
    cv2.imwrite(f"{flName}-Output.jpg", frame)
    print("output stored")
    # Press 'q' to exit
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Release resources
cap.release()
cv2.destroyAllWindows()
