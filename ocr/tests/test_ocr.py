from pathlib import Path

from src.ocr_engine import OCREngine


input_dir = Path("input")

image_paths = sorted(input_dir.glob("*.jpg"))

ocr_engine = OCREngine()

for image_path in image_paths:
    print("\n" + "=" * 60)
    print(f"Processing: {image_path.name}")
    print("=" * 60)

    ocr_result = ocr_engine.extract_text(str(image_path))

    print(f"Image ID: {ocr_result['image_id']}")
    print(f"Detected text blocks: {len(ocr_result['text_blocks'])}")

    for block in ocr_result["text_blocks"]:
        print(f"Text: {block['text']}")
        print(f"Bounding Box: {block['bbox']}")
        print(f"Confidence: {block['confidence']}")
        print("-" * 50)

    json_path = ocr_engine.save_result(str(image_path))

    print(f"JSON saved to: {json_path}")
