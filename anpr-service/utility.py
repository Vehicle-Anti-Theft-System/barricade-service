import string
from numpy.core.defchararray import upper
import easyocr
import cv2
ocr = easyocr.Reader(
    ['en'],
    gpu=False,
    verbose=False
)


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
                print(results[frame_nmr][car_id])
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


def license_complies_format(text):
    """
    Check if the license plate text complies with the required format.

    Args:
        text (str): License plate text.

    Returns:
        bool: True if the license plate complies with the format, False otherwise.
    """
    # if len(text) >= 10:
    #     return False
    numP=""
    if len(text) == 9:
        for i in range(0, len(text)):
            if i in (0,1,4):
                numP+= dict_int_to_char[text[i]] or text[i]

            if i in (2,3,5,6,7,8):
                numP += dict_char_to_int[text[i]] or text[i]
        return numP

    if len(text) == 10:
        for i in range(0, len(text)):
            if i in (0,1,4,5):
                numP+= dict_int_to_char[text[i]] or text[i]

            if i in (2,3,6,7,8,7):
                numP += dict_char_to_int[text[i]] or text[i]
        return numP


def format_license(text):
    """
    Format the license plate text by converting characters using the mapping dictionaries.

    Args:
        text (str): License plate text.

    Returns:
        str: Formatted license plate text.
    """
    license_plate_ = ''
    print(text)
    if len(text) == 9:

        mapping = {0: dict_int_to_char, 1: dict_int_to_char,
                   2: dict_char_to_int, 3: dict_char_to_int,
                   4: dict_int_to_char,
                   5: dict_char_to_int, 6: dict_char_to_int, 7: dict_char_to_int, 8: dict_char_to_int,}
        for j in range(0,9):
            if text[j] in mapping[j].keys():
                license_plate_ += mapping[j][text[j]]
            else:
                license_plate_ += text[j]

        return license_plate_

    if len(text) == 10:

        mapping = {0: dict_int_to_char, 1: dict_int_to_char,
                   2: dict_char_to_int, 3: dict_char_to_int,
                   4: dict_int_to_char, 5: dict_int_to_char,
                6: dict_char_to_int, 7: dict_char_to_int, 8: dict_char_to_int, 9: dict_char_to_int}
        for j in range(0,10):
            if text[j] in mapping[j].keys():
                license_plate_ += mapping[j][text[j]]
            else:
                license_plate_ += text[j]

        return license_plate_


    else:
        return "Couldn't Decode"

def read_license_plate(license_plate_crop):
    """
    Read the license plate text from the given cropped image.

    Args:
        license_plate_crop (PIL.Image.Image): Cropped image containing the license plate.

    Returns:
        tuple: Tuple containing the formatted license plate text and its confidence score.
    """

    detections = ocr.readtext(license_plate_crop)
    completeText = ""
    try:
        # ocr.readtext returns a list of tuples: [(bbox, text, confidence), ...]
        for detection in detections:
            # Each detection is a tuple: (bbox, text, confidence)
            text = detection[1]  # Extract text from the tuple
            # print(text)
            text = text.upper().replace(' ', '')
            text = text.upper().replace(',', '')
            text = text.upper().replace('.', '')
            text = text.upper().replace('"', '')
            text = text.upper().replace("'", '')
            text = text.upper().replace(';', '')
            text = text.upper().replace(':', '')
            text = text.upper().replace('~', '')
            text = text.upper().replace('-', '')
            text = text.upper().replace('+', '')
            text = text.upper().replace('*', '')
            completeText += text
    except Exception as e:
        print(f"Error reading license plate: {e}")
    completeText = format_license(completeText.upper())
    return completeText


def get_vehicle(license_plate, vehicle_track_ids):
    """
    Retrieve the vehicle coordinates and ID based on the license plate coordinates.

    Args:
        license_plate (tuple): Tuple containing the coordinates of the license plate (x1, y1, x2, y2, score, class_id).
        vehicle_track_ids (list): List of vehicle track IDs and their corresponding coordinates.

    Returns:
        tuple: Tuple containing the vehicle coordinates (x1, y1, x2, y2) and ID.
    """
    x1, y1, x2, y2, score, class_id = license_plate

    foundIt = False
    for j in range(len(vehicle_track_ids)):
        xcar1, ycar1, xcar2, ycar2, car_id = vehicle_track_ids[j]

        if x1 > xcar1 and y1 > ycar1 and x2 < xcar2 and y2 < ycar2:
            car_indx = j
            foundIt = True
            break

    if foundIt:
        return vehicle_track_ids[car_indx]

    return -1, -1, -1, -1, -1
