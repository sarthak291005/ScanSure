# ScanSure Data Contracts

## OCR Output Contract

The OCR module converts a product/package image into a standardized JSON object.

### Purpose

This contract defines the data passed from the OCR module to downstream modules such as NLP, backend, and compliance processing.

### JSON Structure

```json
{
    "image_id": "product1",
    "ocr_engine": "PaddleOCR",
    "text_blocks": [
        {
            "text": "200 ml",
            "bbox": [1031, 3635, 1203, 3688],
            "confidence": 0.9965
        }
    ]
}
Fields
Field	Type	Description
image_id	string	Unique identifier derived from the input image filename
ocr_engine	string	OCR engine used to generate the result
text_blocks	array	List of detected text regions
text_blocks[].text	string	Text recognized from the image
text_blocks[].bbox	array of integers	Bounding box in [x1, y1, x2, y2] format
text_blocks[].confidence	float	OCR recognition confidence between 0 and 1
Example
{
    "image_id": "product1",
    "ocr_engine": "PaddleOCR",
    "text_blocks": [
        {
            "text": "ANTI-DANDRUFF SHAMPOO",
            "bbox": [776, 2873, 1433, 2942],
            "confidence": 0.9992
        },
        {
            "text": "200 ml",
            "bbox": [1031, 3635, 1203, 3688],
            "confidence": 0.9965
        }
    ]
}
Responsibilities

The OCR module is responsible for:

Detecting text in the image
Recognizing the text
Returning bounding boxes
Returning OCR confidence
Providing the image identifier

The OCR module does not determine:

Product category
Legal Metrology fields
Legal compliance
PASS/NON_COMPLIANT verdicts

Those decisions belong to downstream modules.

Downstream Usage

The NLP module may use the OCR output to identify structured fields such as:

MRP
Net quantity
Manufacturer/packer/importer
Product name
Consumer care information
Other required label information

The compliance engine must use the structured information and applicable rules rather than treating raw OCR output as a legal verdict.
