from src.ocr_engine import OCREngine


image_path = "input/product1.jpg"

ocr_engine = OCREngine()

ocr_result = ocr_engine.extract_text(image_path)

print("\nOCR RESULTS:")
print("=" * 50)

print(f"Image ID: {ocr_result['image_id']}")

for block in ocr_result["text_blocks"]:
    print(f"Text: {block['text']}")
    print(f"Bounding Box: {block['bbox']}")
    print(f"Confidence: {block['confidence']}")
    print("-" * 50)