import easyocr
import cv2
import logging
from typing import Tuple, Optional, List

# Set up logger
logger = logging.getLogger(__name__)


# Mapping dictionaries for character conversion
dict_char_to_int = {'O': '0',
                    'I': '1',
                    'J': '3',
                    'A': '4',
                    'G': '6',
                    'T': '1',
                    'S': '5',
                    'Z': '2',
                    '?': '7'}

dict_int_to_char = {'0': 'O',
                    '1': 'I',
                    '3': 'J',
                    '4': 'A',
                    '6': 'G',
                    '5': 'S',
                    '8': 'B'}


def write_csv(results, output_path):
    """
    Write the results to a CSV file.

    Args:
        results (dict): Dictionary containing the results.
        output_path (str): Path to the output CSV file.
    """
    with open(output_path, 'w') as f:
        f.write('{},{},{},{},{},{},{}\n'.format('frame_nmr', 'car_id', 'car_bbox',
                                                'license_plate_bbox', 'license_plate_bbox_score', 'license_number',
                                                'license_number_score'))

        for frame_nmr in results.keys():
            for car_id in results[frame_nmr].keys():
                logger.debug(f"Frame {frame_nmr}, Car {car_id}: {results[frame_nmr][car_id]}")
                if 'car' in results[frame_nmr][car_id].keys() and \
                   'license_plate' in results[frame_nmr][car_id].keys() and \
                   'text' in results[frame_nmr][car_id]['license_plate'].keys():
                    f.write('{},{},{},{},{},{},{}\n'.format(frame_nmr,
                                                            car_id,
                                                            '[{} {} {} {}]'.format(
                                                                results[frame_nmr][car_id]['car']['bbox'][0],
                                                                results[frame_nmr][car_id]['car']['bbox'][1],
                                                                results[frame_nmr][car_id]['car']['bbox'][2],
                                                                results[frame_nmr][car_id]['car']['bbox'][3]),
                                                            '[{} {} {} {}]'.format(
                                                                results[frame_nmr][car_id]['license_plate']['bbox'][0],
                                                                results[frame_nmr][car_id]['license_plate']['bbox'][1],
                                                                results[frame_nmr][car_id]['license_plate']['bbox'][2],
                                                                results[frame_nmr][car_id]['license_plate']['bbox'][3]),
                                                            results[frame_nmr][car_id]['license_plate']['bbox_score'],
                                                            results[frame_nmr][car_id]['license_plate']['text'],
                                                            results[frame_nmr][car_id]['license_plate']['text_score'])
                            )
        f.close()


def license_complies_format(text: str) -> Optional[str]:
    """
    Check if the license plate text complies with the required format and convert it.

    Args:
        text (str): License plate text.

    Returns:
        Optional[str]: Converted license plate text if valid format, None otherwise.
    """
    if not text:
        return None
    
    numP = ""
    if len(text) == 9:
        for i in range(0, len(text)):
            if i in (0, 1, 4):
                numP += dict_int_to_char.get(text[i], text[i])
            elif i in (2, 3, 5, 6, 7, 8):
                numP += dict_char_to_int.get(text[i], text[i])
        return numP

    if len(text) == 10:
        for i in range(0, len(text)):
            if i in (0, 1, 4, 5):
                numP += dict_int_to_char.get(text[i], text[i])
            elif i in (2, 3, 6, 7, 8, 9):
                numP += dict_char_to_int.get(text[i], text[i])
        return numP
    
    return None


def format_license(text: str) -> str:
    """
    Format the license plate text by converting characters using the mapping dictionaries.

    Args:
        text (str): License plate text.

    Returns:
        str: Formatted license plate text.
    """
    if not text:
        return "Couldn't Decode"
    
    license_plate_ = ''
    
    if len(text) == 9:
        mapping = {
            0: dict_int_to_char, 1: dict_int_to_char,
            2: dict_char_to_int, 3: dict_char_to_int,
            4: dict_int_to_char,
            5: dict_char_to_int, 6: dict_char_to_int, 
            7: dict_char_to_int, 8: dict_char_to_int
        }
        for j in range(0, 9):
            if j < len(text) and text[j] in mapping[j]:
                license_plate_ += mapping[j][text[j]]
            else:
                license_plate_ += text[j] if j < len(text) else ''
        return license_plate_

    if len(text) == 10:
        mapping = {
            0: dict_int_to_char, 1: dict_int_to_char,
            2: dict_char_to_int, 3: dict_char_to_int,
            4: dict_int_to_char, 5: dict_int_to_char,
            6: dict_char_to_int, 7: dict_char_to_int, 
            8: dict_char_to_int, 9: dict_char_to_int
        }
        for j in range(0, 10):
            if j < len(text) and text[j] in mapping[j]:
                license_plate_ += mapping[j][text[j]]
            else:
                license_plate_ += text[j] if j < len(text) else ''
        return license_plate_

    return "Couldn't Decode"

def read_license_plate(license_plate_crop, ocr_reader: easyocr.Reader) -> str:
    """
    Read the license plate text from the given cropped image.

    Args:
        license_plate_crop: Cropped image containing the license plate (numpy array).
        ocr_reader: EasyOCR Reader instance.

    Returns:
        str: Formatted license plate text.
    """
    if license_plate_crop is None or license_plate_crop.size == 0:
        return "Couldn't Decode"
    
    try:
        detections = ocr_reader.readtext(license_plate_crop)
        complete_text = ""
        
        # ocr.readtext returns a list of tuples: [(bbox, text, confidence), ...]
        for detection in detections:
            # Each detection is a tuple: (bbox, text, confidence)
            text = detection[1]  # Extract text from the tuple
            # Clean and normalize text
            text = text.upper()
            # Remove common unwanted characters
            unwanted_chars = [' ', ',', '.', '"', "'", ';', ':', '~', '-', '+', '*']
            for char in unwanted_chars:
                text = text.replace(char, '')
            complete_text += text
        
        if not complete_text:
            return "Couldn't Decode"
            
        return format_license(complete_text.upper())
    except Exception as e:
        logger.error(f"Error reading license plate: {e}", exc_info=True)
        return "Couldn't Decode"


def get_vehicle(license_plate: List[float], vehicle_track_ids: List) -> Tuple[float, float, float, float, int]:
    """
    Retrieve the vehicle coordinates and ID based on the license plate coordinates.

    Args:
        license_plate: List containing the coordinates of the license plate [x1, y1, x2, y2, score, class_id].
        vehicle_track_ids: List of vehicle track IDs and their corresponding coordinates.

    Returns:
        Tuple containing the vehicle coordinates (x1, y1, x2, y2) and ID, or (-1, -1, -1, -1, -1) if not found.
    """
    if len(license_plate) < 4:
        return -1, -1, -1, -1, -1
    
    x1, y1, x2, y2 = license_plate[0], license_plate[1], license_plate[2], license_plate[3]

    for j in range(len(vehicle_track_ids)):
        if len(vehicle_track_ids[j]) < 5:
            continue
            
        xcar1, ycar1, xcar2, ycar2, car_id = vehicle_track_ids[j]

        # Check if license plate is inside vehicle bounding box
        if x1 > xcar1 and y1 > ycar1 and x2 < xcar2 and y2 < ycar2:
            return vehicle_track_ids[j]

    return -1, -1, -1, -1, -1
